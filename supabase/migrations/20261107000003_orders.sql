-- =====================================================================
-- 0003 العملاء، التوصيل، الدفع، الكوبونات، الطلبات، الحجز الذري، الأحداث
-- =====================================================================

create type public.customer_tier as enum ('regular', 'loyal', 'vip');
create type public.fulfillment_method as enum ('delivery', 'pickup');
create type public.payment_method_code as enum ('cash_on_delivery', 'cash_in_store', 'bank_transfer');
create type public.payment_status as enum ('unpaid', 'awaiting_review', 'paid', 'rejected', 'refunded');
create type public.order_status as enum (
  'received',               -- تم استلام الطلب
  'awaiting_confirmation',  -- بانتظار التواصل والتأكيد عبر WhatsApp
  'confirmed',              -- تم تأكيد الطلب
  'preparing',              -- قيد التجهيز
  'ready_for_pickup',       -- جاهز للاستلام من المحل
  'out_for_delivery',       -- خرج للتوصيل
  'delivered',              -- تم التسليم
  'cancelled');             -- تم إلغاء الطلب
create type public.reservation_status as enum ('active', 'consumed', 'released');
create type public.coupon_kind as enum ('percent', 'fixed');
create type public.outbox_status as enum ('pending', 'processing', 'sent', 'failed', 'dead');

-- ---------------------------------------------------------------------
-- العملاء
-- ---------------------------------------------------------------------
create table public.customers (
  id                    uuid primary key default gen_random_uuid(),
  phone                 text not null unique check (phone ~ '^[0-9]{9,15}$'),
  name                  text not null,
  auth_user_id          uuid unique references auth.users(id) on delete set null,
  tier                  public.customer_tier not null default 'regular',
  marketing_consent     boolean not null default false,
  marketing_consent_at  timestamptz,
  deletion_requested_at timestamptz,
  created_at            timestamptz not null default now(),
  last_order_at         timestamptz
);

create table public.customer_addresses (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  zone_id      uuid,
  address      text not null,
  created_at   timestamptz not null default now()
);
create index customer_addresses_customer_idx on public.customer_addresses(customer_id);

-- ---------------------------------------------------------------------
-- التوصيل والدفع
-- ---------------------------------------------------------------------
create table public.delivery_zones (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null default private.default_branch_id() references public.branches(id),
  name          text not null,
  fee           numeric(12,2) not null check (fee >= 0),
  eta_text      text,  -- مثال: "خلال 1-2 يوم"
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);
alter table public.customer_addresses
  add constraint customer_addresses_zone_fk foreign key (zone_id) references public.delivery_zones(id) on delete set null;

create table public.payment_methods (
  code          public.payment_method_code primary key,
  name_ar       text not null,
  instructions  text,
  is_enabled    boolean not null default true,
  sort_order    integer not null default 0
);
insert into public.payment_methods (code, name_ar, sort_order) values
  ('cash_on_delivery', 'الدفع نقداً عند الاستلام', 1),
  ('cash_in_store',    'الدفع نقداً في المحل', 2),
  ('bank_transfer',    'تحويل بنكي (يُراجع يدوياً)', 3);

