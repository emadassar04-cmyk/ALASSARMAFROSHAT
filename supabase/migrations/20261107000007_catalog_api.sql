-- =====================================================================
-- 0007 واجهة الكتالوج العامة: بحث عربي، فلاتر، صفحة المنتج، بيانات السلة
-- كل الدوال تعيد حقولاً آمنة صريحة فقط (لا تكلفة، لا كمية، لا ربح)
-- =====================================================================
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists fuzzystrmatch with schema extensions;

-- ---------------------------------------------------------------------
-- توحيد النص العربي للبحث: إزالة التشكيل والتطويل وتوحيد الهمزات والتاء المربوطة والياء
-- ---------------------------------------------------------------------
create or replace function private.ar_normalize(p text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select trim(regexp_replace(
    translate(
      regexp_replace(lower(coalesce(p, '')), '[ً-ْـ]', '', 'g'),
      'أإآٱةىؤئ', 'ااااهيوي'),
    '\s+', ' ', 'g'))
$$;

-- كلمات اللهجة والمرادفات الشائعة: كل كلمة تُوسَّع إلى مرادفاتها عند البحث
create table public.search_synonyms (
  id       bigint generated always as identity primary key,
  term     text not null,
  synonym  text not null,
  unique (term, synonym)
);
insert into public.search_synonyms (term, synonym) values
  ('حرام', 'بطانيه'), ('بطانيه', 'حرام'), ('لحاف', 'بطانيه'), ('كمبل', 'بطانيه'),
  ('فرشه', 'مرتبه'), ('مرتبه', 'فرشه'), ('جنبيه', 'مرتبه'),
  ('برداي', 'ستاره'), ('برداه', 'ستاره'), ('ستاره', 'برداي'), ('ستائر', 'ستاره'),
  ('وساده', 'مخده'), ('مخده', 'وساده'), ('مخاد', 'مخده'),
  ('ملايه', 'شرشف'), ('شرشف', 'ملايه'), ('شراشف', 'شرشف'),
  ('موكيت', 'سجاد'), ('سجاده', 'سجاد'), ('بساط', 'سجاد'), ('زوليه', 'سجاد'), ('سجاد', 'موكيت');
alter table public.search_synonyms enable row level security;
create policy search_synonyms_read on public.search_synonyms for select using (true);
create policy search_synonyms_manage on public.search_synonyms for all
  using (private.has_permission('catalog.manage')) with check (private.has_permission('catalog.manage'));

-- عمود بحث موحّد على المنتجات (يُحدَّث تلقائياً) مع فهرس trigram
alter table public.products add column search_text text;
create or replace function private.products_search_text()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.search_text := private.ar_normalize(
    concat_ws(' ', new.name, array_to_string(new.materials, ' '),
      (select c.name from public.categories c where c.id = new.category_id)));
  return new;
end $$;
create trigger products_search_text before insert or update of name, materials, category_id
  on public.products for each row execute function private.products_search_text();
update public.products set name = name;
create index products_search_trgm on public.products using gin (search_text extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
-- أدوات داخلية
-- ---------------------------------------------------------------------
-- تحمّل الأخطاء الإملائية: هل توجد كلمة في النص تبعد حرفاً (أو حرفين للكلمات الطويلة) عن الكلمة المبحوث عنها؟
create or replace function private.fuzzy_word_match(p_term text, p_text text)
returns boolean language sql immutable parallel safe set search_path = '' as $$
  select length(p_term) >= 4 and exists (
    select 1 from unnest(string_to_array(p_text, ' ')) w
     where abs(length(w) - length(p_term)) <= 2
       and extensions.levenshtein(w, p_term) <= case when length(p_term) >= 6 then 2 else 1 end)
$$;

-- التوفر الإجمالي للمنتج (أفضل حالة بين خياراته)
create or replace function private.product_availability(p_product_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  with a as (
    select availability from public.get_variant_availability(
      array(select id from public.product_variants where product_id = p_product_id and is_active)))
  select coalesce(
    (select x from unnest(array['in_stock','limited','made_to_order','coming_soon','out_of_stock','unavailable']) with ordinality u(x, o)
      where x in (select availability from a) order by o limit 1),
    'unavailable')
$$;

-- أقل سعر فعّال بين الخيارات النشطة (ما يظهر على البطاقة)
create or replace function private.product_min_price(p_product_id uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select min(private.effective_unit_price(v.id))
  from public.product_variants v where v.product_id = p_product_id and v.is_active
$$;

-- الكميات المباعة (طلبات مؤكدة وغير ملغاة) لترتيب "الأكثر مبيعاً"
create or replace function private.product_units_sold(p_product_id uuid)
returns bigint language sql stable security definer set search_path = '' as $$
  select coalesce(sum(oi.quantity), 0)
  from public.order_items oi join public.orders o on o.id = oi.order_id
  where oi.product_id = p_product_id
    and o.status in ('confirmed','preparing','ready_for_pickup','out_for_delivery','delivered')
$$;

-- بطاقة المنتج: الحقول الآمنة فقط
create or replace function private.product_card(p public.products)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'slug', p.slug, 'name', p.name,
    'price', case when p.requires_measurement then null else private.product_min_price(p.id) end,
    'compare_at_price', case
       when not p.requires_measurement and p.sale_price is not null
        and (p.sale_starts_at is null or p.sale_starts_at <= now())
        and (p.sale_ends_at is null or p.sale_ends_at > now()) then p.price end,
    'requires_measurement', p.requires_measurement,
    'is_featured', p.is_featured,
    'availability', private.product_availability(p.id),
    'image', (select jsonb_build_object('url', m.url, 'alt', coalesce(m.alt, p.name))
                from public.product_media m where m.product_id = p.id and m.kind = 'image'
                order by m.sort_order, m.created_at limit 1),
    'category', (select jsonb_build_object('slug', c.slug, 'name', c.name)
                   from public.categories c where c.id = p.category_id),
    'created_at', p.created_at)
$$;

-- التصنيف وكل فروعه
create or replace function private.category_tree_ids(p_slug text)
returns setof uuid language sql stable security definer set search_path = '' as $$
  with recursive t as (
    select id from public.categories where slug = p_slug and is_active
    union all
    select c.id from public.categories c join t on c.parent_id = t.id where c.is_active)
  select id from t
$$;

-- ---------------------------------------------------------------------
-- الدوال العامة
-- ---------------------------------------------------------------------
create or replace function public.catalog_categories()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'slug', c.slug, 'name', c.name, 'description', c.description,
    'image_url', c.image_url, 'parent_id', c.parent_id,
    'product_count', (select count(*) from public.products p
                       where p.status = 'active' and p.category_id in (select private.category_tree_ids(c.slug))))
    order by c.sort_order, c.name), '[]')
  from public.categories c where c.is_active
