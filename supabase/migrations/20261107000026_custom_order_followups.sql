-- =====================================================================
-- 0026 متابعات استوديو التفصيل
-- 1) إشعار Telegram لكل طلب تفصيل جديد (حدث custom_order.created عبر صندوق الأحداث وقناة telegram الحالية)
--    استبدال ثلاث دوال فقط: route_event (يضيف نوع الحدث)، telegram_text (يضيف نص الرسالة)، submit_custom_order (يضيف الحدث)
-- 2) خيارات الأقمشة والألوان تديرها الإدارة (جدولان جديدان): الاسم، صورة القماش الحقيقية اختيارياً (Texture)، لون HEX، الترتيب، التفعيل
--    قراءة عامة للمفعّل فقط؛ الإدارة بصلاحية catalog.manage (RLS)، وكل تعديل في سجل النشاط
-- لا تعديل على أي جدول قائم.
-- =====================================================================

-- ملخص قصير للمقاسات (للإشعار)
create or replace function private.custom_summary(p_type text, s jsonb)
returns text language sql immutable set search_path = '' as $$
  select case p_type
    when 'curtains' then 'عدد الشبابيك: ' || jsonb_array_length(s->'windows')
      || ' — أولها ' || (s->'windows'->0->>'width') || ' × ' || (s->'windows'->0->>'height') || ' م'
    when 'ceiling' then (s->>'width') || ' × ' || (s->>'length') || ' م — الكمية ' || (s->>'quantity')
    when 'mattress' then (s->>'width') || ' × ' || (s->>'length') || ' × ' || (s->>'height') || ' سم — الكمية ' || (s->>'quantity')
    else coalesce(s->>'name', '') || ': ' || (s->>'width') || ' × ' || (s->>'length')
      || coalesce(' × ' || nullif(s->>'height', ''), '') || case s->>'unit' when 'm' then ' م' else ' سم' end
  end
$$;
revoke all on function private.custom_summary(text, jsonb) from public, anon, authenticated;

create or replace function private.route_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.event_type in ('order.created', 'payment.bank_transfer_selected', 'reservation.expired', 'auth.staff_login', 'custom_order.created') then
    insert into public.notification_deliveries (event_id, channel) values (new.event_id, 'telegram')
    on conflict do nothing;
  end if;
  return new;
end $$;

create or replace function private.telegram_text(p_event public.notification_outbox)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  o public.orders;
  v_site text := (select site_url from public.store_settings);
  v_items text;
  v_zone text;
begin
  if p_event.order_id is not null then
    select * into o from public.orders where id = p_event.order_id;
    select string_agg('• ' || private.html_escape(i.product_name_snapshot)
             || coalesce(nullif(' (' || private.html_escape(nullif(i.variant_snapshot->>'name', 'افتراضي')) || ')', ' ()'), '')
             || ' × ' || i.quantity, E'\n' order by i.created_at)
      into v_items from public.order_items i where i.order_id = o.id;
    select name into v_zone from public.delivery_zones where id = o.delivery_zone_id;
  end if;

  return case p_event.event_type
    when 'order.created' then
      '🛒 <b>طلب جديد ' || o.order_number || '</b>' || E'\n'
      || 'الإجمالي: <b>' || private.fmt_ils(o.total) || '</b>' || E'\n'
      || case when o.fulfillment = 'delivery' then 'توصيل — ' || private.html_escape(coalesce(v_zone, '')) else 'استلام من المحل' end || E'\n'
      || 'الدفع: ' || case o.payment_method when 'cash_on_delivery' then 'نقداً عند الاستلام'
                       when 'cash_in_store' then 'نقداً في المحل' else 'تحويل بنكي' end || E'\n'
      || coalesce(v_items, '') || E'\n'
      || case when o.reservation_expires_at is not null
              then 'الحجز ينتهي: ' || to_char(o.reservation_expires_at at time zone 'Asia/Gaza', 'HH24:MI') || E'\n' else '' end
      || v_site || '/admin/orders/' || o.id
    when 'payment.bank_transfer_selected' then
      '🏦 <b>تحويل بنكي — ' || o.order_number || '</b>' || E'\n'
      || 'المبلغ: ' || private.fmt_ils(o.total) || E'\n'
      || 'أرسل بيانات الحساب للزبون عبر WhatsApp، وراجع التحويل قبل الاعتماد.' || E'\n'
      || v_site || '/admin/orders/' || o.id
    when 'reservation.expired' then
      '⌛ انتهى حجز الطلب ' || o.order_number || ' دون تأكيد، وأُلغي تلقائياً وعادت الكمية للمخزون.' || E'\n'
      || v_site || '/admin/orders/' || o.id
    when 'auth.staff_login' then
      '🔐 دخول جديد إلى لوحة الإدارة' || E'\n'
      || 'الوقت: ' || to_char(p_event.created_at at time zone 'Asia/Gaza', 'YYYY-MM-DD HH24:MI') || E'\n'
      || 'الجهاز: ' || private.html_escape(left(p_event.payload->>'user_agent', 120)) || E'\n'
      || 'إن لم تكن أنت: ادخل اللوحة واضغط «إنهاء كل الجلسات» فوراً.'
    when 'custom_order.created' then
      '📐 <b>طلب تفصيل جديد ' || private.html_escape(p_event.payload->>'number') || '</b>' || E'\n'
      || private.html_escape(p_event.payload->>'type_label') || E'\n'
      || private.html_escape(p_event.payload->>'summary') || E'\n'
      || 'المنطقة: ' || private.html_escape(p_event.payload->>'area') || E'\n'
      || 'السعر يُحدَّد بعد المراجعة.' || E'\n'
      || v_site || '/admin/custom-orders/' || (p_event.payload->>'id')
    else private.html_escape(p_event.event_type)
  end;