create table public.bank_accounts (
  id              uuid primary key default gen_random_uuid(),
  bank_name       text not null,
  account_name    text not null,
  account_number  text not null,
  iban            text,
  bank_branch     text,
  is_active       boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- الكوبونات
-- ---------------------------------------------------------------------
create table public.coupons (
  id                     uuid primary key default gen_random_uuid(),
  code                   text not null check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,32}$'),
  kind                   public.coupon_kind not null,
  value                  numeric(12,2) not null check (value > 0),
  max_discount           numeric(12,2) check (max_discount > 0),
  min_order_amount       numeric(12,2) not null default 0 check (min_order_amount >= 0),
  max_uses               integer check (max_uses > 0),
  max_uses_per_customer  integer check (max_uses_per_customer > 0),
  vip_only               boolean not null default false,
  starts_at              timestamptz,
  ends_at                timestamptz,
  is_active              boolean not null default true,
  created_at             timestamptz not null default now(),
  check (kind <> 'percent' or value <= 100),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create unique index coupons_code_key on public.coupons(code);

-- ---------------------------------------------------------------------
-- الطلبات
-- ---------------------------------------------------------------------
create sequence public.order_number_seq start 1001;

create table public.orders (
  id                      uuid primary key default gen_random_uuid(),
  order_number            text not null unique default ('ALS-' || nextval('public.order_number_seq')),
  tracking_token_hash     text not null,
  branch_id               uuid not null references public.branches(id),
  customer_id             uuid not null references public.customers(id),
  customer_name           text not null,
  customer_phone          text not null,
  status                  public.order_status not null default 'received',
  fulfillment             public.fulfillment_method not null,
  delivery_zone_id        uuid references public.delivery_zones(id),
  address                 text,
  customer_notes          text,
  payment_method          public.payment_method_code not null,
  payment_status          public.payment_status not null default 'unpaid',
  coupon_id               uuid references public.coupons(id),
  subtotal                numeric(12,2) not null check (subtotal >= 0),
  discount_total          numeric(12,2) not null default 0 check (discount_total >= 0),
  delivery_fee            numeric(12,2) not null default 0 check (delivery_fee >= 0),
  total                   numeric(12,2) not null check (total >= 0),
  currency                char(3) not null default 'ILS',
  source                  text,
  terms_accepted_at       timestamptz not null,
  reservation_expires_at  timestamptz,
  confirmed_at            timestamptz,
  preparing_at            timestamptz,
  out_for_delivery_at     timestamptz,
  delivered_at            timestamptz,
  cancelled_at            timestamptz,
  cancel_reason           text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  check (discount_total <= subtotal),
  check (total = subtotal - discount_total + delivery_fee),
  check (fulfillment <> 'delivery' or (delivery_zone_id is not null and coalesce(trim(address), '') <> '')),
  check (payment_method <> 'cash_on_delivery' or fulfillment = 'delivery'),
  check (payment_method <> 'cash_in_store' or fulfillment = 'pickup')
);
create index orders_status_idx on public.orders(status, created_at desc);
create index orders_customer_idx on public.orders(customer_id);
create index orders_expiry_idx on public.orders(reservation_expires_at)
  where status in ('received', 'awaiting_confirmation');
create trigger orders_touch before update on public.orders
  for each row execute function private.touch_updated_at();

create table public.order_items (
  id                     uuid primary key default gen_random_uuid(),
  order_id               uuid not null references public.orders(id) on delete restrict,
  product_id             uuid references public.products(id) on delete set null,
  variant_id             uuid references public.product_variants(id) on delete set null,
  product_name_snapshot  text not null,
  variant_snapshot       jsonb not null default '{}',
  customer_notes         text,
  quantity               integer not null check (quantity > 0),
  unit_price_snapshot    numeric(12,2) not null check (unit_price_snapshot >= 0),
  unit_cost_snapshot     numeric(12,2) check (unit_cost_snapshot >= 0),
  gross_line_amount      numeric(12,2) generated always as (unit_price_snapshot * quantity) stored,
  discount_amount        numeric(12,2) not null default 0 check (discount_amount >= 0),
  net_line_amount        numeric(12,2) generated always as (unit_price_snapshot * quantity - discount_amount) stored,
  -- ربح المدير: يُدخل يدوياً لكل بند، ولا يتجاوز صافي البند
  manager_profit_amount  numeric(12,2) check (manager_profit_amount >= 0),
  -- مستحقات المحل = صافي البند − ربح المدير (تُحسب تلقائياً، لا تُدخل)
  store_due_amount       numeric(12,2) generated always as
                           (unit_price_snapshot * quantity - discount_amount - manager_profit_amount) stored,
  is_stock_tracked       boolean not null,
  currency               char(3) not null default 'ILS',
  profit_set_at          timestamptz,
  created_at             timestamptz not null default now(),
  constraint order_items_discount_le_gross check (discount_amount <= unit_price_snapshot * quantity),
  constraint order_items_profit_le_net check (
    manager_profit_amount is null
    or manager_profit_amount <= unit_price_snapshot * quantity - discount_amount)
);
create index order_items_order_idx on public.order_items(order_id);
create index order_items_product_idx on public.order_items(product_id);

create table public.stock_reservations (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete restrict,
  variant_id   uuid not null references public.product_variants(id),
  branch_id    uuid not null references public.branches(id),
  quantity     integer not null check (quantity > 0),
  status       public.reservation_status not null default 'active',
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now(),
  closed_at    timestamptz,
  close_reason text,
  unique (order_id, variant_id, branch_id)
);
create index stock_reservations_active_idx on public.stock_reservations(expires_at) where status = 'active';

create table public.order_status_history (
  id           bigint generated always as identity primary key,
  order_id     uuid not null references public.orders(id) on delete restrict,
  from_status  public.order_status,
  to_status    public.order_status not null,
  actor_id     uuid default auth.uid(),
  note         text,
  created_at   timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history(order_id, created_at);
create trigger order_status_history_no_update before update or delete on public.order_status_history
  for each row execute function private.forbid_mutation();

create table public.order_notes (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders(id) on delete restrict,
  author_id   uuid default auth.uid(),
  body        text not null check (length(trim(body)) > 0),
  created_at  timestamptz not null default now()
);
create index order_notes_order_idx on public.order_notes(order_id);

create table public.coupon_usages (
  id           bigint generated always as identity primary key,
  coupon_id    uuid not null references public.coupons(id),
  order_id     uuid not null unique references public.orders(id),
  customer_id  uuid not null references public.customers(id),
  amount       numeric(12,2) not null check (amount >= 0),
  created_at   timestamptz not null default now()
);
create index coupon_usages_coupon_idx on public.coupon_usages(coupon_id);

create table public.payment_reviews (
  id           bigint generated always as identity primary key,
  order_id     uuid not null references public.orders(id),
  approved     boolean not null,
  amount       numeric(12,2) check (amount >= 0),
  reference    text,
  note         text,
  reviewer_id  uuid default auth.uid(),
  created_at   timestamptz not null default now()
);
create index payment_reviews_order_idx on public.payment_reviews(order_id);
create trigger payment_reviews_no_update before update or delete on public.payment_reviews
  for each row execute function private.forbid_mutation();

-- صندوق الأحداث: الخادم يكتب، وn8n يقرأ عبر دوال مخصصة ويحدّث النتيجة
create table public.notification_outbox (
  id               bigint generated always as identity primary key,
  event_id         uuid not null unique default gen_random_uuid(),
  event_type       text not null,
  order_id         uuid references public.orders(id),
  payload          jsonb not null default '{}',
  status           public.outbox_status not null default 'pending',
  attempts         integer not null default 0,
  next_attempt_at  timestamptz not null default now(),
  locked_at        timestamptz,
  last_error       text,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz
);
create index notification_outbox_pending_idx on public.notification_outbox(next_attempt_at)
  where status in ('pending', 'failed');

-- ---------------------------------------------------------------------
-- دوال مساعدة داخلية
-- ---------------------------------------------------------------------
create or replace function private.normalize_phone(p_phone text)
returns text language sql immutable set search_path = '' as $$
  select regexp_replace(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '^00', '')
$$;

create or replace function private.hash_token(p_token text)
returns text language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
$$;

create or replace function private.enqueue_event(p_type text, p_order_id uuid, p_payload jsonb default '{}')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.notification_outbox (event_type, order_id, payload)
  values (p_type, p_order_id, p_payload)
  returning event_id into v_id;
  return v_id;
end $$;

create or replace function private.record_status(
  p_order_id uuid, p_from public.order_status, p_to public.order_status, p_note text default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.order_status_history (order_id, from_status, to_status, note)
  values (p_order_id, p_from, p_to, p_note);
$$;

-- يتحقق من الكوبون ويقفل صفه حتى لا يتجاوز الاستخدام المتزامن الحد
create or replace function private.evaluate_coupon(p_code text, p_customer_id uuid, p_subtotal numeric)
returns table (coupon_id uuid, discount numeric)
language plpgsql security definer set search_path = '' as $$
declare
  c public.coupons;
  v_tier public.customer_tier;
  v_used integer;
begin
  select * into c from public.coupons where code = upper(trim(p_code)) for update;
  if not found or not c.is_active
     or (c.starts_at is not null and c.starts_at > now())
     or (c.ends_at is not null and c.ends_at <= now()) then
    raise exception 'invalid_coupon' using errcode = 'P0001', detail = 'not_found_or_inactive';
  end if;
  if p_subtotal < c.min_order_amount then
    raise exception 'invalid_coupon' using errcode = 'P0001', detail = 'below_min_order';
  end if;
  if c.vip_only then
    select tier into v_tier from public.customers where id = p_customer_id;
    if v_tier is distinct from 'vip' then
      raise exception 'invalid_coupon' using errcode = 'P0001', detail = 'vip_only';
    end if;
  end if;
  if c.max_uses is not null then
    select count(*) into v_used from public.coupon_usages u
      join public.orders o on o.id = u.order_id
     where u.coupon_id = c.id and o.status <> 'cancelled';
    if v_used >= c.max_uses then
      raise exception 'invalid_coupon' using errcode = 'P0001', detail = 'max_uses_reached';
    end if;
  end if;
  if c.max_uses_per_customer is not null then
    select count(*) into v_used from public.coupon_usages u
      join public.orders o on o.id = u.order_id
     where u.coupon_id = c.id and u.customer_id = p_customer_id and o.status <> 'cancelled';
    if v_used >= c.max_uses_per_customer then
      raise exception 'invalid_coupon' using errcode = 'P0001', detail = 'customer_limit_reached';
    end if;
  end if;

  coupon_id := c.id;
  if c.kind = 'percent' then
    discount := round(p_subtotal * c.value / 100, 2);
    if c.max_discount is not null then discount := least(discount, c.max_discount); end if;
  else
    discount := c.value;
  end if;
  discount := least(discount, p_subtotal);
  return next;
end $$;

-- تحرير الحجوزات النشطة لطلب: آمن عند التكرار (لا يحرر إلا ما هو active)
create or replace function private.release_order_reservations(p_order_id uuid, p_reason text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_inv public.inventory;
  v_count integer := 0;
begin
  for r in
    select id, variant_id, branch_id, quantity from public.stock_reservations
     where order_id = p_order_id and status = 'active'
     order by variant_id, branch_id
     for update
  loop
    update public.stock_reservations
       set status = 'released', closed_at = now(), close_reason = p_reason
     where id = r.id;
    update public.inventory
       set reserved = reserved - r.quantity, updated_at = now()
     where variant_id = r.variant_id and branch_id = r.branch_id
    returning * into v_inv;
    insert into public.inventory_movements
      (variant_id, branch_id, kind, reserved_delta, on_hand_after, reserved_after, order_id, note)
    values (r.variant_id, r.branch_id, 'release', -r.quantity, v_inv.on_hand, v_inv.reserved, p_order_id, p_reason);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- ---------------------------------------------------------------------
-- إنشاء الطلب (للزوار والعملاء) – كل الأسعار والخصومات تُحسب هنا
-- ---------------------------------------------------------------------
create or replace function public.place_order(p_order jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_name        text := trim(coalesce(p_order->>'customer_name', ''));
  v_phone       text := private.normalize_phone(p_order->>'phone');
  v_fulfillment public.fulfillment_method;
  v_payment     public.payment_method_code;
  v_zone        public.delivery_zones;
  v_address     text := nullif(trim(coalesce(p_order->>'address', '')), '');
  v_branch      uuid := private.default_branch_id();
  v_minutes     integer;
  v_expires     timestamptz;
  v_customer_id uuid;
  v_order_id    uuid;
  v_order_no    text;
  v_token       text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_lines       jsonb := '[]';
  v_line        jsonb;
  v_subtotal    numeric(12,2) := 0;
  v_discount    numeric(12,2) := 0;
  v_fee         numeric(12,2) := 0;
  v_coupon_id   uuid;
  v_allocated   numeric(12,2) := 0;
  v_line_disc   numeric(12,2);
  v_n           integer;
  v_i           integer := 0;
  v_has_stock   boolean := false;
  v_inv         public.inventory;
  r             record;
begin
  -- 1) التحقق من البيانات الأساسية
  if (select maintenance_mode or not is_published from public.store_settings) and not private.is_service_role()
     and not private.is_staff() then
    raise exception 'store_closed' using errcode = 'P0001';
  end if;
  if length(v_name) < 2 or length(v_name) > 100 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if v_phone !~ '^[0-9]{9,15}$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  if coalesce((p_order->>'terms_accepted')::boolean, false) is not true then
    raise exception 'terms_not_accepted' using errcode = '22023';
  end if;
  begin
    v_fulfillment := (p_order->>'fulfillment')::public.fulfillment_method;
    v_payment     := (p_order->>'payment_method')::public.payment_method_code;
  exception when others then
    raise exception 'invalid_fulfillment_or_payment' using errcode = '22023';
  end;
  if v_fulfillment is null or v_payment is null then
    raise exception 'invalid_fulfillment_or_payment' using errcode = '22023';
  end if;
  if not exists (select 1 from public.payment_methods where code = v_payment and is_enabled) then
    raise exception 'payment_method_disabled' using errcode = 'P0001';
  end if;
  if (v_payment = 'cash_on_delivery' and v_fulfillment <> 'delivery')
     or (v_payment = 'cash_in_store' and v_fulfillment <> 'pickup') then
    raise exception 'payment_fulfillment_mismatch' using errcode = '22023';
  end if;
  if v_fulfillment = 'delivery' then
    select * into v_zone from public.delivery_zones
     where id = nullif(p_order->>'delivery_zone_id', '')::uuid and is_active;
    if not found then raise exception 'invalid_delivery_zone' using errcode = '22023'; end if;
    if v_address is null or length(v_address) > 500 then
      raise exception 'invalid_address' using errcode = '22023';
    end if;
    v_fee := v_zone.fee;
  end if;
  if jsonb_typeof(p_order->'items') <> 'array' or jsonb_array_length(p_order->'items') = 0
     or jsonb_array_length(p_order->'items') > 50 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  -- 2) تجميع البنود حسب الخيار وحساب الأسعار من قاعدة البيانات (ترتيب ثابت لتجنب deadlock)
  for r in
    select x.variant_id, sum(x.quantity)::integer as quantity,
           string_agg(nullif(trim(x.notes), ''), ' | ') as notes
      from jsonb_to_recordset(p_order->'items') as x(variant_id uuid, quantity integer, notes text)
     group by x.variant_id
     order by x.variant_id
  loop
    if r.variant_id is null or r.quantity is null or r.quantity <= 0 or r.quantity > 100 then
      raise exception 'invalid_items' using errcode = '22023';
    end if;
    v_line := null;
    select to_jsonb(t) into v_line from (
      select v.id as variant_id, v.name as variant_name, v.color, v.size, v.material,
             p.id as product_id, p.name as product_name, p.availability_mode::text as mode,
             p.requires_measurement, private.effective_unit_price(v.id) as unit_price,
             r.quantity as quantity, r.notes as notes
        from public.product_variants v join public.products p on p.id = v.product_id
       where v.id = r.variant_id and v.is_active and p.status = 'active') t;
    if v_line is null then
      raise exception 'product_unavailable' using errcode = 'P0001', detail = r.variant_id::text;
    end if;
    if (v_line->>'requires_measurement')::boolean then
      raise exception 'requires_measurement' using errcode = 'P0001', detail = r.variant_id::text;
    end if;
    if v_line->>'mode' not in ('stock', 'made_to_order') or v_line->>'unit_price' is null then
      raise exception 'product_unavailable' using errcode = 'P0001', detail = r.variant_id::text;
    end if;
    v_subtotal := v_subtotal + (v_line->>'unit_price')::numeric * r.quantity;
    v_lines := v_lines || jsonb_build_array(v_line);
    if v_line->>'mode' = 'stock' then v_has_stock := true; end if;
  end loop;

  -- 3) العميل (لا نغيّر اسم عميل موجود ولا نربطه بحساب آخر)
  insert into public.customers (phone, name, auth_user_id, marketing_consent, marketing_consent_at)
  values (v_phone, v_name,
          case when auth.uid() is not null and not exists (select 1 from public.customers c where c.auth_user_id = auth.uid())
               then auth.uid() end,
          coalesce((p_order->>'marketing_consent')::boolean, false),
          case when coalesce((p_order->>'marketing_consent')::boolean, false) then now() end)
  on conflict (phone) do update
     set last_order_at = now(),
         marketing_consent = public.customers.marketing_consent or excluded.marketing_consent,
         marketing_consent_at = coalesce(public.customers.marketing_consent_at, excluded.marketing_consent_at)
  returning id into v_customer_id;

  -- 4) الكوبون
  if coalesce(trim(p_order->>'coupon_code'), '') <> '' then
    select e.coupon_id, e.discount into v_coupon_id, v_discount
      from private.evaluate_coupon(p_order->>'coupon_code', v_customer_id, v_subtotal) e;
  end if;

  -- 5) إنشاء الطلب
  select reservation_minutes into v_minutes from public.store_settings;
  v_expires := case when v_has_stock then now() + make_interval(mins => v_minutes) end;

  insert into public.orders (
    tracking_token_hash, branch_id, customer_id, customer_name, customer_phone, fulfillment,
    delivery_zone_id, address, customer_notes, payment_method, payment_status, coupon_id,
    subtotal, discount_total, delivery_fee, total, source, terms_accepted_at, reservation_expires_at)
  values (
    private.hash_token(v_token), v_branch, v_customer_id, v_name, v_phone, v_fulfillment,
    v_zone.id, case when v_fulfillment = 'delivery' then v_address end,
    left(nullif(trim(p_order->>'notes'), ''), 1000), v_payment,
    case when v_payment = 'bank_transfer' then 'awaiting_review'::public.payment_status else 'unpaid' end,
    v_coupon_id, v_subtotal, v_discount, v_fee, v_subtotal - v_discount + v_fee,
    left(nullif(trim(p_order->>'source'), ''), 50), now(), v_expires)
  returning id, order_number into v_order_id, v_order_no;

  -- 6) البنود + توزيع الخصم + الحجز الذري
  v_n := jsonb_array_length(v_lines);
  for v_line in select * from jsonb_array_elements(v_lines) loop
    v_i := v_i + 1;
    if v_i = v_n then
      v_line_disc := v_discount - v_allocated;  -- الباقي على آخر بند لتفادي فروقات التقريب
    elsif v_subtotal > 0 then
      v_line_disc := trunc(v_discount * (v_line->>'unit_price')::numeric * (v_line->>'quantity')::integer / v_subtotal, 2);
    else
      v_line_disc := 0;
    end if;
    v_allocated := v_allocated + v_line_disc;

    insert into public.order_items (
      order_id, product_id, variant_id, product_name_snapshot, variant_snapshot, customer_notes,
      quantity, unit_price_snapshot, discount_amount, is_stock_tracked)
    values (
      v_order_id, (v_line->>'product_id')::uuid, (v_line->>'variant_id')::uuid, v_line->>'product_name',
      jsonb_strip_nulls(jsonb_build_object('name', v_line->>'variant_name', 'color', v_line->>'color',
        'size', v_line->>'size', 'material', v_line->>'material')),
      left(v_line->>'notes', 500),
      (v_line->>'quantity')::integer, (v_line->>'unit_price')::numeric, v_line_disc,
      v_line->>'mode' = 'stock');

    if v_line->>'mode' = 'stock' then
      -- تحديث شرطي ذري: ينجح فقط إذا بقي المتاح كافياً بعد قفل الصف
      update public.inventory
         set reserved = reserved + (v_line->>'quantity')::integer, updated_at = now()
       where variant_id = (v_line->>'variant_id')::uuid and branch_id = v_branch
         and on_hand - reserved >= (v_line->>'quantity')::integer
      returning * into v_inv;
      if not found then
        raise exception 'insufficient_stock' using errcode = 'P0001', detail = v_line->>'variant_id';
      end if;
      insert into public.stock_reservations (order_id, variant_id, branch_id, quantity, expires_at)
      values (v_order_id, (v_line->>'variant_id')::uuid, v_branch, (v_line->>'quantity')::integer, v_expires);
      insert into public.inventory_movements
        (variant_id, branch_id, kind, reserved_delta, on_hand_after, reserved_after, order_id, note)
      values ((v_line->>'variant_id')::uuid, v_branch, 'reserve', (v_line->>'quantity')::integer,
              v_inv.on_hand, v_inv.reserved, v_order_id, 'حجز طلب ' || v_order_no);
    end if;
  end loop;

  if v_coupon_id is not null then
    insert into public.coupon_usages (coupon_id, order_id, customer_id, amount)
    values (v_coupon_id, v_order_id, v_customer_id, v_discount);
  end if;

  perform private.record_status(v_order_id, null, 'received');
  perform private.enqueue_event('order.created', v_order_id,
    jsonb_build_object('order_number', v_order_no, 'total', v_subtotal - v_discount + v_fee));
  if v_payment = 'bank_transfer' then
    perform private.enqueue_event('payment.bank_transfer_selected', v_order_id,
      jsonb_build_object('order_number', v_order_no, 'total', v_subtotal - v_discount + v_fee));
  end if;

  return jsonb_build_object(
    'order_id', v_order_id, 'order_number', v_order_no, 'tracking_token', v_token,
    'subtotal', v_subtotal, 'discount', v_discount, 'delivery_fee', v_fee,
    'total', v_subtotal - v_discount + v_fee, 'reservation_expires_at', v_expires);