$$;

-- البحث والتصفح: p = {q, category, min_price, max_price, availability, color, size, material,
--                     featured, sort: newest|price_asc|price_desc|best_selling, page, page_size}
create or replace function public.catalog_search(p jsonb default '{}')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_q         text := left(private.ar_normalize(p->>'q'), 100);
  v_terms     text[];
  v_patterns  text[];
  v_page      integer := greatest(coalesce((p->>'page')::integer, 1), 1);
  v_size      integer := least(greatest(coalesce((p->>'page_size')::integer, 24), 1), 48);
  v_sort      text := coalesce(p->>'sort', case when coalesce(p->>'q', '') <> '' then 'relevance' else 'newest' end);
  v_result    jsonb;
begin
  if v_q <> '' then
    -- كل كلمة + مرادفاتها
    select array_agg(distinct x) into v_terms from (
      select w as x from unnest(string_to_array(v_q, ' ')) w where length(w) >= 2
      union
      -- مطابقة الكلمة أو بدايتها (برداية/بردايات ← برداي)
      select private.ar_normalize(s.synonym) from public.search_synonyms s
        join unnest(string_to_array(v_q, ' ')) w on w = private.ar_normalize(s.term)
          or (length(private.ar_normalize(s.term)) >= 3 and w like private.ar_normalize(s.term) || '%')) t;
    v_terms := coalesce(v_terms, array[v_q]);
    select array_agg('%' || replace(replace(t, '%', ''), '_', '') || '%') into v_patterns from unnest(v_terms) t;
  end if;

  with base as (
    select pr as prod, pr.id, pr.created_at,
           private.product_min_price(pr.id) as min_price,
           case when v_q = '' then 0 else greatest(
             extensions.word_similarity(v_q, pr.search_text),
             (select coalesce(max(extensions.word_similarity(t, pr.search_text)), 0) from unnest(v_terms) t),
             case when pr.search_text like any (v_patterns) then 1 else 0 end,
             case when exists (select 1 from unnest(v_terms) t where private.fuzzy_word_match(t, pr.search_text))
                  then 0.6 else 0 end) end as score
      from public.products pr
     where pr.status = 'active'
       and (coalesce(p->>'category', '') = '' or pr.category_id in (select private.category_tree_ids(p->>'category')))
       and (coalesce((p->>'featured')::boolean, false) = false or pr.is_featured)
       and (coalesce(p->>'material', '') = '' or p->>'material' = any(pr.materials)
            or exists (select 1 from public.product_variants v where v.product_id = pr.id and v.is_active and v.material = p->>'material'))
       and (coalesce(p->>'color', '') = '' or exists (select 1 from public.product_variants v
              where v.product_id = pr.id and v.is_active and v.color = p->>'color'))
       and (coalesce(p->>'size', '') = '' or exists (select 1 from public.product_variants v
              where v.product_id = pr.id and v.is_active and v.size = p->>'size'))
  ), filtered as (
    select * from base b
     where (v_q = '' or b.score >= 0.35)
       and (p->>'min_price' is null or b.min_price >= (p->>'min_price')::numeric)
       and (p->>'max_price' is null or b.min_price <= (p->>'max_price')::numeric)
       and (coalesce(p->>'availability', '') = ''
            or (p->>'availability' = 'available' and private.product_availability(b.id) in ('in_stock', 'limited', 'made_to_order')))
  ), ordered as (
    select f.*, row_number() over (order by
        case when v_sort = 'relevance' then f.score end desc nulls last,
        case when v_sort = 'price_asc' then f.min_price end asc nulls last,
        case when v_sort = 'price_desc' then f.min_price end desc nulls last,
        case when v_sort = 'best_selling' then private.product_units_sold(f.id) end desc nulls last,
        f.created_at desc, f.id) as rn,
        count(*) over () as total
      from filtered f
  )
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(private.product_card(o.prod) order by o.rn)
               filter (where o.rn > (v_page - 1) * v_size and o.rn <= v_page * v_size), '[]'),
    'total', coalesce(max(o.total), 0),
    'page', v_page, 'page_size', v_size)
  into v_result
  from ordered o;
  return v_result;
