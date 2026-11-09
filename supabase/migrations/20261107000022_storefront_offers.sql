-- =====================================================================
-- 0022 تحسينات الواجهة: العروض + «أضف إلى السلة» من البطاقة
-- - catalog_offers: المنتجات التي عليها خصم فعلي الآن (سعر بعد الخصم أقل من الأصلي، وضمن فترة العرض)
-- - product_card: حقل quick_variant_id = الخيار الوحيد النشط للمنتج القابل للشراء مباشرة
--   (منتج بعدة خيارات أو حسب المقاس يبقى بزر «عرض التفاصيل» لاختيار الخيار)
-- =====================================================================

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
    'created_at', p.created_at,
    'quick_variant_id', case when not p.requires_measurement then (
        select min(v.id::text)::uuid from public.product_variants v
         where v.product_id = p.id and v.is_active
        having count(*) = 1) end)
$$;

create or replace function public.catalog_offers(p_limit integer default 8)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(card order by created desc), '[]') from (
    select private.product_card(p) as card, p.created_at as created
      from public.products p
     where p.status = 'active' and not p.requires_measurement and p.sale_price is not null
       and (p.sale_starts_at is null or p.sale_starts_at <= now())
       and (p.sale_ends_at is null or p.sale_ends_at > now())
     order by p.created_at desc
     limit least(greatest(coalesce(p_limit, 8), 1), 24)) x
  where (card->>'compare_at_price') is not null
    and (card->>'price')::numeric < (card->>'compare_at_price')::numeric
$$;

revoke all on function public.catalog_offers(integer) from public;
grant execute on function public.catalog_offers(integer) to anon, authenticated, service_role;