end $$;

-- ---------------------------------------------------------------------
-- تأكيد الطلب: يحوّل الحجز إلى خصم نهائي ويحفظ لقطة التكلفة
-- ---------------------------------------------------------------------
create or replace function public.confirm_order(p_order_id uuid, p_note text default null)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  r record;
  v_inv public.inventory;
begin
  perform private.require_permission('orders.manage');
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  if o.status not in ('received', 'awaiting_confirmation') then
    raise exception 'invalid_transition: % -> confirmed', o.status using errcode = 'P0001';
  end if;
  if o.reservation_expires_at is not null and o.reservation_expires_at <= now() then
    raise exception 'reservation_expired' using errcode = 'P0001';
  end if;

  for r in
    select id, variant_id, branch_id, quantity from public.stock_reservations
     where order_id = p_order_id and status = 'active'
     order by variant_id, branch_id
     for update
  loop
    update public.inventory
       set on_hand = on_hand - r.quantity, reserved = reserved - r.quantity, updated_at = now()
     where variant_id = r.variant_id and branch_id = r.branch_id
    returning * into v_inv;
    update public.stock_reservations set status = 'consumed', closed_at = now(), close_reason = 'confirmed'
     where id = r.id;
    insert into public.inventory_movements
      (variant_id, branch_id, kind, on_hand_delta, reserved_delta, on_hand_after, reserved_after, order_id, note)
    values (r.variant_id, r.branch_id, 'sale_online', -r.quantity, -r.quantity,
            v_inv.on_hand, v_inv.reserved, p_order_id, 'تأكيد ' || o.order_number);
  end loop;

  -- لقطة التكلفة وقت التأكيد (لا تتغير لاحقاً بتعديل المنتج)
  update public.order_items oi set unit_cost_snapshot = vc.unit_cost
    from public.variant_costs vc
   where oi.order_id = p_order_id and vc.variant_id = oi.variant_id;

  perform private.record_status(p_order_id, o.status, 'confirmed', p_note);
  update public.orders set status = 'confirmed', confirmed_at = now()
   where id = p_order_id returning * into o;
  perform private.enqueue_event('order.status_changed', p_order_id,
    jsonb_build_object('order_number', o.order_number, 'status', 'confirmed'));
  perform private.log_activity('order.confirm', 'orders', p_order_id::text, null,
    jsonb_build_object('status', 'confirmed'), p_note);
  return o;