end $$;

-- اقتراحات أثناء الكتابة (6 نتائج، مع الصورة والسعر)
create or replace function public.catalog_suggest(p_q text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(public.catalog_search(jsonb_build_object('q', p_q, 'page_size', 6))->'items', '[]')
  where length(private.ar_normalize(p_q)) >= 2
$$;

-- صفحة المنتج كاملة
create or replace function public.catalog_product(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select private.product_card(p) || jsonb_build_object(
    'description', p.description,
    'materials', p.materials,
    'unit', (select u.name_ar from public.units u where u.id = p.unit_id),
    'prep_days_min', p.prep_days_min, 'prep_days_max', p.prep_days_max,
    'seo_title', p.seo_title, 'seo_description', p.seo_description,
    'media', (select coalesce(jsonb_agg(jsonb_build_object('kind', m.kind, 'url', m.url, 'alt', coalesce(m.alt, p.name))
                order by m.sort_order, m.created_at), '[]')
              from public.product_media m where m.product_id = p.id),
    'variants', (select coalesce(jsonb_agg(jsonb_build_object(
                   'id', v.id, 'name', v.name, 'color', v.color, 'size', v.size, 'material', v.material,
                   'is_default', v.is_default,
                   'price', case when p.requires_measurement then null else private.effective_unit_price(v.id) end,
                   'availability', (select a.availability from public.get_variant_availability(array[v.id]) a))
                   order by v.is_default desc, v.sort_order, v.created_at), '[]')
                 from public.product_variants v where v.product_id = p.id and v.is_active),
    'breadcrumbs', (with recursive t as (
                      select c.id, c.slug, c.name, c.parent_id, 0 as depth from public.categories c where c.id = p.category_id
                      union all
                      select c.id, c.slug, c.name, c.parent_id, t.depth + 1 from public.categories c join t on c.id = t.parent_id)
                    select coalesce(jsonb_agg(jsonb_build_object('slug', slug, 'name', name) order by depth desc), '[]') from t),
    'related', (select coalesce(jsonb_agg(private.product_card(r)), '[]') from (
                  select * from public.products r
                   where r.status = 'active' and r.id <> p.id and r.category_id = p.category_id
                   order by r.is_featured desc, r.created_at desc limit 8) r))
  from public.products p
  where p.slug = p_slug and p.status = 'active'
$$;

-- بيانات بنود السلة/المفضلة/المقارنة من الخادم (الأسعار والتوفر الحاليان)
create or replace function public.catalog_variants(p_variant_ids uuid[])
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'variant_id', v.id, 'variant_name', v.name, 'color', v.color, 'size', v.size, 'material', v.material,
    'product', private.product_card(p),
    'price', case when p.requires_measurement then null else private.effective_unit_price(v.id) end,
    'availability', (select a.availability from public.get_variant_availability(array[v.id]) a))), '[]')
  from public.product_variants v join public.products p on p.id = v.product_id
  where v.id = any(p_variant_ids[1:100]) and v.is_active and p.status = 'active'
