-- =====================================================================
-- 0024 لوحة المعلومات (التصميم الجديد): بيانات إضافية للمنحنيات الصغيرة في البطاقات وصور الأكثر مبيعاً
-- إضافات فقط (استبدال دالتين بنفس التوقيع، والحقول القديمة كما هي):
-- - private.sales_series: + created (طلبات أُنشئت)، customers (عملاء جدد)، fees (رسوم توصيل)، expenses، net
--   net = ربح المدير + رسوم التوصيل − المصروفات (نفس تعريف «صافي ربح المدير»)
-- - admin_overview.top_products: + صورة الغلاف
-- =====================================================================

create or replace function private.sales_series(p_from date, p_to date, p_unit text)
returns jsonb language sql stable security definer set search_path = '' as $$
  with b as (
    select g as bucket from generate_series(
      case p_unit when 'month' then date_trunc('month', p_from::timestamp) else p_from::timestamp end,
      case p_unit when 'hour' then p_to::timestamp + interval '23 hours'
                  when 'month' then date_trunc('month', p_to::timestamp) else p_to::timestamp end,
      case p_unit when 'hour' then interval '1 hour' when 'day' then interval '1 day' else interval '1 month' end) g
  ), x as (
    select date_trunc(p_unit, o.confirmed_at at time zone 'Asia/Gaza') as bucket,
           count(*) as orders, sum(o.total) as revenue, sum(o.delivery_fee) as fees,
           sum((select coalesce(sum(i.manager_profit_amount), 0) from public.order_items i where i.order_id = o.id)) as profit
      from public.orders o
     where o.confirmed_at >= p_from::timestamp at time zone 'Asia/Gaza'
       and o.confirmed_at < (p_to + 1)::timestamp at time zone 'Asia/Gaza' and o.status <> 'cancelled'
     group by 1
  ), c as (
    select date_trunc(p_unit, o.created_at at time zone 'Asia/Gaza') as bucket, count(*) as created
      from public.orders o
     where o.created_at >= p_from::timestamp at time zone 'Asia/Gaza'
       and o.created_at < (p_to + 1)::timestamp at time zone 'Asia/Gaza'
     group by 1
  ), cu as (
    select date_trunc(p_unit, cu.created_at at time zone 'Asia/Gaza') as bucket, count(*) as customers
      from public.customers cu
     where cu.created_at >= p_from::timestamp at time zone 'Asia/Gaza'
       and cu.created_at < (p_to + 1)::timestamp at time zone 'Asia/Gaza'
     group by 1
  ), e as (
    -- المصروفات مسجلة باليوم: في عرض الساعات تُحسب على أول ساعة من يومها
    select date_trunc(p_unit, e.spent_on::timestamp) as bucket, sum(e.amount) as expenses
      from public.expenses e
     where e.voided_at is null and e.spent_on between p_from and p_to
     group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           't', to_char(b.bucket, case p_unit when 'hour' then 'YYYY-MM-DD"T"HH24' when 'day' then 'YYYY-MM-DD' else 'YYYY-MM' end),
           'orders', coalesce(x.orders, 0), 'revenue', coalesce(x.revenue, 0), 'profit', coalesce(x.profit, 0),
           'created', coalesce(c.created, 0), 'customers', coalesce(cu.customers, 0),
           'fees', coalesce(x.fees, 0), 'expenses', coalesce(e.expenses, 0),
           'net', coalesce(x.profit, 0) + coalesce(x.fees, 0) - coalesce(e.expenses, 0))
         order by b.bucket), '[]')
    from b left join x on x.bucket = b.bucket left join c on c.bucket = b.bucket
           left join cu on cu.bucket = b.bucket left join e on e.bucket = b.bucket
$$;
revoke all on function private.sales_series(date, date, text) from public, anon, authenticated;