end $$;

-- ---------------------------------------------------------------------
-- تغيير حالة الطلب حسب مسار مسموح
-- ---------------------------------------------------------------------
create or replace function public.update_order_status(
  p_order_id uuid, p_status public.order_status, p_note text default null)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  v_from public.order_status;
  v_ok boolean;
begin
  perform private.require_permission('orders.manage');
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  v_from := o.status;
  v_ok := case
    when v_from = 'received' and p_status = 'awaiting_confirmation' then true
    when v_from = 'confirmed' and p_status = 'preparing' then true
    when v_from = 'preparing' and p_status = 'ready_for_pickup' and o.fulfillment = 'pickup' then true
    when v_from = 'preparing' and p_status = 'out_for_delivery' and o.fulfillment = 'delivery' then true
    when v_from in ('ready_for_pickup', 'out_for_delivery') and p_status = 'delivered' then true
    else false end;
  if not v_ok then
    raise exception 'invalid_transition: % -> %', v_from, p_status using errcode = 'P0001';
  end if;
  if v_from = 'received' and o.reservation_expires_at is not null and o.reservation_expires_at <= now() then
    raise exception 'reservation_expired' using errcode = 'P0001';
  end if;

  update public.orders set status = p_status,
    preparing_at = case when p_status = 'preparing' then now() else preparing_at end,
    out_for_delivery_at = case when p_status = 'out_for_delivery' then now() else out_for_delivery_at end,
    delivered_at = case when p_status = 'delivered' then now() else delivered_at end
   where id = p_order_id returning * into o;

  perform private.record_status(p_order_id, v_from, p_status, p_note);
  perform private.enqueue_event('order.status_changed', p_order_id,
    jsonb_build_object('order_number', o.order_number, 'status', p_status));
  perform private.log_activity('order.status', 'orders', p_order_id::text,
    jsonb_build_object('status', v_from), jsonb_build_object('status', p_status), p_note);
  return o;