$$;

-- قيم الفلاتر المتاحة (ألوان، مقاسات، خامات، نطاق السعر)
create or replace function public.catalog_facets(p_category text default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  with prods as (
    select pr.id, pr.materials from public.products pr
     where pr.status = 'active'
       and (coalesce(p_category, '') = '' or pr.category_id in (select private.category_tree_ids(p_category)))
  ), vars as (
    select v.* from public.product_variants v join prods on prods.id = v.product_id where v.is_active
  )
  select jsonb_build_object(
    'colors', (select coalesce(jsonb_agg(distinct color), '[]') from vars where color is not null),
    'sizes', (select coalesce(jsonb_agg(distinct size), '[]') from vars where size is not null),
    'materials', (select coalesce(jsonb_agg(distinct m), '[]') from (
        select unnest(materials) m from prods union select material from vars where material is not null) x),
    'price_min', (select min(private.effective_unit_price(id)) from vars),
    'price_max', (select max(private.effective_unit_price(id)) from vars))
$$;

revoke all on function public.catalog_categories() from public;
revoke all on function public.catalog_search(jsonb) from public;
revoke all on function public.catalog_suggest(text) from public;
revoke all on function public.catalog_product(text) from public;
revoke all on function public.catalog_variants(uuid[]) from public;
revoke all on function public.catalog_facets(text) from public;
grant execute on function public.catalog_categories() to anon, authenticated, service_role;
grant execute on function public.catalog_search(jsonb) to anon, authenticated, service_role;
grant execute on function public.catalog_suggest(text) to anon, authenticated, service_role;
grant execute on function public.catalog_product(text) to anon, authenticated, service_role;
grant execute on function public.catalog_variants(uuid[]) to anon, authenticated, service_role;
grant execute on function public.catalog_facets(text) to anon, authenticated, service_role;

revoke all on all functions in schema private from anon, authenticated;
grant execute on function private.is_service_role() to anon, authenticated, service_role;
grant execute on function private.has_permission(text) to anon, authenticated, service_role;
grant execute on function private.is_staff() to anon, authenticated, service_role;
grant execute on function private.require_permission(text) to anon, authenticated, service_role;
grant execute on function private.default_branch_id() to anon, authenticated, service_role;
