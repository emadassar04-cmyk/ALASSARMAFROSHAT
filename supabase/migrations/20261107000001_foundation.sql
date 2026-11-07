-- =====================================================================
-- 0001 الأساس: المخطط الخاص، الأدوار والصلاحيات، سجل النشاط، الفروع والإعدادات
-- =====================================================================

-- مخطط خاص لا تعرضه واجهة Supabase API، للدوال المساعدة الداخلية
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- الدوال الجديدة لا تُمنح للجميع تلقائياً؛ نمنح كل دالة صراحةً
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from public;

-- ---------------------------------------------------------------------
-- أداة updated_at
-- ---------------------------------------------------------------------
create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- الأدوار والصلاحيات (مدير واحد حالياً، وبنية جاهزة للموظفين لاحقاً)
-- ---------------------------------------------------------------------
create table public.roles (
  id          smallint generated always as identity primary key,
  code        text not null unique check (code ~ '^[a-z_]+$'),
  name_ar     text not null,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.permissions (
  id          smallint generated always as identity primary key,
  code        text not null unique check (code ~ '^[a-z_.]+$'),
  description text not null
);

create table public.role_permissions (
  role_id       smallint not null references public.roles(id) on delete cascade,
  permission_id smallint not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role_id     smallint references public.roles(id),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index profiles_role_idx on public.profiles(role_id);
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

insert into public.roles (code, name_ar, is_system) values
  ('owner',     'مدير كامل', true),
  ('reception', 'موظف استقبال', true),
  ('inventory', 'موظف مخزون', true),
  ('fulfilment','موظف تجهيز', true),
  ('reports',   'موظف تقارير', true);

insert into public.permissions (code, description) values
  ('orders.read',      'عرض الطلبات'),
  ('orders.manage',    'تأكيد وتحديث وإلغاء الطلبات'),
  ('inventory.manage', 'تعديل المخزون والجرد'),
  ('catalog.manage',   'إدارة المنتجات والتصنيفات والأسعار'),
  ('finance.read',     'عرض التكاليف والأرباح والمستحقات'),
  ('finance.manage',   'إدخال الأرباح والمصروفات'),
  ('settings.manage',  'إعدادات المتجر والتكاملات'),
  ('audit.read',       'عرض سجل النشاط');

-- المدير الكامل يملك كل الصلاحيات
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p where r.code = 'owner';

-- ---------------------------------------------------------------------
-- دوال التحقق من الهوية
-- المدير يجب أن يكون دخل بخطوتين (aal2) حتى تعمل صلاحياته
-- ---------------------------------------------------------------------
create or replace function private.is_service_role()
returns boolean language sql stable set search_path = '' as $$
  select coalesce(auth.jwt()->>'role', '') = 'service_role'
$$;

create or replace function private.has_permission(p_code text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.profiles pr
    join public.role_permissions rp on rp.role_id = pr.role_id
    join public.permissions pe on pe.id = rp.permission_id
    where pr.id = auth.uid()
      and pr.is_active
      and pe.code = p_code
      and coalesce(auth.jwt()->>'aal', '') = 'aal2'
  )
$$;

create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.is_active and pr.role_id is not null
      and coalesce(auth.jwt()->>'aal', '') = 'aal2'
  )
$$;

-- يرمي خطأ إن لم يملك المستدعي الصلاحية (أو لم يكن service_role)
create or replace function private.require_permission(p_code text)
returns void language plpgsql stable set search_path = '' as $$
begin
  if not (private.is_service_role() or private.has_permission(p_code)) then
    raise exception 'forbidden: %', p_code using errcode = '42501';
  end if;
end $$;

grant execute on function private.is_service_role() to anon, authenticated, service_role;
grant execute on function private.has_permission(text) to anon, authenticated, service_role;
grant execute on function private.is_staff() to anon, authenticated, service_role;
grant execute on function private.require_permission(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- سجل النشاط: إضافة فقط (append-only)
-- ---------------------------------------------------------------------
create table public.activity_logs (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id    uuid,
  actor_role  text,
  action      text not null,
  entity      text not null,
  entity_id   text,
  old_values  jsonb,
  new_values  jsonb,
  note        text
);
create index activity_logs_entity_idx on public.activity_logs(entity, entity_id);
create index activity_logs_time_idx on public.activity_logs(occurred_at desc);

create or replace function private.forbid_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'append-only table: % on % is not allowed', tg_op, tg_table_name
    using errcode = '42501';
end $$;

create trigger activity_logs_no_update before update or delete on public.activity_logs
  for each row execute function private.forbid_mutation();
create trigger activity_logs_no_truncate before truncate on public.activity_logs
  for each statement execute function private.forbid_mutation();

create or replace function private.log_activity(
  p_action text, p_entity text, p_entity_id text,
  p_old jsonb default null, p_new jsonb default null, p_note text default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.activity_logs (actor_id, actor_role, action, entity, entity_id, old_values, new_values, note)
  values (auth.uid(), coalesce(auth.jwt()->>'role', current_user), p_action, p_entity, p_entity_id, p_old, p_new, p_note);
$$;

-- مشغل تدقيق عام: يسجل القيم القديمة والجديدة لأي جدول يُربط به
create or replace function private.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  v_id  text  := coalesce(v_new->>'id', v_new->>'variant_id', v_new->>'code',
                          v_old->>'id', v_old->>'variant_id', v_old->>'code');
begin
  if tg_op = 'UPDATE' and v_old = v_new then
    return new;
  end if;
  perform private.log_activity(lower(tg_op), tg_table_name, v_id, v_old, v_new);
  return coalesce(new, old);
end $$;

-- ---------------------------------------------------------------------
-- الفروع والإعدادات وساعات العمل
-- ---------------------------------------------------------------------
create table public.branches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text,
  map_url     text,
  phone       text,
  is_default  boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index branches_one_default on public.branches((true)) where is_default;

insert into public.branches (name, is_default) values ('المحل الرئيسي – دير البلح', true);

create or replace function private.default_branch_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.branches where is_default limit 1
$$;
grant execute on function private.default_branch_id() to anon, authenticated, service_role;

create table public.store_settings (
  id                     boolean primary key default true check (id), -- صف واحد فقط
  store_name             text not null default 'مفروشات العصار – دير البلح – النصيرات',
  whatsapp_number        text,
  contact_phone          text,
  currency               char(3) not null default 'ILS' check (currency = 'ILS'),
  timezone               text not null default 'Asia/Gaza',
  reservation_minutes    integer not null default 120 check (reservation_minutes between 15 and 1440),
  is_published           boolean not null default false,  -- لا ينشر المتجر تلقائياً
  maintenance_mode       boolean not null default false,
  setup_completed_steps  text[] not null default '{}',
  seo_title              text,
  seo_description        text,
  updated_at             timestamptz not null default now()
);
insert into public.store_settings default values;
create trigger store_settings_touch before update on public.store_settings
  for each row execute function private.touch_updated_at();

create table public.business_hours (
  id         bigint generated always as identity primary key,
  branch_id  uuid not null references public.branches(id) on delete cascade,
  weekday    smallint not null check (weekday between 0 and 6), -- 0 = الأحد
  opens_at   time not null,
  closes_at  time not null,
  check (closes_at > opens_at)
);
create index business_hours_branch_idx on public.business_hours(branch_id, weekday);

create table public.store_closures (
  id         bigint generated always as identity primary key,
  branch_id  uuid not null references public.branches(id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  reason     text,
  check (ends_at > starts_at)
);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.roles            enable row level security;
alter table public.permissions      enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles         enable row level security;
alter table public.activity_logs    enable row level security;
alter table public.branches         enable row level security;
alter table public.store_settings   enable row level security;
alter table public.business_hours   enable row level security;
alter table public.store_closures   enable row level security;

create policy roles_staff_read on public.roles for select using (private.is_staff());
create policy permissions_staff_read on public.permissions for select using (private.is_staff());
create policy role_permissions_staff_read on public.role_permissions for select using (private.is_staff());

create policy profiles_self_read on public.profiles for select
  using (id = auth.uid() or private.has_permission('settings.manage'));

create policy activity_logs_read on public.activity_logs for select
  using (private.has_permission('audit.read'));

create policy branches_public_read on public.branches for select using (is_active or private.is_staff());
create policy branches_manage on public.branches for all
  using (private.has_permission('settings.manage')) with check (private.has_permission('settings.manage'));

create policy store_settings_public_read on public.store_settings for select using (true);
create policy store_settings_manage on public.store_settings for update
  using (private.has_permission('settings.manage')) with check (private.has_permission('settings.manage'));

create policy business_hours_public_read on public.business_hours for select using (true);
create policy business_hours_manage on public.business_hours for all
  using (private.has_permission('settings.manage')) with check (private.has_permission('settings.manage'));

create policy store_closures_public_read on public.store_closures for select using (true);
create policy store_closures_manage on public.store_closures for all
  using (private.has_permission('settings.manage')) with check (private.has_permission('settings.manage'));

-- لا أحد يعدّل الأدوار أو سجل النشاط عبر API العادي
revoke insert, update, delete, truncate on public.roles, public.permissions, public.role_permissions
  from anon, authenticated;
revoke insert, update, delete, truncate on public.activity_logs from anon, authenticated, service_role;
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;

create trigger store_settings_audit after update on public.store_settings
  for each row execute function private.audit_row();
create trigger branches_audit after insert or update or delete on public.branches
  for each row execute function private.audit_row();