end $$;

-- ---------------------------------------------------------------------
-- إلغاء الطلب: قبل التأكيد يحرر الحجز، وبعده يعيد الكمية للمخزون
-- بعد بدء التجهيز يتطلب p_force (موافقة صريحة من الإدارة)
-- ---------------------------------------------------------------------
create or replace function public.cancel_order(
  p_order_id uuid, p_reason text, p_force boolean default false)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  r record;
  v_inv public.inventory;
  v_from public.order_status;
begin
  perform private.require_permission('orders.manage');
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'reason is required' using errcode = '22023';
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  v_from := o.status;
  if v_from in ('delivered', 'cancelled') then
    raise exception 'invalid_transition: % -> cancelled', v_from using errcode = 'P0001';
  end if;
  if v_from in ('preparing', 'ready_for_pickup', 'out_for_delivery') and not p_force then
    raise exception 'requires_admin_approval' using errcode = 'P0001';
  end if;

  if v_from in ('received', 'awaiting_confirmation') then
    perform private.release_order_reservations(p_order_id, 'cancelled: ' || p_reason);
  else
    -- المخزون خُصم نهائياً عند التأكيد: نعيده مرة واحدة (الحالة مقفلة وتصبح cancelled)
    for r in
      select variant_id, branch_id, quantity from public.stock_reservations
       where order_id = p_order_id and status = 'consumed'
       order by variant_id, branch_id
    loop
      update public.inventory set on_hand = on_hand + r.quantity, updated_at = now()
       where variant_id = r.variant_id and branch_id = r.branch_id
      returning * into v_inv;
      insert into public.inventory_movements
        (variant_id, branch_id, kind, on_hand_delta, on_hand_after, reserved_after, order_id, note)
      values (r.variant_id, r.branch_id, 'cancellation_restock', r.quantity,
              v_inv.on_hand, v_inv.reserved, p_order_id, p_reason);
    end loop;
  end if;

  update public.orders set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason
   where id = p_order_id returning * into o;
  perform private.record_status(p_order_id, v_from, 'cancelled', p_reason);
  perform private.enqueue_event('order.status_changed', p_order_id,
    jsonb_build_object('order_number', o.order_number, 'status', 'cancelled'));
  perform private.log_activity('order.cancel', 'orders', p_order_id::text,
    jsonb_build_object('status', v_from), jsonb_build_object('status', 'cancelled', 'forced', p_force), p_reason);
  return o;
