-- =====================================================================
-- 0002 الكتالوج: الوحدات، التصنيفات، المنتجات، الخيارات، الصور، التكاليف، المخزون
-- =====================================================================

create type public.product_status as enum ('draft', 'active', 'archived');
-- stock: حسب الكمية المسجلة | made_to_order: حسب الطلب | coming_soon: قريباً | unavailable: غير متوفر
create type public.availability_mode as enum ('stock', 'made_to_order', 'coming_soon', 'unavailable');
create type public.media_kind as enum ('image', 'video');

create table public.units (
  id          smallint generated always as identity primary key,
  code        text not null unique check (code ~ '^[a-z_0-9]+$'),
  name_ar     text not null,
  is_active   boolean not null default true
);
insert into public.units (code, name_ar) values
  ('piece', 'قطعة'), ('meter', 'متر'), ('sqm', 'متر مربع'), ('set', 'طقم'), ('pair', 'زوج');

create table public.categories (
  id               uuid primary key default gen_random_uuid(),
  parent_id        uuid references public.categories(id) on delete restrict,
  slug             text not null unique check (slug ~ '^[^\s/?#]+$'),
  name             text not null,
  description      text,
  image_url        text,
  sort_order       integer not null default 0,
  is_active        boolean not null default true,
  seo_title        text,
  seo_description  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);
create index categories_parent_idx on public.categories(parent_id);
create trigger categories_touch before update on public.categories
  for each row execute function private.touch_updated_at();

insert into public.categories (slug, name, sort_order) values
  ('سجاد-وموكيت', 'السجاد والموكيت', 1),
  ('ستائر', 'الستائر', 2),
  ('مراتب-ومفروشات', 'المراتب والمفروشات', 3),
  ('بطانيات-ولحف', 'البطانيات واللحف', 4),
  ('شراشف', 'الشراشف', 5),
  ('مخدات', 'المخدات', 6),
  ('مفروشات-منزلية', 'مفروشات منزلية متنوعة', 7);

create table public.products (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique check (slug ~ '^[^\s/?#]+$'),
  name                  text not null check (length(trim(name)) > 0),
  description           text,
  category_id           uuid references public.categories(id) on delete restrict,
  unit_id               smallint not null references public.units(id),
  status                public.product_status not null default 'draft',
  availability_mode     public.availability_mode not null default 'stock',
  -- منتجات القياس/التفصيل: لا سعر معروض، وتُطلب عبر نموذج الطلب الخاص وWhatsApp
  requires_measurement  boolean not null default false,
  price                 numeric(12,2) check (price >= 0),
  sale_price            numeric(12,2) check (sale_price >= 0),
  sale_starts_at        timestamptz,
  sale_ends_at          timestamptz,
  prep_days_min         smallint check (prep_days_min >= 0),
  prep_days_max         smallint check (prep_days_max >= 0),
  is_featured           boolean not null default false,
  low_stock_threshold   integer not null default 2 check (low_stock_threshold >= 0),
  materials             text[] not null default '{}',
  seo_title             text,
  seo_description       text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (sale_price is null or price is null or sale_price < price),
  check (prep_days_max is null or prep_days_min is null or prep_days_max >= prep_days_min),
  check (sale_ends_at is null or sale_starts_at is null or sale_ends_at > sale_starts_at),
  -- المنتج الذي يباع بسعر ثابت يجب أن يملك سعراً عند نشره
  check (requires_measurement or status <> 'active' or price is not null)
);
create index products_category_idx on public.products(category_id);
create index products_status_idx on public.products(status);
create index products_featured_idx on public.products(is_featured) where is_featured;
create trigger products_touch before update on public.products
  for each row execute function private.touch_updated_at();

