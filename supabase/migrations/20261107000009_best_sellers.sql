-- =====================================================================
-- 0009 الأكثر مبيعاً: فقط المنتجات التي لها مبيعات مؤكدة فعلاً
-- (الترتيب best_selling في catalog_search يُبقي كل المنتجات؛ هذه الدالة لقسم الرئيسية)
-- =====================================================================
create or replace function public.catalog_best_sellers(p_limit integer default 8)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(private.product_card(t.prod) order by t.sold desc, t.created_at desc), '[]')
  from (
    select p as prod, p.created_at, s.sold
    from public.products p
    join (select oi.product_id, sum(oi.quantity) as sold
            from public.order_items oi join public.orders o on o.id = oi.order_id
           where o.status in ('confirmed','preparing','ready_for_pickup','out_for_delivery','delivered')
           group by oi.product_id) s on s.product_id = p.id
    where p.status = 'active'
    order by s.sold desc, p.created_at desc
    limit least(greatest(p_limit, 1), 24)
  ) t
$$;
revoke all on function public.catalog_best_sellers(integer) from public;
grant execute on function public.catalog_best_sellers(integer) to anon, authenticated, service_role;