end $$;

-- ---------------------------------------------------------------------
-- انتهاء الحجوزات: تُستدعى دورياً (pg_cron أو الخادم). آمنة عند التكرار والتزامن.
-- ---------------------------------------------------------------------
create or replace function public.release_expired_reservations(p_limit integer default 200)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  o record;
  v_count integer := 0;
begin
  if not (private.is_service_role() or private.has_permission('orders.manage')
          -- pg_cron يعمل بجلسة postgres؛ current_user هنا هو مالك الدالة دائماً فلا يصلح للفحص
          or session_user = 'postgres') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  for o in
    select id, order_number, status from public.orders
     where status in ('received', 'awaiting_confirmation')
       and reservation_expires_at <= now()
     order by reservation_expires_at
     limit p_limit
     for update skip locked
  loop
    perform private.release_order_reservations(o.id, 'reservation_expired');
    update public.orders set status = 'cancelled', cancelled_at = now(), cancel_reason = 'reservation_expired'
     where id = o.id;
    perform private.record_status(o.id, o.status, 'cancelled', 'انتهت مدة الحجز دون تأكيد');
    perform private.enqueue_event('reservation.expired', o.id, jsonb_build_object('order_number', o.order_number));
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- ---------------------------------------------------------------------
-- المالية: ربح المدير اليدوي لكل بند
-- ---------------------------------------------------------------------
create or replace function public.set_item_profit(p_order_item_id uuid, p_amount numeric)
returns public.order_items
language plpgsql security definer set search_path = '' as $$
declare
  it public.order_items;
  v_status public.order_status;
  v_old numeric;
