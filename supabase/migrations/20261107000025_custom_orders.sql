-- =====================================================================
-- 0025 طلبات التفصيل حسب المقاس (إضافات فقط: جدولان جديدان ودوال جديدة، لا تعديل على أي جدول قائم)
-- - custom_orders: الطلب (نوع المنتج + المواصفات JSON بقيم ووحدات منفصلة + بيانات العميل + الحالة والسعر النهائي)
-- - custom_order_events: سجل كل تغيير (إنشاء، حالة، سعر، ملاحظة داخلية) مع الموظف والوقت
-- - الوصول عبر دوال SECURITY DEFINER فقط (RLS مفعّل بلا سياسات = لا قراءة/كتابة مباشرة لأحد):
--   submit_custom_order: لمفتاح الخدمة فقط (من خادم الموقع بعد التحقق وحد الطلبات)، ويمنع التكرار بمعرّف الطلب
--   admin_custom_orders / admin_custom_order: orders.read · update_custom_order: orders.manage (ومسجلة في سجل النشاط)
-- - لا سعر تلقائي: السعر النهائي يحدده الموظف فقط.
-- =====================================================================

create sequence public.custom_order_seq start 1001;

create table public.custom_orders (
  id              uuid primary key default gen_random_uuid(),
  number          text not null unique default ('SO-' || nextval('public.custom_order_seq')),
  request_id      uuid not null unique,
  product_type    text not null check (product_type in ('curtains', 'ceiling', 'mattress', 'other')),
  specs           jsonb not null,
  customer_name   text not null check (char_length(customer_name) between 2 and 80),
  phone           text not null check (phone ~ '^05[0-9]{8}$'),
  area            text not null check (char_length(area) between 2 and 80),
  customer_notes  text check (customer_notes is null or char_length(customer_notes) <= 1000),
  preview_image   text check (preview_image is null or (preview_image like 'data:image/jpeg;base64,%' and length(preview_image) <= 400000)),
  reference_image text check (reference_image is null or (reference_image like 'data:image/jpeg;base64,%' and length(reference_image) <= 700000)),
  status          text not null default 'new'
                  check (status in ('new', 'reviewing', 'awaiting_customer', 'confirmed', 'in_progress', 'ready', 'completed', 'cancelled')),
  final_price     numeric(12, 2) check (final_price is null or final_price >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index custom_orders_created_idx on public.custom_orders (created_at desc);
create index custom_orders_status_idx on public.custom_orders (status);

create table public.custom_order_events (
  id         bigint generated always as identity primary key,
  order_id   uuid not null references public.custom_orders(id) on delete cascade,
  kind       text not null check (kind in ('created', 'status', 'price', 'note')),
  status     text,
  price      numeric(12, 2),
  note       text check (note is null or char_length(note) <= 1000),
  actor_id   uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index custom_order_events_order_idx on public.custom_order_events (order_id, created_at);

alter table public.custom_orders enable row level security;
alter table public.custom_order_events enable row level security;
revoke all on public.custom_orders, public.custom_order_events from anon, authenticated;
revoke all on sequence public.custom_order_seq from anon, authenticated;

-- ---------------------------------------------------------------------
-- التحقق من المواصفات (نفس حدود src/lib/custom-order/spec.ts)
-- ---------------------------------------------------------------------
create or replace function private.num_in(p jsonb, p_min numeric, p_max numeric)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'number' and (p #>> '{}')::numeric > 0
     and (p #>> '{}')::numeric between p_min and p_max
     and scale((p #>> '{}')::numeric) <= 2
$$;

create or replace function private.custom_spec_ok(p_type text, s jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare w jsonb;
begin
  if jsonb_typeof(s) <> 'object' or length(s::text) > 8000 then return false; end if;
  if p_type = 'curtains' then
    if jsonb_typeof(s->'windows') <> 'array' or jsonb_array_length(s->'windows') not between 1 and 20 then return false; end if;
    for w in select * from jsonb_array_elements(s->'windows') loop
      if not (private.num_in(w->'width', 0.2, 12) and private.num_in(w->'height', 0.2, 8)
              and private.num_in(w->'count', 1, 20) and private.num_in(w->'panels', 1, 8) and w->>'unit' = 'm') then return false; end if;
    end loop;
    return coalesce(s->>'blackout', '') in ('none', 'partial', 'full', 'unknown');
  elsif p_type = 'ceiling' then
    return private.num_in(s->'width', 0.5, 20) and private.num_in(s->'length', 0.5, 30)
       and private.num_in(s->'quantity', 1, 50) and s->>'unit' = 'm' and coalesce(s->>'design', '') in ('plain', 'pleated', 'panels');
  elsif p_type = 'mattress' then
    return private.num_in(s->'width', 40, 250) and private.num_in(s->'length', 100, 250) and private.num_in(s->'height', 5, 60)
       and private.num_in(s->'quantity', 1, 20) and s->>'unit' = 'cm' and coalesce(s->>'cover', '') in ('zipper', 'fitted', 'quilted');
  elsif p_type = 'other' then
    if coalesce(s->>'unit', '') not in ('m', 'cm') or char_length(coalesce(s->>'name', '')) not between 2 and 60 then return false; end if;
    return private.num_in(s->'width', case s->>'unit' when 'm' then 0.05 else 5 end, case s->>'unit' when 'm' then 30 else 3000 end)
       and private.num_in(s->'length', case s->>'unit' when 'm' then 0.05 else 5 end, case s->>'unit' when 'm' then 30 else 3000 end)
       and (s->'height' is null or s->'height' = 'null'::jsonb
            or private.num_in(s->'height', case s->>'unit' when 'm' then 0.05 else 5 end, case s->>'unit' when 'm' then 30 else 3000 end))
       and private.num_in(s->'quantity', 1, 100);
  end if;
  return false;
end $$;

-- ---------------------------------------------------------------------
-- استقبال الطلب (من خادم الموقع فقط)
-- ---------------------------------------------------------------------
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
  return jsonb_build_object('id', v_row.id, 'number', v_row.number, 'duplicate', false);
end $$;
revoke all on function public.submit_custom_order(jsonb) from public, anon, authenticated;
grant execute on function public.submit_custom_order(jsonb) to service_role;

-- ---------------------------------------------------------------------
-- الإدارة
-- ---------------------------------------------------------------------
create or replace function public.admin_custom_orders(p jsonb default '{}')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_q text := nullif(btrim(coalesce(p->>'q', '')), '');
  v_digits text := regexp_replace(coalesce(p->>'q', ''), '\D', '', 'g');
  v_size int := least(greatest(coalesce((p->>'page_size')::int, 25), 1), 100);
  v_page int := greatest(coalesce((p->>'page')::int, 1), 1);
  v_from date := nullif(p->>'from', '')::date; v_to date := nullif(p->>'to', '')::date;
  v_res jsonb;
begin
  perform private.require_permission('orders.read');
  with f as (
    select o.* from public.custom_orders o
     where (v_q is null or o.number ilike '%' || v_q || '%' or o.customer_name ilike '%' || v_q || '%'
            or (length(v_digits) >= 4 and o.phone like '%' || v_digits || '%'))
       and (nullif(p->>'type', '') is null or o.product_type = p->>'type')
       and (nullif(p->>'status', '') is null or o.status = p->>'status')
       and (v_from is null or o.created_at >= v_from::timestamp at time zone 'Asia/Gaza')
       and (v_to is null or o.created_at < (v_to + 1)::timestamp at time zone 'Asia/Gaza')
  )
  select jsonb_build_object(
    'total', (select count(*) from f),
    'page', v_page, 'page_size', v_size,
    'counts', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from public.custom_orders group by status) c),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'number', number, 'product_type', product_type, 'customer_name', customer_name, 'phone', phone, 'area', area,
        'status', status, 'final_price', final_price, 'created_at', created_at, 'updated_at', updated_at, 'specs', specs) order by created_at desc)
      from (select * from f order by created_at desc limit v_size offset (v_page - 1) * v_size) x), '[]'))
  into v_res;
  return v_res;
end $$;

create or replace function public.admin_custom_order(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  perform private.require_permission('orders.read');
  select to_jsonb(o) || jsonb_build_object('events', coalesce((
    select jsonb_agg(jsonb_build_object('kind', e.kind, 'status', e.status, 'price', e.price, 'note', e.note,
                     'created_at', e.created_at, 'actor', pr.full_name) order by e.created_at, e.id)
      from public.custom_order_events e left join public.profiles pr on pr.id = e.actor_id where e.order_id = o.id), '[]'))
    into v from public.custom_orders o where o.id = p_id;
  if v is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  return v;
end $$;

create or replace function public.update_custom_order(p_id uuid, p_status text default null, p_final_price numeric default null, p_note text default null, p_clear_price boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_old public.custom_orders; v_new public.custom_orders; v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  perform private.require_permission('orders.manage');
  select * into v_old from public.custom_orders where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_status is not null and p_status not in ('new', 'reviewing', 'awaiting_customer', 'confirmed', 'in_progress', 'ready', 'completed', 'cancelled') then
    raise exception 'invalid_status' using errcode = '22023'; end if;
  if p_final_price is not null and p_final_price < 0 then raise exception 'invalid_price' using errcode = '22023'; end if;
  if v_note is not null and char_length(v_note) > 1000 then raise exception 'note_too_long' using errcode = '22023'; end if;

  update public.custom_orders set
    status = coalesce(p_status, status),
    final_price = case when p_clear_price then null else coalesce(p_final_price, final_price) end,
    updated_at = now()
  where id = p_id returning * into v_new;

  if v_new.status is distinct from v_old.status then
    insert into public.custom_order_events (order_id, kind, status, actor_id) values (p_id, 'status', v_new.status, auth.uid()); end if;
  if v_new.final_price is distinct from v_old.final_price then
    insert into public.custom_order_events (order_id, kind, price, actor_id) values (p_id, 'price', v_new.final_price, auth.uid()); end if;
  if v_note is not null then
    insert into public.custom_order_events (order_id, kind, note, actor_id) values (p_id, 'note', v_note, auth.uid()); end if;

  perform private.log_activity('custom_order.updated', 'custom_orders', v_new.number,
    jsonb_build_object('status', v_old.status, 'final_price', v_old.final_price),
    jsonb_build_object('status', v_new.status, 'final_price', v_new.final_price), v_note);
  return jsonb_build_object('status', v_new.status, 'final_price', v_new.final_price);
end $$;

revoke all on function public.admin_custom_orders(jsonb), public.admin_custom_order(uuid),
  public.update_custom_order(uuid, text, numeric, text, boolean) from public, anon;
grant execute on function public.admin_custom_orders(jsonb), public.admin_custom_order(uuid),
  public.update_custom_order(uuid, text, numeric, text, boolean) to authenticated;
revoke all on function private.custom_spec_ok(text, jsonb), private.num_in(jsonb, numeric, numeric) from public, anon, authenticated;