create table public.product_variants (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products(id) on delete cascade,
  sku             text unique,
  name            text not null default 'افتراضي',
  color           text,
  size            text,
  material        text,
  price_override  numeric(12,2) check (price_override >= 0),
  is_default      boolean not null default false,
  is_active       boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index product_variants_product_idx on public.product_variants(product_id);
create unique index product_variants_one_default on public.product_variants(product_id) where is_default;
create trigger product_variants_touch before update on public.product_variants
  for each row execute function private.touch_updated_at();

create table public.product_media (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  kind        public.media_kind not null default 'image',
  url         text not null,
  alt         text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index product_media_product_idx on public.product_media(product_id, sort_order);

-- حد أقصى 10 صور لكل منتج (الحد الأدنى 5 يُفحص عند النشر في لوحة التحكم)
create or replace function private.enforce_media_limit()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.kind = 'image' and (
    select count(*) from public.product_media
    where product_id = new.product_id and kind = 'image' and id <> new.id) >= 10 then
    raise exception 'product_media: max 10 images per product' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger product_media_limit before insert or update on public.product_media
  for each row execute function private.enforce_media_limit();

-- التكلفة الداخلية: جدول منفصل، لا يقرؤه إلا صاحب صلاحية المالية
create table public.variant_costs (
  variant_id  uuid primary key references public.product_variants(id) on delete cascade,
  unit_cost   numeric(12,2) not null check (unit_cost >= 0),
  updated_at  timestamptz not null default now()
);
create trigger variant_costs_touch before update on public.variant_costs
  for each row execute function private.touch_updated_at();

-- المخزون لكل خيار ولكل فرع
create table public.inventory (
  variant_id  uuid not null references public.product_variants(id) on delete restrict,
  branch_id   uuid not null references public.branches(id) on delete restrict,
  on_hand     integer not null default 0,
  reserved    integer not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (variant_id, branch_id),
  constraint inventory_non_negative check (on_hand >= 0 and reserved >= 0),
  constraint inventory_reserved_le_on_hand check (reserved <= on_hand)
);

create type public.inventory_movement_kind as enum (
  'initial', 'adjustment', 'reserve', 'release', 'sale_online', 'sale_in_store',
  'stocktake', 'cancellation_restock', 'return_restock');

create table public.inventory_movements (
  id              bigint generated always as identity primary key,
  variant_id      uuid not null references public.product_variants(id),
  branch_id       uuid not null references public.branches(id),
  kind            public.inventory_movement_kind not null,
  on_hand_delta   integer not null default 0,
  reserved_delta  integer not null default 0,
  on_hand_after   integer not null,
  reserved_after  integer not null,
  order_id        uuid,
  note            text,
  actor_id        uuid default auth.uid(),
  created_at      timestamptz not null default now()
);
create index inventory_movements_variant_idx on public.inventory_movements(variant_id, created_at desc);
create index inventory_movements_order_idx on public.inventory_movements(order_id);
create trigger inventory_movements_no_update before update or delete on public.inventory_movements
  for each row execute function private.forbid_mutation();

-- كل خيار جديد يحصل على صف مخزون في الفرع الافتراضي
create or replace function private.create_inventory_row()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.inventory (variant_id, branch_id)
  values (new.id, private.default_branch_id())
  on conflict do nothing;
  return new;
end $$;
create trigger product_variants_inventory after insert on public.product_variants
  for each row execute function private.create_inventory_row();

-- ---------------------------------------------------------------------
-- السعر الفعّال (يُحسب في الخادم دائماً)
-- ---------------------------------------------------------------------
create or replace function private.effective_unit_price(p_variant_id uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(
    v.price_override,
    case when p.sale_price is not null
          and (p.sale_starts_at is null or p.sale_starts_at <= now())
          and (p.sale_ends_at is null or p.sale_ends_at > now())
         then p.sale_price end,
    p.price)
  from public.product_variants v
  join public.products p on p.id = v.product_id
  where v.id = p_variant_id
$$;

-- ---------------------------------------------------------------------
-- حالة التوفر للعميل دون كشف الكمية
-- ---------------------------------------------------------------------
create or replace function public.get_variant_availability(p_variant_ids uuid[])
returns table (variant_id uuid, availability text)
language sql stable security definer set search_path = '' as $$
  select v.id,
    case
      when p.status <> 'active' or not v.is_active then 'unavailable'
      when p.availability_mode = 'made_to_order' or p.requires_measurement then 'made_to_order'
      when p.availability_mode = 'coming_soon' then 'coming_soon'
      when p.availability_mode = 'unavailable' then 'unavailable'
      when coalesce(sum(i.on_hand - i.reserved), 0) <= 0 then 'out_of_stock'
      when coalesce(sum(i.on_hand - i.reserved), 0) <= p.low_stock_threshold then 'limited'
      else 'in_stock'
    end
  from unnest(p_variant_ids) as req(id)
  join public.product_variants v on v.id = req.id
  join public.products p on p.id = v.product_id
  left join public.inventory i on i.variant_id = v.id
  group by v.id, v.is_active, p.status, p.availability_mode, p.requires_measurement, p.low_stock_threshold
$$;
revoke all on function public.get_variant_availability(uuid[]) from public;
grant execute on function public.get_variant_availability(uuid[]) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- عمليات المخزون الإدارية (لا يُعدّل جدول inventory مباشرة أبداً)
-- ---------------------------------------------------------------------
create or replace function public.adjust_inventory(
  p_variant_id uuid, p_new_on_hand integer, p_reason text,
  p_kind public.inventory_movement_kind default 'adjustment', p_branch_id uuid default null)
returns public.inventory
language plpgsql security definer set search_path = '' as $$
declare
  v_branch uuid := coalesce(p_branch_id, private.default_branch_id());
  v_inv public.inventory;
  v_old integer;
begin
  perform private.require_permission('inventory.manage');
  if p_kind not in ('initial', 'adjustment', 'stocktake') then
    raise exception 'invalid movement kind for adjustment: %', p_kind using errcode = '22023';
  end if;
  if p_new_on_hand is null or p_new_on_hand < 0 then
    raise exception 'quantity must be >= 0' using errcode = '22023';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'reason is required' using errcode = '22023';
  end if;

  select * into v_inv from public.inventory
  where variant_id = p_variant_id and branch_id = v_branch for update;
  if not found then
    raise exception 'inventory row not found' using errcode = 'P0002';
  end if;
  if p_new_on_hand < v_inv.reserved then
    raise exception 'new quantity (%) is below reserved quantity (%)', p_new_on_hand, v_inv.reserved
      using errcode = '23514';
  end if;

  v_old := v_inv.on_hand;
  update public.inventory set on_hand = p_new_on_hand, updated_at = now()
  where variant_id = p_variant_id and branch_id = v_branch
  returning * into v_inv;

  insert into public.inventory_movements
    (variant_id, branch_id, kind, on_hand_delta, on_hand_after, reserved_after, note)
  values (p_variant_id, v_branch, p_kind, p_new_on_hand - v_old, v_inv.on_hand, v_inv.reserved, p_reason);

  perform private.log_activity('inventory.adjust', 'inventory', p_variant_id::text,
    jsonb_build_object('on_hand', v_old), jsonb_build_object('on_hand', p_new_on_hand), p_reason);
  return v_inv;
end $$;

-- بيع داخل المحل: يخصم من المتاح فقط (لا يمس الكميات المحجوزة لطلبات أونلاين)
create or replace function public.record_in_store_sale(
  p_variant_id uuid, p_quantity integer, p_note text default null, p_branch_id uuid default null)
returns public.inventory
language plpgsql security definer set search_path = '' as $$
declare
  v_branch uuid := coalesce(p_branch_id, private.default_branch_id());
  v_inv public.inventory;
begin
  perform private.require_permission('inventory.manage');
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be > 0' using errcode = '22023';
  end if;

  update public.inventory
     set on_hand = on_hand - p_quantity, updated_at = now()
   where variant_id = p_variant_id and branch_id = v_branch
     and on_hand - reserved >= p_quantity
  returning * into v_inv;
  if not found then
    raise exception 'insufficient_stock' using errcode = 'P0001';
  end if;

  insert into public.inventory_movements
    (variant_id, branch_id, kind, on_hand_delta, on_hand_after, reserved_after, note)
  values (p_variant_id, v_branch, 'sale_in_store', -p_quantity, v_inv.on_hand, v_inv.reserved, p_note);

  perform private.log_activity('inventory.sale_in_store', 'inventory', p_variant_id::text,
    null, jsonb_build_object('quantity', p_quantity), p_note);
  return v_inv;
end $$;

revoke all on function public.adjust_inventory(uuid, integer, text, public.inventory_movement_kind, uuid) from public, anon;
revoke all on function public.record_in_store_sale(uuid, integer, text, uuid) from public, anon;
grant execute on function public.adjust_inventory(uuid, integer, text, public.inventory_movement_kind, uuid) to authenticated, service_role;
grant execute on function public.record_in_store_sale(uuid, integer, text, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.units               enable row level security;
alter table public.categories          enable row level security;
alter table public.products            enable row level security;
alter table public.product_variants    enable row level security;
alter table public.product_media       enable row level security;
alter table public.variant_costs       enable row level security;
alter table public.inventory           enable row level security;
alter table public.inventory_movements enable row level security;

create policy units_read on public.units for select using (is_active or private.is_staff());
create policy units_manage on public.units for all
  using (private.has_permission('catalog.manage')) with check (private.has_permission('catalog.manage'));

create policy categories_read on public.categories for select using (is_active or private.is_staff());
create policy categories_manage on public.categories for all
  using (private.has_permission('catalog.manage')) with check (private.has_permission('catalog.manage'));

create policy products_read on public.products for select
  using (status = 'active' or private.is_staff());
create policy products_manage on public.products for all
  using (private.has_permission('catalog.manage')) with check (private.has_permission('catalog.manage'));

create policy product_variants_read on public.product_variants for select
  using (private.is_staff() or (is_active and exists (
    select 1 from public.products p where p.id = product_id and p.status = 'active')));
create policy product_variants_manage on public.product_variants for all
  using (private.has_permission('catalog.manage')) with check (private.has_permission('catalog.manage'));

create policy product_media_read on public.product_media for select
  using (private.is_staff() or exists (
    select 1 from public.products p where p.id = product_id and p.status = 'active'));
create policy product_media_manage on public.product_media for all
  using (private.has_permission('catalog.manage')) with check (private.has_permission('catalog.manage'));

create policy variant_costs_read on public.variant_costs for select
  using (private.has_permission('finance.read'));
create policy variant_costs_manage on public.variant_costs for all
  using (private.has_permission('finance.manage')) with check (private.has_permission('finance.manage'));

-- المخزون: قراءة للموظفين فقط، والتعديل عبر الدوال فقط
create policy inventory_staff_read on public.inventory for select using (private.is_staff());
create policy inventory_movements_staff_read on public.inventory_movements for select using (private.is_staff());

revoke all on public.variant_costs from anon;
revoke all on public.inventory, public.inventory_movements from anon;
revoke insert, update, delete, truncate on public.inventory, public.inventory_movements from authenticated;
revoke update, delete, truncate on public.inventory_movements from service_role;

-- تدقيق تغييرات الأسعار والتكاليف والمنتجات
create trigger products_audit after insert or update or delete on public.products
  for each row execute function private.audit_row();
create trigger product_variants_audit after insert or update or delete on public.product_variants
  for each row execute function private.audit_row();
create trigger variant_costs_audit after insert or update or delete on public.variant_costs
  for each row execute function private.audit_row();
create trigger categories_audit after insert or update or delete on public.categories
  for each row execute function private.audit_row();
