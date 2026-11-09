-- =====================================================================
-- 0016 الفروع ومواقعها على الخريطة
-- - أعمدة جديدة: المدينة، الإحداثيات (لدبوس دقيق على الخريطة)، ترتيب العرض
-- - بيانات الفرعين كما أكدها صاحب المحل:
--     دير البلح (الرئيسي) – دوار البركة · النصيرات – مقابل Ooredoo · الجوال 0594793301
-- المخزون والطلبات تبقى على الفرع الرئيسي (المخزون مشترك)، فلا أثر لهذا التغيير على الحجز أو الحسابات.
-- =====================================================================

alter table public.branches
  add column city        text check (city is null or length(trim(city)) between 2 and 60),
  add column lat         numeric(9,6) check (lat is null or lat between -90 and 90),
  add column lng         numeric(9,6) check (lng is null or lng between -180 and 180),
  add column sort_order  integer not null default 0,
  add constraint branches_coords_pair check ((lat is null) = (lng is null)),
  add constraint branches_map_url_https check (map_url is null or map_url ~ '^https://'),
  add constraint branches_phone_format check (phone is null or phone ~ '^\+?[0-9 ]{9,16}$');

update public.branches
   set name = 'فرع دير البلح', city = 'دير البلح', address = 'دوار البركة',
       phone = '+970594793301', sort_order = 1
 where is_default;

insert into public.branches (name, city, address, phone, is_default, is_active, sort_order)
select 'فرع النصيرات', 'النصيرات', 'مقابل Ooredoo', '+970594793301', false, true, 2
 where not exists (select 1 from public.branches where city = 'النصيرات');

-- واجهة الفروع العامة: الحقول الآمنة فقط
create or replace function public.catalog_branches()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id, 'name', b.name, 'city', b.city, 'address', b.address, 'phone', b.phone,
    'map_url', b.map_url, 'lat', b.lat, 'lng', b.lng, 'is_main', b.is_default)
    order by b.is_default desc, b.sort_order, b.created_at), '[]')
  from public.branches b where b.is_active
$$;