begin
  perform private.require_permission('finance.manage');
  if p_amount is null or p_amount < 0 or p_amount <> round(p_amount, 2) then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  select oi.* into it from public.order_items oi where oi.id = p_order_item_id for update;
  if not found then raise exception 'order_item_not_found' using errcode = 'P0002'; end if;
  select status into v_status from public.orders where id = it.order_id;
  if v_status in ('received', 'awaiting_confirmation', 'cancelled') then
    raise exception 'order_not_confirmed' using errcode = 'P0001';
  end if;
  if p_amount > it.net_line_amount then
    raise exception 'profit_exceeds_net_line' using errcode = '23514';
  end if;
  v_old := it.manager_profit_amount;
  update public.order_items set manager_profit_amount = p_amount, profit_set_at = now()
   where id = p_order_item_id returning * into it;
  perform private.log_activity('finance.set_profit', 'order_items', p_order_item_id::text,
    jsonb_build_object('manager_profit_amount', v_old), jsonb_build_object('manager_profit_amount', p_amount));
  return it;
end $$;

-- مراجعة التحويل البنكي يدوياً
create or replace function public.review_bank_transfer(
  p_order_id uuid, p_approved boolean, p_amount numeric default null,
  p_reference text default null, p_note text default null)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  perform private.require_permission('orders.manage');
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  if o.payment_method <> 'bank_transfer' or o.payment_status not in ('awaiting_review', 'rejected') then
    raise exception 'payment_not_reviewable' using errcode = 'P0001';
  end if;
  insert into public.payment_reviews (order_id, approved, amount, reference, note)
  values (p_order_id, p_approved, p_amount, p_reference, p_note);
  update public.orders set payment_status = case when p_approved then 'paid'::public.payment_status else 'rejected' end
   where id = p_order_id returning * into o;
  perform private.log_activity('payment.review', 'orders', p_order_id::text, null,
    jsonb_build_object('approved', p_approved, 'amount', p_amount), p_note);
  return o;
end $$;

create or replace function public.add_order_note(p_order_id uuid, p_body text)
returns public.order_notes
language plpgsql security definer set search_path = '' as $$
declare n public.order_notes;
begin
  perform private.require_permission('orders.read');
  insert into public.order_notes (order_id, body) values (p_order_id, p_body) returning * into n;
  return n;
end $$;

-- تعديل العنوان قبل خروج الطلب للتوصيل
create or replace function public.update_order_address(p_order_id uuid, p_address text, p_note text default null)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare o public.orders; v_old text;
begin
  perform private.require_permission('orders.manage');
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  if o.fulfillment <> 'delivery' or o.status in ('out_for_delivery', 'delivered', 'cancelled') then
    raise exception 'address_locked' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_address), '') = '' then raise exception 'invalid_address' using errcode = '22023'; end if;
  v_old := o.address;
  update public.orders set address = trim(p_address) where id = p_order_id returning * into o;
  perform private.log_activity('order.address', 'orders', p_order_id::text,
    jsonb_build_object('address', v_old), jsonb_build_object('address', o.address), p_note);
  return o;
end $$;

-- ---------------------------------------------------------------------
-- تتبع الطلب للعميل: رقم الطلب + الرمز السري، بلا أي بيانات داخلية
-- ---------------------------------------------------------------------
create or replace function public.track_order(p_order_number text, p_token text)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'order_number', o.order_number, 'status', o.status, 'created_at', o.created_at,
    'fulfillment', o.fulfillment, 'payment_method', o.payment_method, 'payment_status', o.payment_status,
    'subtotal', o.subtotal, 'discount', o.discount_total, 'delivery_fee', o.delivery_fee, 'total', o.total,
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
                'name', i.product_name_snapshot, 'variant', i.variant_snapshot,
                'quantity', i.quantity, 'unit_price', i.unit_price_snapshot,
                'line_total', i.net_line_amount) order by i.created_at), '[]')
              from public.order_items i where i.order_id = o.id),
    'history', (select coalesce(jsonb_agg(jsonb_build_object('status', h.to_status, 'at', h.created_at)
                order by h.created_at), '[]')
              from public.order_status_history h where h.order_id = o.id))
  from public.orders o
  where o.order_number = p_order_number
    and o.tracking_token_hash = private.hash_token(coalesce(p_token, ''))
$$;

-- ---------------------------------------------------------------------
-- صندوق الأحداث لـ n8n (service_role فقط)
-- ---------------------------------------------------------------------
create or replace function public.claim_outbox_events(p_limit integer default 20)
returns setof public.notification_outbox
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_service_role() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  update public.notification_outbox n
     set status = 'processing', locked_at = now(), attempts = n.attempts + 1
   where n.id in (
     select id from public.notification_outbox
      where (status in ('pending', 'failed') and next_attempt_at <= now())
         or (status = 'processing' and locked_at < now() - interval '10 minutes')
      order by id limit p_limit
      for update skip locked)
  returning n.*;
end $$;

create or replace function public.complete_outbox_event(
  p_event_id uuid, p_success boolean, p_error text default null, p_max_attempts integer default 5)
returns public.notification_outbox
language plpgsql security definer set search_path = '' as $$
declare n public.notification_outbox;
begin
  if not private.is_service_role() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.notification_outbox set
    status = case when p_success then 'sent'::public.outbox_status
                  when attempts >= p_max_attempts then 'dead'
                  else 'failed' end,
    sent_at = case when p_success then now() end,
    last_error = case when p_success then null else left(p_error, 1000) end,
    next_attempt_at = case when p_success then next_attempt_at
                           else now() + make_interval(mins => least(60, (2 ^ attempts)::integer)) end,
    locked_at = null
  where event_id = p_event_id and status = 'processing'
  returning * into n;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- الصلاحيات على الدوال
-- ---------------------------------------------------------------------
revoke all on function public.place_order(jsonb) from public;
revoke all on function public.track_order(text, text) from public;
revoke all on function public.confirm_order(uuid, text) from public, anon;
revoke all on function public.update_order_status(uuid, public.order_status, text) from public, anon;
revoke all on function public.cancel_order(uuid, text, boolean) from public, anon;
revoke all on function public.release_expired_reservations(integer) from public, anon, authenticated;
revoke all on function public.set_item_profit(uuid, numeric) from public, anon;
revoke all on function public.review_bank_transfer(uuid, boolean, numeric, text, text) from public, anon;
revoke all on function public.add_order_note(uuid, text) from public, anon;
revoke all on function public.update_order_address(uuid, text, text) from public, anon;
revoke all on function public.claim_outbox_events(integer) from public, anon, authenticated;
revoke all on function public.complete_outbox_event(uuid, boolean, text, integer) from public, anon, authenticated;

