-- =====================================================================
-- 0020 سجل المشتريات الموحد (أونلاين + فروع) للإدارة فقط
-- لا جدول مكرر: الطلبات تبقى في orders ومبيعات الفروع في store_purchases، ونوحّد العرض عبر دالة.
-- مجموعات الحالة:
--   أونلاين: pending = قبل التسليم · completed = تم التسليم · cancelled = ملغى
--   الفرع:   pending = بانتظار الاعتماد · completed = معتمد · cancelled = مرفوض أو ملغى
-- =====================================================================

create or replace view private.purchases_unified as
select o.id, 'online'::text as source, o.order_number as ref, o.customer_id, o.customer_phone as phone,
       o.customer_name, o.total as amount, null::uuid as branch_id, o.status::text as status,
       case when o.status = 'delivered' then 'completed' when o.status = 'cancelled' then 'cancelled' else 'pending' end as status_group,
       o.created_at, null::uuid as created_by, null::text as review_reason
  from public.orders o
union all
select s.id, 'store', null, s.customer_id, c.phone, c.name, s.amount, s.branch_id, s.status::text,
       case s.status when 'approved' then 'completed' when 'submitted' then 'pending' else 'cancelled' end,
       s.created_at, s.created_by, s.review_reason
  from public.store_purchases s join public.customers c on c.id = s.customer_id;

-- قائمة بفلاتر وتقسيم صفحات: p = {source, branch_id, phone, status_group, from, to, page, page_size}
create or replace function public.admin_purchases(p jsonb default '{}')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_phone text := private.canonical_phone(p->>'phone');
  v_size  int := least(greatest(coalesce((p->>'page_size')::int, 25), 1), 100);
  v_page  int := greatest(coalesce((p->>'page')::int, 1), 1);
  v_from  date := nullif(p->>'from', '')::date;
  v_to    date := nullif(p->>'to', '')::date;
  v_res   jsonb;
begin
  perform private.require_permission('sales.review');
  if coalesce(p->>'phone', '') <> '' and v_phone is null then
    return jsonb_build_object('items', '[]'::jsonb, 'total', 0, 'page', v_page, 'page_size', v_size, 'invalid_phone', true);
  end if;
  with f as (
    select u.* from private.purchases_unified u
     where (coalesce(p->>'source', '') = '' or u.source = p->>'source')
       and (coalesce(p->>'branch_id', '') = '' or u.branch_id = (p->>'branch_id')::uuid)
       and (v_phone is null or u.phone = v_phone)
       and (coalesce(p->>'status_group', '') = '' or u.status_group = p->>'status_group')
       and (v_from is null or u.created_at >= (v_from::timestamp at time zone 'Asia/Gaza'))
       and (v_to is null or u.created_at < ((v_to + 1)::timestamp at time zone 'Asia/Gaza'))
  )
  select jsonb_build_object(
    'total', (select count(*) from f),
    'page', v_page, 'page_size', v_size,
    'items', coalesce((select jsonb_agg(row_to_json(x)) from (
      select f.id, f.source, f.ref, f.phone, f.customer_name, f.amount, f.status, f.status_group, f.created_at, f.review_reason,
             b.name as branch, pr.full_name as created_by_name
        from f left join public.branches b on b.id = f.branch_id
               left join public.profiles pr on pr.id = f.created_by
       order by f.created_at desc
       limit v_size offset (v_page - 1) * v_size) x), '[]'))
  into v_res;
  return v_res;
end $$;

-- ملخص بسيط للفترة: أونلاين، فروع (حسب الفرع)، بانتظار الاعتماد
create or replace function public.purchases_summary(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_start timestamptz := p_from::timestamp at time zone 'Asia/Gaza';
  v_end   timestamptz := (p_to + 1)::timestamp at time zone 'Asia/Gaza';
begin
  perform private.require_permission('sales.review');
  return jsonb_build_object(
    'online_completed', (select jsonb_build_object('count', count(*), 'amount', coalesce(sum(total), 0))
                           from public.orders where status = 'delivered' and created_at >= v_start and created_at < v_end),
    'online_open', (select jsonb_build_object('count', count(*), 'amount', coalesce(sum(total), 0))
                      from public.orders where status not in ('delivered', 'cancelled') and created_at >= v_start and created_at < v_end),
    'store_approved', (select jsonb_build_object('count', count(*), 'amount', coalesce(sum(amount), 0))
                         from public.store_purchases where status = 'approved' and created_at >= v_start and created_at < v_end),
    'store_pending', (select jsonb_build_object('count', count(*), 'amount', coalesce(sum(amount), 0))
                        from public.store_purchases where status = 'submitted'),
    'by_branch', coalesce((select jsonb_agg(jsonb_build_object('branch', b.name, 'count', coalesce(x.n, 0), 'amount', coalesce(x.amount, 0)) order by b.is_default desc, b.sort_order)
                   from public.branches b left join (
                     select branch_id, count(*) n, sum(amount) amount from public.store_purchases
                      where status = 'approved' and created_at >= v_start and created_at < v_end group by branch_id) x on x.branch_id = b.id
                  where b.is_active), '[]'));
end $$;

revoke all on function public.admin_purchases(jsonb) from public, anon;
revoke all on function public.purchases_summary(date, date) from public, anon;
grant execute on function public.admin_purchases(jsonb) to authenticated, service_role;
grant execute on function public.purchases_summary(date, date) to authenticated, service_role;
revoke all on private.purchases_unified from public, anon, authenticated;
