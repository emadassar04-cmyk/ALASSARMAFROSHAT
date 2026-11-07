-- =====================================================================
-- 0013 إشعارات Telegram عبر n8n (سحب من صندوق الأحداث)
-- - مفتاح تكامل محدود الصلاحية: يسمح فقط بقراءة الإشعارات والتقرير اليومي (يُخزَّن مجزأً)
-- - تسليم مستقل لكل قناة (telegram الآن، whatsapp لاحقاً) مع إعادة محاولة ومنع التكرار
-- - نصوص الرسائل تُبنى هنا: ملخص بلا بيانات شخصية كاملة + رابط آمن للوحة التحكم
-- =====================================================================

alter table public.store_settings add column site_url text not null default 'https://alassarnumber1.vercel.app'
  check (site_url ~ '^https://[^/]+$');

-- ---------------------------------------------------------------------
-- مفاتيح التكامل (لا يُخزَّن المفتاح نفسه، فقط بصمته)
-- ---------------------------------------------------------------------
create table private.integration_keys (
  name          text primary key check (name ~ '^[a-z0-9_]+$'),
  key_hash      text not null,
  created_at    timestamptz not null default now(),
  created_by    uuid,
  last_used_at  timestamptz
);

-- يُنشئ مفتاحاً جديداً (يُعرض مرة واحدة فقط) ويُبطل السابق
create or replace function public.generate_integration_key(p_name text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_key text := 'ak_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  perform private.require_permission('settings.manage');
  insert into private.integration_keys (name, key_hash, created_by)
  values (p_name, private.hash_token(v_key), auth.uid())
  on conflict (name) do update set key_hash = excluded.key_hash, created_at = now(), created_by = auth.uid(), last_used_at = null;
  perform private.log_activity('integration.key_generated', 'integration_keys', p_name, null, null, 'مفتاح جديد (القيمة لا تُسجَّل)');
  return v_key;
end $$;

create or replace function public.integration_key_status(p_name text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when private.has_permission('settings.manage') then
    (select jsonb_build_object('exists', true, 'created_at', created_at, 'last_used_at', last_used_at)
       from private.integration_keys where name = p_name)
  end
$$;

-- يتحقق من المفتاح المرسل في ترويسة x-alassar-key (عبر PostgREST request.headers)
create or replace function private.require_integration_key(p_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_key text := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json->>'x-alassar-key';
begin
  if v_key is null or not exists (
    select 1 from private.integration_keys where name = p_name and key_hash = private.hash_token(v_key)) then
    raise exception 'forbidden: invalid integration key' using errcode = '42501';
  end if;
  update private.integration_keys set last_used_at = now() where name = p_name;
end $$;

-- ---------------------------------------------------------------------
-- التسليم لكل قناة
-- ---------------------------------------------------------------------
create table public.notification_deliveries (
  id               bigint generated always as identity primary key,
  event_id         uuid not null references public.notification_outbox(event_id) on delete cascade,
  channel          text not null check (channel in ('telegram', 'whatsapp')),
  status           public.outbox_status not null default 'pending',
  attempts         integer not null default 0,
  next_attempt_at  timestamptz not null default now(),
  locked_at        timestamptz,
  last_error       text,
  sent_at          timestamptz,
  created_at       timestamptz not null default now(),
  unique (event_id, channel)
);
create index notification_deliveries_due_idx on public.notification_deliveries(channel, next_attempt_at)
  where status in ('pending', 'failed', 'processing');
alter table public.notification_deliveries enable row level security;
create policy notification_deliveries_read on public.notification_deliveries for select
  using (private.has_permission('settings.manage'));
revoke all on public.notification_deliveries from anon;
revoke insert, update, delete, truncate on public.notification_deliveries from authenticated;

-- توجيه الأحداث إلى القنوات (إشعارات المدير عبر Telegram)
create or replace function private.route_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.event_type in ('order.created', 'payment.bank_transfer_selected', 'reservation.expired', 'auth.staff_login') then
    insert into public.notification_deliveries (event_id, channel) values (new.event_id, 'telegram')
    on conflict do nothing;
  end if;
  return new;
end $$;
create trigger notification_outbox_route after insert on public.notification_outbox
  for each row execute function private.route_event();

-- الأحداث الموجودة: طلب جديد وتحويل بنكي فقط (أول اختبار)، لا نعيد إرسال القديم الآخر
insert into public.notification_deliveries (event_id, channel)
select event_id, 'telegram' from public.notification_outbox
 where event_type in ('order.created', 'payment.bank_transfer_selected') and created_at > now() - interval '1 day'
on conflict do nothing;

-- ---------------------------------------------------------------------
-- تنسيق الرسائل (HTML لـ Telegram)
-- ---------------------------------------------------------------------
create or replace function private.html_escape(p text)
returns text language sql immutable set search_path = '' as $$
  select replace(replace(replace(coalesce(p, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
$$;

create or replace function private.fmt_ils(p numeric)
returns text language sql immutable set search_path = '' as $$
  select trim(to_char(coalesce(p, 0), 'FM999G999G990D00')) || ' ₪'
$$;

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
    else private.html_escape(p_event.event_type)
  end;
end $$;

-- ---------------------------------------------------------------------
-- واجهة n8n (بمفتاح التكامل فقط)
-- ---------------------------------------------------------------------
create or replace function public.notifications_claim(p_channel text default 'telegram', p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  perform private.require_integration_key('n8n');
  with claimed as (
    update public.notification_deliveries d
       set status = 'processing', locked_at = now(), attempts = d.attempts + 1
     where d.id in (
       select id from public.notification_deliveries
        where channel = p_channel
          and ((status in ('pending', 'failed') and next_attempt_at <= now())
               or (status = 'processing' and locked_at < now() - interval '10 minutes'))
        order by id limit least(greatest(p_limit, 1), 50)
        for update skip locked)
    returning d.event_id, d.attempts)
  select coalesce(jsonb_agg(jsonb_build_object(
           'event_id', c.event_id, 'event_type', e.event_type, 'attempt', c.attempts,
           'text', private.telegram_text(e)) order by e.id), '[]')
    into v_result
    from claimed c join public.notification_outbox e on e.event_id = c.event_id;
  return v_result;
end $$;

create or replace function public.notifications_complete(
  p_event_id uuid, p_success boolean, p_error text default null, p_channel text default 'telegram')
returns text language plpgsql security definer set search_path = '' as $$
declare v_status public.outbox_status;
begin
  perform private.require_integration_key('n8n');
  update public.notification_deliveries set
    status = case when p_success then 'sent'::public.outbox_status when attempts >= 5 then 'dead' else 'failed' end,
    sent_at = case when p_success then now() end,
    last_error = case when p_success then null else left(p_error, 500) end,
    next_attempt_at = case when p_success then next_attempt_at
                           else now() + make_interval(mins => least(60, (2 ^ attempts)::integer)) end,
    locked_at = null
  where event_id = p_event_id and channel = p_channel and status = 'processing'
  returning status into v_status;
  return coalesce(v_status::text, 'ignored');
end $$;

-- التقرير اليومي (بتوقيت فلسطين). الإيراد = الطلبات المؤكدة في ذلك اليوم وغير الملغاة.
create or replace function public.notifications_daily_report(p_date date default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_day   date := coalesce(p_date, (now() at time zone 'Asia/Gaza')::date);
  v_from  timestamptz := (v_day::timestamp at time zone 'Asia/Gaza');
  v_to    timestamptz := ((v_day + 1)::timestamp at time zone 'Asia/Gaza');
  o       record;
  f       record;
  v_top   text;
  v_low   text;
  v_text  text;
begin
  perform private.require_integration_key('n8n');

  select
    count(*) filter (where created_at >= v_from and created_at < v_to) as new_orders,
    count(*) filter (where cancelled_at >= v_from and cancelled_at < v_to) as cancelled,
    count(*) filter (where delivered_at >= v_from and delivered_at < v_to) as delivered,
    count(*) filter (where confirmed_at >= v_from and confirmed_at < v_to and status <> 'cancelled') as confirmed,
    coalesce(sum(total) filter (where confirmed_at >= v_from and confirmed_at < v_to and status <> 'cancelled'), 0) as revenue,
    coalesce(sum(delivery_fee) filter (where confirmed_at >= v_from and confirmed_at < v_to and status <> 'cancelled'), 0) as delivery_fees,
    count(*) filter (where status in ('received', 'awaiting_confirmation')) as pending_confirmation,
    count(*) filter (where payment_status = 'awaiting_review' and status <> 'cancelled') as pending_transfers
  into o from public.orders;

  -- الأرباح والمستحقات لبنود الطلبات المؤكدة اليوم
  select
    coalesce(sum(i.manager_profit_amount), 0) as profit,
    coalesce(sum(i.store_due_amount), 0) as store_due,
    count(*) filter (where i.manager_profit_amount is null) as missing_profit
  into f
  from public.order_items i join public.orders x on x.id = i.order_id
  where x.confirmed_at >= v_from and x.confirmed_at < v_to and x.status <> 'cancelled';

  select string_agg('• ' || private.html_escape(name) || ' × ' || qty, E'\n' order by qty desc, name) into v_top
  from (select i.product_name_snapshot as name, sum(i.quantity) as qty
          from public.order_items i join public.orders x on x.id = i.order_id
         where x.confirmed_at >= v_from and x.confirmed_at < v_to and x.status <> 'cancelled'
         group by 1 order by 2 desc limit 5) t;

  select string_agg('• ' || private.html_escape(name) || ' (المتاح ' || avail || ')', E'\n' order by avail, name) into v_low
  from (select p.name, sum(i.on_hand - i.reserved) as avail
          from public.products p
          join public.product_variants v on v.product_id = p.id and v.is_active
          join public.inventory i on i.variant_id = v.id
         where p.status = 'active' and p.availability_mode = 'stock'
         group by p.id, p.name, p.low_stock_threshold
        having sum(i.on_hand - i.reserved) <= p.low_stock_threshold
         order by 2 limit 10) t;

  v_text := '📊 <b>تقرير يوم ' || to_char(v_day, 'YYYY-MM-DD') || '</b>' || E'\n\n'
    || 'المبيعات المؤكدة: <b>' || o.confirmed || '</b> طلب — ' || private.fmt_ils(o.revenue) || E'\n'
    || '  منها رسوم توصيل: ' || private.fmt_ils(o.delivery_fees) || E'\n'
    || 'صافي ربحك: <b>' || private.fmt_ils(f.profit) || '</b>' || E'\n'
    || 'مستحقات المحل: <b>' || private.fmt_ils(f.store_due) || '</b>' || E'\n'
    || case when f.missing_profit > 0 then '⚠️ ' || f.missing_profit || ' بند بلا ربح مسجل (المستحقات غير مكتملة)' || E'\n' else '' end
    || E'\n'
    || 'طلبات جديدة: ' || o.new_orders || ' | ملغاة: ' || o.cancelled || ' | مُسلَّمة: ' || o.delivered || E'\n'
    || 'بانتظار التأكيد الآن: ' || o.pending_confirmation || ' | تحويلات بانتظار المراجعة: ' || o.pending_transfers || E'\n'
    || case when v_top is not null then E'\nالأكثر مبيعاً:\n' || v_top || E'\n' else '' end
    || case when v_low is not null then E'\n⚠️ مخزون منخفض:\n' || v_low || E'\n' else E'\nالمخزون: لا تنبيهات.\n' end
    || E'\nالمصروفات: تُضاف مع قسم المالية.\n'
    || (select site_url from public.store_settings) || '/admin/orders';

  return jsonb_build_object('date', v_day, 'text', v_text);
end $$;

-- دخول المدير بخطوتين يرسل تنبيه Telegram
create or replace function public.record_staff_login(p_user_agent text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  perform private.log_activity('auth.staff_login', 'profiles', auth.uid()::text, null,
    jsonb_build_object('user_agent', left(p_user_agent, 300)));
  perform private.enqueue_event('auth.staff_login', null, jsonb_build_object('user_agent', left(p_user_agent, 300)));
end $$;

-- ---------------------------------------------------------------------
-- الصلاحيات
-- ---------------------------------------------------------------------
revoke all on function public.generate_integration_key(text) from public, anon;
revoke all on function public.integration_key_status(text) from public, anon;
revoke all on function public.notifications_claim(text, integer) from public;
revoke all on function public.notifications_complete(uuid, boolean, text, text) from public;
revoke all on function public.notifications_daily_report(date) from public;
grant execute on function public.generate_integration_key(text) to authenticated;
grant execute on function public.integration_key_status(text) to authenticated;
-- n8n يتصل بالمفتاح العام + مفتاح التكامل في الترويسة؛ الدالة نفسها ترفض دون مفتاح صحيح
grant execute on function public.notifications_claim(text, integer) to anon, service_role;
grant execute on function public.notifications_complete(uuid, boolean, text, text) to anon, service_role;
grant execute on function public.notifications_daily_report(date) to anon, service_role;

revoke all on all functions in schema private from anon, authenticated;
grant execute on function private.is_service_role() to anon, authenticated, service_role;
grant execute on function private.has_permission(text) to anon, authenticated, service_role;
grant execute on function private.is_staff() to anon, authenticated, service_role;
grant execute on function private.require_permission(text) to anon, authenticated, service_role;
grant execute on function private.default_branch_id() to anon, authenticated, service_role;