grant execute on function public.place_order(jsonb) to anon, authenticated, service_role;
grant execute on function public.track_order(text, text) to anon, authenticated, service_role;
grant execute on function public.confirm_order(uuid, text) to authenticated, service_role;
grant execute on function public.update_order_status(uuid, public.order_status, text) to authenticated, service_role;
grant execute on function public.cancel_order(uuid, text, boolean) to authenticated, service_role;
grant execute on function public.release_expired_reservations(integer) to service_role;
grant execute on function public.set_item_profit(uuid, numeric) to authenticated, service_role;
grant execute on function public.review_bank_transfer(uuid, boolean, numeric, text, text) to authenticated, service_role;
grant execute on function public.add_order_note(uuid, text) to authenticated, service_role;
grant execute on function public.update_order_address(uuid, text, text) to authenticated, service_role;
grant execute on function public.claim_outbox_events(integer) to service_role;
grant execute on function public.complete_outbox_event(uuid, boolean, text, integer) to service_role;

-- الدوال الداخلية لا تُستدعى من الخارج
revoke all on all functions in schema private from anon, authenticated;
grant execute on function private.is_service_role() to anon, authenticated, service_role;
grant execute on function private.has_permission(text) to anon, authenticated, service_role;
grant execute on function private.is_staff() to anon, authenticated, service_role;
grant execute on function private.require_permission(text) to anon, authenticated, service_role;
grant execute on function private.default_branch_id() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- RLS: الجداول التشغيلية تُقرأ للموظفين فقط، والكتابة عبر الدوال فقط
-- ---------------------------------------------------------------------
alter table public.customers            enable row level security;
alter table public.customer_addresses   enable row level security;
alter table public.delivery_zones       enable row level security;
alter table public.payment_methods      enable row level security;
alter table public.bank_accounts        enable row level security;
alter table public.coupons              enable row level security;
alter table public.coupon_usages        enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.stock_reservations   enable row level security;
alter table public.order_status_history enable row level security;
alter table public.order_notes          enable row level security;
alter table public.payment_reviews      enable row level security;
alter table public.notification_outbox  enable row level security;

create policy delivery_zones_read on public.delivery_zones for select using (is_active or private.is_staff());
create policy delivery_zones_manage on public.delivery_zones for all
  using (private.has_permission('settings.manage')) with check (private.has_permission('settings.manage'));
create policy payment_methods_read on public.payment_methods for select using (is_enabled or private.is_staff());
create policy payment_methods_manage on public.payment_methods for update
  using (private.has_permission('settings.manage')) with check (private.has_permission('settings.manage'));
create policy bank_accounts_read on public.bank_accounts for select using (is_active or private.is_staff());
create policy bank_accounts_manage on public.bank_accounts for all
  using (private.has_permission('settings.manage')) with check (private.has_permission('settings.manage'));

create policy customers_read on public.customers for select
  using (private.has_permission('orders.read') or auth_user_id = auth.uid());
create policy customers_manage on public.customers for update
  using (private.has_permission('orders.manage')) with check (private.has_permission('orders.manage'));
create policy customer_addresses_read on public.customer_addresses for select
  using (private.has_permission('orders.read'));

create policy coupons_read on public.coupons for select using (private.has_permission('catalog.manage'));
create policy coupons_manage on public.coupons for all
  using (private.has_permission('catalog.manage')) with check (private.has_permission('catalog.manage'));
create policy coupon_usages_read on public.coupon_usages for select using (private.has_permission('orders.read'));

create policy orders_read on public.orders for select using (private.has_permission('orders.read'));
-- بنود الطلب تحتوي التكلفة والربح: صلاحية المالية فقط. العميل يرى طلبه عبر track_order
create policy order_items_read on public.order_items for select using (private.has_permission('finance.read'));
create policy stock_reservations_read on public.stock_reservations for select using (private.is_staff());
create policy order_status_history_read on public.order_status_history for select
  using (private.has_permission('orders.read'));
create policy order_notes_read on public.order_notes for select using (private.has_permission('orders.read'));
create policy payment_reviews_read on public.payment_reviews for select using (private.has_permission('orders.read'));
create policy notification_outbox_read on public.notification_outbox for select
  using (private.has_permission('settings.manage'));

revoke all on public.customers, public.customer_addresses, public.coupons, public.coupon_usages,
  public.orders, public.order_items, public.stock_reservations, public.order_status_history,
  public.order_notes, public.payment_reviews, public.notification_outbox
  from anon;
revoke insert, delete, truncate on public.customers from authenticated;
revoke insert, update, delete, truncate on public.customer_addresses, public.coupon_usages,
  public.orders, public.order_items, public.stock_reservations, public.order_status_history,
  public.order_notes, public.payment_reviews, public.notification_outbox
  from authenticated;
revoke update, delete, truncate on public.order_status_history, public.payment_reviews from service_role;
revoke usage, select on sequence public.order_number_seq from anon, authenticated;

create trigger coupons_audit after insert or update or delete on public.coupons
  for each row execute function private.audit_row();
create trigger delivery_zones_audit after insert or update or delete on public.delivery_zones
  for each row execute function private.audit_row();
create trigger bank_accounts_audit after insert or update or delete on public.bank_accounts
  for each row execute function private.audit_row();
create trigger payment_methods_audit after update on public.payment_methods
  for each row execute function private.audit_row();