create or replace function public.admin_overview(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_from timestamptz; v_to timestamptz; v_prev timestamptz; v_days integer; v_unit text;
  v_orders boolean := private.has_permission('orders.read');
  v_fin boolean := private.has_permission('finance.read');
  v_stock boolean := private.has_permission('inventory.manage') or private.has_permission('catalog.manage');
  v_sales boolean := private.has_permission('sales.review');
begin
  if not private.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'invalid_range' using errcode = '22023';
  end if;
  v_from := p_from::timestamp at time zone 'Asia/Gaza';
  v_to := (p_to + 1)::timestamp at time zone 'Asia/Gaza';
  v_days := p_to - p_from + 1;
  v_prev := (p_from - v_days)::timestamp at time zone 'Asia/Gaza';
  v_unit := case when v_days = 1 then 'hour' when v_days <= 92 then 'day' else 'month' end;

  return jsonb_build_object(
    'from', p_from, 'to', p_to, 'days', v_days, 'unit', v_unit,
    'prev_from', p_from - v_days, 'prev_to', p_from - 1,
    'visible', jsonb_build_object('orders', v_orders, 'finance', v_fin, 'stock', v_stock, 'sales', v_sales),
    'orders', case when v_orders then jsonb_build_object(
        'current', private.order_counts(v_from, v_to),
        'previous', private.order_counts(v_prev, v_from),
        'customers_total', (select count(*) from public.customers),
        'status_now', (select coalesce(jsonb_object_agg(status, n), '{}') from (
            select status, count(*) as n from public.orders
             where status not in ('delivered', 'cancelled') group by status) t)) end,
    'finance', case when v_fin then jsonb_build_object(
        'current', private.finance_kpis(v_from, v_to),
        'previous', private.finance_kpis(v_prev, v_from)) end,
    -- السلسلة الزمنية: المالية لمن يملك finance.read، وأعداد الطلبات والعملاء لمن يملك orders.read
    'series', case when v_fin then private.sales_series(p_from, p_to, v_unit)
                   when v_orders then (select jsonb_agg(jsonb_build_object('t', s->'t', 'created', s->'created', 'customers', s->'customers'))
                                         from jsonb_array_elements(private.sales_series(p_from, p_to, v_unit)) s) end,
    'series_prev', case when v_fin then private.sales_series(p_from - v_days, p_from - 1, v_unit) end,
    'weekdays', case when v_fin then (
        select coalesce(jsonb_agg(jsonb_build_object('dow', d, 'orders', coalesce(n, 0), 'revenue', coalesce(r, 0)) order by d), '[]')
          from generate_series(0, 6) d
          left join (select extract(dow from o.confirmed_at at time zone 'Asia/Gaza')::int as dow, count(*) as n, sum(o.total) as r
                       from public.orders o
                      where o.confirmed_at >= v_from and o.confirmed_at < v_to and o.status <> 'cancelled'
                      group by 1) w on w.dow = d) end,
    'top_products', case when v_fin then (
        select coalesce(jsonb_agg(t), '[]') from (
          select i.product_id, i.product_name_snapshot as name, sum(i.quantity) as qty, sum(i.net_line_amount) as revenue,
                 (select m.url from public.product_media m where m.product_id = i.product_id and m.kind = 'image'
                   order by m.sort_order, m.created_at limit 1) as image
            from public.order_items i join public.orders o on o.id = i.order_id
           where o.confirmed_at >= v_from and o.confirmed_at < v_to and o.status <> 'cancelled'
           group by 1, 2 order by 3 desc, 4 desc limit 5) t) end,
    'stock', case when v_stock then (
        select jsonb_build_object(
          'low', count(*) filter (where available > 0 and available <= threshold),
          'out', count(*) filter (where available <= 0))
          from (select p.id, p.low_stock_threshold as threshold, sum(i.on_hand - i.reserved) as available
                  from public.products p
                  join public.product_variants v on v.product_id = p.id and v.is_active
                  join public.inventory i on i.variant_id = v.id
                 where p.status = 'active' and p.availability_mode = 'stock'
                 group by p.id) s) end,
    'store_sales', case when v_sales then (
        select jsonb_build_object(
          'approved_count', count(*) filter (where status = 'approved'),
          'approved_amount', coalesce(sum(amount) filter (where status = 'approved'), 0),
          'pending_count', count(*) filter (where status = 'submitted'))
          from public.store_purchases where created_at >= v_from and created_at < v_to) end);
end $$;

revoke all on function public.admin_overview(date, date) from public, anon;
grant execute on function public.admin_overview(date, date) to authenticated;
