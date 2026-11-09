-- =====================================================================
-- 0015 التسويق والمحتوى: صفحات السياسات، معرّفات التحليلات، خريطة الموقع
-- =====================================================================

-- ---------------------------------------------------------------------
-- معرّفات التسويق (عامة بطبيعتها: تظهر في كود الصفحة لأي زائر)
-- ---------------------------------------------------------------------
alter table public.store_settings
  add column ga_measurement_id text
    check (ga_measurement_id ~ '^G-[A-Z0-9]{4,20}$'),
  add column meta_pixel_id text
    check (meta_pixel_id ~ '^[0-9]{8,20}$'),
  add column google_site_verification text
    check (google_site_verification ~ '^[A-Za-z0-9_-]{20,100}$');

-- ---------------------------------------------------------------------
-- صفحات السياسات: يكتبها المدير وينشرها بنفسه. لا يُنشر نص افتراضي.
-- ---------------------------------------------------------------------
create table public.store_policies (
  slug          text primary key check (slug in ('delivery', 'returns', 'privacy')),
  title         text not null check (length(trim(title)) between 2 and 120),
  body          text not null default '' check (length(body) <= 20000),
  is_published  boolean not null default false,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id) on delete set null,
  -- لا تُنشر صفحة فارغة أو فيها خانات لم تُملأ مثل [عدد الأيام]
  constraint store_policies_publish_ready check (
    not is_published or (length(trim(body)) >= 40 and body !~ '\[[^\]]*\]')
  )
);

insert into public.store_policies (slug, title) values
  ('delivery', 'سياسة التوصيل'),
  ('returns',  'سياسة الاستبدال والإرجاع'),
  ('privacy',  'سياسة الخصوصية');

create or replace function private.store_policies_stamp()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end $$;
create trigger store_policies_stamp before update on public.store_policies
  for each row execute function private.store_policies_stamp();
create trigger store_policies_audit after insert or update or delete on public.store_policies
  for each row execute function private.audit_row();

alter table public.store_policies enable row level security;
-- الزوار يرون المنشور فقط؛ الموظفون يرون الكل
create policy store_policies_read on public.store_policies for select
  using (is_published or private.is_staff());
-- التعديل لمن يملك صلاحية الإعدادات (لا إضافة ولا حذف: الصفحات ثابتة)
create policy store_policies_update on public.store_policies for update
  using (private.has_permission('settings.manage'))
  with check (private.has_permission('settings.manage'));

revoke all on public.store_policies from anon, authenticated;
grant select on public.store_policies to anon, authenticated;
grant update (title, body, is_published) on public.store_policies to authenticated;

-- ---------------------------------------------------------------------
-- واجهات عامة
-- ---------------------------------------------------------------------
-- السياسات المنشورة (للتذييل والصفحات)
create or replace function public.catalog_policies()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'slug', slug, 'title', title, 'body', body, 'updated_at', updated_at)
    order by array_position(array['delivery','returns','privacy'], slug)), '[]')
  from public.store_policies where is_published
$$;

-- خريطة الموقع: المنتجات الظاهرة للزبون والتصنيفات الفعّالة وتاريخ آخر تعديل
create or replace function public.catalog_sitemap()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'products', coalesce((
      select jsonb_agg(jsonb_build_object('slug', p.slug, 'updated_at', p.updated_at) order by p.updated_at desc)
      from public.products p where p.status = 'active'), '[]'),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('slug', c.slug, 'updated_at', c.updated_at) order by c.sort_order)
      from public.categories c where c.is_active), '[]'),
    'policies', coalesce((
      select jsonb_agg(jsonb_build_object('slug', s.slug, 'updated_at', s.updated_at))
      from public.store_policies s where s.is_published), '[]'))
$$;

-- الفروع الفعّالة (للبيانات المنظمة LocalBusiness)
create or replace function public.catalog_branches()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'name', b.name, 'address', b.address, 'phone', b.phone, 'map_url', b.map_url)
    order by b.is_default desc, b.created_at), '[]')
  from public.branches b where b.is_active
$$;

revoke all on function public.catalog_policies() from public;
revoke all on function public.catalog_sitemap() from public;
revoke all on function public.catalog_branches() from public;
grant execute on function public.catalog_policies() to anon, authenticated, service_role;
grant execute on function public.catalog_sitemap() to anon, authenticated, service_role;
grant execute on function public.catalog_branches() to anon, authenticated, service_role;