end $$;

create or replace function public.submit_custom_order(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_phone text; v_row public.custom_orders; v_req uuid;
begin
  if not private.is_service_role() then raise exception 'forbidden' using errcode = '42501'; end if;
  begin v_req := (p->>'request_id')::uuid; exception when others then raise exception 'invalid_request' using errcode = '22023'; end;
  if v_req is null then raise exception 'invalid_request' using errcode = '22023'; end if;

  -- نفس معرّف الطلب (نقر متكرر أو إعادة إرسال) ⇒ نفس الطلب دون تكرار
  select * into v_row from public.custom_orders where request_id = v_req;
  if found then return jsonb_build_object('id', v_row.id, 'number', v_row.number, 'duplicate', true); end if;

  if not private.custom_spec_ok(p->>'product_type', p->'specs') then raise exception 'invalid_specs' using errcode = '22023'; end if;
  v_phone := private.canonical_phone(p->>'phone');
  if v_phone is null then raise exception 'invalid_phone' using errcode = '22023'; end if;

  insert into public.custom_orders (request_id, product_type, specs, customer_name, phone, area, customer_notes, preview_image, reference_image)
  values (v_req, p->>'product_type', p->'specs', btrim(p->>'customer_name'), v_phone, btrim(p->>'area'),
          nullif(btrim(coalesce(p->>'customer_notes', '')), ''), nullif(p->>'preview_image', ''), nullif(p->>'reference_image', ''))
  returning * into v_row;
  insert into public.custom_order_events (order_id, kind, status) values (v_row.id, 'created', 'new');
  -- إشعار Telegram للإدارة (عبر صندوق الأحداث نفسه): ملخص بلا اسم أو جوال العميل
  perform private.enqueue_event('custom_order.created', null, jsonb_build_object(
    'id', v_row.id, 'number', v_row.number, 'area', v_row.area,
    'type_label', case v_row.product_type when 'curtains' then 'ستائر' when 'ceiling' then 'بطانة سقف' when 'mattress' then 'وجه فرشة' else 'تفصيلات أخرى' end,
    'summary', private.custom_summary(v_row.product_type, v_row.specs)));
  return jsonb_build_object('id', v_row.id, 'number', v_row.number, 'duplicate', false);
end $$;
revoke all on function public.submit_custom_order(jsonb) from public, anon, authenticated;
grant execute on function public.submit_custom_order(jsonb) to service_role;

-- ---------------------------------------------------------------------
-- خيارات الأقمشة والألوان
-- ---------------------------------------------------------------------
create table public.custom_fabrics (
  id           uuid primary key default gen_random_uuid(),
  product_type text not null check (product_type in ('curtains', 'ceiling', 'mattress', 'other')),
  name         text not null check (char_length(btrim(name)) between 1 and 60),
  texture_url  text check (texture_url is null or texture_url ~ '^(https://|/)[^\s"<>]+$'),
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  unique (product_type, name)
);
create table public.custom_colors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (char_length(btrim(name)) between 1 and 40),
  hex         text not null check (hex ~ '^#[0-9a-fA-F]{6}$'),
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.custom_fabrics enable row level security;
alter table public.custom_colors enable row level security;
create policy custom_fabrics_read on public.custom_fabrics for select using (is_active or private.has_permission('catalog.manage'));
create policy custom_fabrics_manage on public.custom_fabrics for all
  using (private.has_permission('catalog.manage')) with check (private.has_permission('catalog.manage'));
create policy custom_colors_read on public.custom_colors for select using (is_active or private.has_permission('catalog.manage'));
create policy custom_colors_manage on public.custom_colors for all
  using (private.has_permission('catalog.manage')) with check (private.has_permission('catalog.manage'));
revoke all on public.custom_fabrics, public.custom_colors from anon, authenticated;
grant select on public.custom_fabrics, public.custom_colors to anon, authenticated;
grant insert, update, delete on public.custom_fabrics, public.custom_colors to authenticated;
create trigger custom_fabrics_audit after insert or update or delete on public.custom_fabrics for each row execute function private.audit_row();
create trigger custom_colors_audit after insert or update or delete on public.custom_colors for each row execute function private.audit_row();

-- القيم الأولية = نفس الخيارات المعروضة حالياً في الموقع (يعدّلها المحل من الإدارة)
insert into public.custom_fabrics (product_type, name, sort_order) values
  ('curtains', 'شيفون (شفاف)', 1), ('curtains', 'كتان', 2), ('curtains', 'قطيفة / مخمل', 3), ('curtains', 'بلاك أوت', 4), ('curtains', 'جاكار', 5),
  ('ceiling', 'قماش ساتان', 1), ('ceiling', 'قماش مطفي', 2), ('ceiling', 'قماش لامع', 3),
  ('mattress', 'قطن', 1), ('mattress', 'جاكار', 2), ('mattress', 'مبطّن (كوِلت)', 3), ('mattress', 'قماش مقاوم للماء', 4),
  ('other', 'قطن', 1), ('other', 'كتان', 2), ('other', 'قطيفة / مخمل', 3), ('other', 'جلد صناعي', 4);
insert into public.custom_colors (name, hex, sort_order) values
  ('عاجي', '#efe9dc', 1), ('بيج', '#d9c7a7', 2), ('رملي', '#c2a77f', 3), ('رمادي فاتح', '#c9c9c4', 4), ('رمادي غامق', '#6e6e6a', 5),
  ('بني', '#7a5a43', 6), ('كحلي', '#2f3a52', 7), ('أخضر زيتي', '#5d6447', 8), ('عنابي', '#6e2f37', 9), ('أبيض', '#f7f6f2', 10);
