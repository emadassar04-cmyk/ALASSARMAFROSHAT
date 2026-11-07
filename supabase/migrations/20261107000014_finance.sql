-- =====================================================================
-- 0014 المالية والإدارة: المصروفات، الجرد، التقارير، لوحة المعلومات، تصنيف العملاء
--
-- تعريفات التقارير (موحّدة في كل مكان):
--  • البيع يُحتسب عند تأكيد الطلب (confirmed_at) وبتوقيت فلسطين، ويُستبعد إن أُلغي لاحقاً.
--  • ربح المدير = مجموع الربح اليدوي لكل بند. مستحقات المحل = صافي البنود − ربح المدير.
--  • رسوم التوصيل المحصّلة تخص المدير (والتكلفة الفعلية للمندوب تُسجَّل كمصروف «توصيل»).
--  • صافي ربح المدير = ربح المدير + رسوم التوصيل المحصّلة − المصروفات (غير الملغاة).
--  • خصومات الكوبونات مخصومة أصلاً من صافي البنود: لا تُسجَّل كمصروف حتى لا تُخصم مرتين.
-- =====================================================================

-- ---------------------------------------------------------------------
-- المصروفات (لا حذف: الإلغاء بسبب مسجل)
-- ---------------------------------------------------------------------
create type public.expense_category as enum (
  'delivery', 'packaging', 'marketing', 'payment_fees', 'discounts', 'refunds', 'other');

create table public.expenses (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid not null default private.default_branch_id() references public.branches(id),
  category     public.expense_category not null,
  amount       numeric(12,2) not null check (amount > 0),
  spent_on     date not null default ((now() at time zone 'Asia/Gaza')::date),
  order_id     uuid references public.orders(id),
  description  text not null check (length(trim(description)) between 2 and 500),
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  voided_at    timestamptz,
  voided_by    uuid,
  void_reason  text,
  check ((voided_at is null) = (void_reason is null))
);
create index expenses_spent_on_idx on public.expenses(spent_on) where voided_at is null;
create index expenses_order_idx on public.expenses(order_id);

alter table public.expenses enable row level security;
create policy expenses_read on public.expenses for select using (private.has_permission('finance.read'));
revoke all on public.expenses from anon;
revoke insert, update, delete, truncate on public.expenses from authenticated;

create or replace function public.add_expense(
  p_category public.expense_category, p_amount numeric, p_description text,
  p_spent_on date default null, p_order_id uuid default null)
returns public.expenses language plpgsql security definer set search_path = '' as $$
declare e public.expenses;
begin
  perform private.require_permission('finance.manage');
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if p_spent_on is not null and (p_spent_on > (now() at time zone 'Asia/Gaza')::date + 1
                                 or p_spent_on < date '2020-01-01') then
    raise exception 'invalid_date' using errcode = '22023';
  end if;
  insert into public.expenses (category, amount, description, spent_on, order_id)
  values (p_category, p_amount, trim(p_description),
          coalesce(p_spent_on, (now() at time zone 'Asia/Gaza')::date), p_order_id)
  returning * into e;
  perform private.log_activity('finance.expense_added', 'expenses', e.id::text, null, to_jsonb(e));
  return e;
end $$;

create or replace function public.void_expense(p_id uuid, p_reason text)
returns public.expenses language plpgsql security definer set search_path = '' as $$
declare e public.expenses;
begin
  perform private.require_permission('finance.manage');
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason is required' using errcode = '22023'; end if;
  update public.expenses set voided_at = now(), voided_by = auth.uid(), void_reason = trim(p_reason)
   where id = p_id and voided_at is null returning * into e;
  if not found then raise exception 'expense_not_found_or_voided' using errcode = 'P0002'; end if;
  perform private.log_activity('finance.expense_voided', 'expenses', p_id::text, null, to_jsonb(e), p_reason);
  return e;
end $$;

-- ---------------------------------------------------------------------
-- الجرد الفعلي
-- الكمية المتوقعة تُلتقط عند بدء الجرد؛ عند الاعتماد يُطبَّق الفرق (المعدود − المتوقع)
-- على الكمية الحالية، فلا تضيع مبيعات حدثت أثناء العد.
-- ---------------------------------------------------------------------
create table public.stocktakes (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null default private.default_branch_id() references public.branches(id),
  status      text not null default 'open' check (status in ('open', 'applied', 'cancelled')),
  note        text,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  closed_at   timestamptz,
  summary     jsonb
);
create unique index stocktakes_one_open on public.stocktakes(branch_id) where status = 'open';

create table public.stocktake_items (
  id               bigint generated always as identity primary key,
  stocktake_id     uuid not null references public.stocktakes(id) on delete cascade,
  variant_id       uuid not null references public.product_variants(id),
  expected_on_hand integer not null,
  counted          integer check (counted >= 0),
  counted_at       timestamptz,
  unique (stocktake_id, variant_id)
);

alter table public.stocktakes enable row level security;
alter table public.stocktake_items enable row level security;
create policy stocktakes_read on public.stocktakes for select using (private.is_staff());
create policy stocktake_items_read on public.stocktake_items for select using (private.is_staff());
revoke all on public.stocktakes, public.stocktake_items from anon;
revoke insert, update, delete, truncate on public.stocktakes, public.stocktake_items from authenticated;

create or replace function public.start_stocktake(p_note text default null)
returns public.stocktakes language plpgsql security definer set search_path = '' as $$
declare s public.stocktakes;
begin
  perform private.require_permission('inventory.manage');
  insert into public.stocktakes (note) values (nullif(trim(p_note), '')) returning * into s;
  insert into public.stocktake_items (stocktake_id, variant_id, expected_on_hand)
  select s.id, i.variant_id, i.on_hand
    from public.inventory i
    join public.product_variants v on v.id = i.variant_id and v.is_active
    join public.products p on p.id = v.product_id and p.status <> 'archived' and p.availability_mode = 'stock'
   where i.branch_id = s.branch_id;
  perform private.log_activity('inventory.stocktake_started', 'stocktakes', s.id::text);
  return s;
exception when unique_violation then
  raise exception 'stocktake_already_open' using errcode = 'P0001';
end $$;

create or replace function public.set_stocktake_count(p_item_id bigint, p_counted integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_permission('inventory.manage');
  if p_counted is not null and p_counted < 0 then raise exception 'invalid_quantity' using errcode = '22023'; end if;
  update public.stocktake_items it set counted = p_counted, counted_at = case when p_counted is null then null else now() end
    from public.stocktakes s
   where it.id = p_item_id and s.id = it.stocktake_id and s.status = 'open';
  if not found then raise exception 'stocktake_not_open' using errcode = 'P0001'; end if;
end $$;

create or replace function public.apply_stocktake(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s public.stocktakes;
  r record;
  v_inv public.inventory;
  v_new integer;
  v_adjusted integer := 0;
  v_counted integer := 0;
  v_delta integer := 0;
  v_summary jsonb;
begin
  perform private.require_permission('inventory.manage');
  select * into s from public.stocktakes where id = p_id for update;
  if not found or s.status <> 'open' then raise exception 'stocktake_not_open' using errcode = 'P0001'; end if;

  for r in
    select it.variant_id, it.expected_on_hand, it.counted, p.name
      from public.stocktake_items it
      join public.product_variants v on v.id = it.variant_id
      join public.products p on p.id = v.product_id
     where it.stocktake_id = p_id and it.counted is not null
     order by it.variant_id
  loop
    v_counted := v_counted + 1;
    continue when r.counted = r.expected_on_hand;
    select * into v_inv from public.inventory where variant_id = r.variant_id and branch_id = s.branch_id for update;
    v_new := v_inv.on_hand + (r.counted - r.expected_on_hand);
    if v_new < v_inv.reserved then
      raise exception 'stocktake_below_reserved: %', r.name using errcode = '23514';
    end if;
    update public.inventory set on_hand = v_new, updated_at = now()
     where variant_id = r.variant_id and branch_id = s.branch_id returning * into v_inv;
    insert into public.inventory_movements
      (variant_id, branch_id, kind, on_hand_delta, on_hand_after, reserved_after, note)
    values (r.variant_id, s.branch_id, 'stocktake', r.counted - r.expected_on_hand, v_inv.on_hand, v_inv.reserved,
            'جرد ' || to_char(s.created_at at time zone 'Asia/Gaza', 'YYYY-MM-DD'));
    v_adjusted := v_adjusted + 1;
    v_delta := v_delta + (r.counted - r.expected_on_hand);
  end loop;

  v_summary := jsonb_build_object('counted', v_counted, 'adjusted', v_adjusted, 'total_delta', v_delta);
  update public.stocktakes set status = 'applied', closed_at = now(), summary = v_summary where id = p_id;
  perform private.log_activity('inventory.stocktake_applied', 'stocktakes', p_id::text, null, v_summary);
  return v_summary;
end $$;

create or replace function public.cancel_stocktake(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_permission('inventory.manage');
  update public.stocktakes set status = 'cancelled', closed_at = now() where id = p_id and status = 'open';
  if not found then raise exception 'stocktake_not_open' using errcode = 'P0001'; end if;
  perform private.log_activity('inventory.stocktake_cancelled', 'stocktakes', p_id::text);
end $$;

-- ---------------------------------------------------------------------
-- تصنيف العملاء (VIP / دائم) عبر دالة فقط، لا تعديل مباشر لبيانات العميل
-- ---------------------------------------------------------------------
create or replace function public.set_customer_tier(p_customer_id uuid, p_tier public.customer_tier)
returns void language plpgsql security definer set search_path = '' as $$
declare v_old public.customer_tier;
begin
  perform private.require_permission('orders.manage');
  select tier into v_old from public.customers where id = p_customer_id for update;
  if not found then raise exception 'customer_not_found' using errcode = 'P0002'; end if;
  update public.customers set tier = p_tier where id = p_customer_id;
  perform private.log_activity('customer.tier', 'customers', p_customer_id::text,
    jsonb_build_object('tier', v_old), jsonb_build_object('tier', p_tier));
end $$;
revoke update on public.customers from authenticated;
drop policy if exists customers_manage on public.customers;

-- ---------------------------------------------------------------------
-- التقارير
-- ---------------------------------------------------------------------
-- مؤشرات فترة [from, to) بالطوابع الزمنية
create or replace function private.finance_kpis(p_from timestamptz, p_to timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  with sales as (
    select o.* from public.orders o
     where o.confirmed_at >= p_from and o.confirmed_at < p_to and o.status <> 'cancelled'
  ), items as (
    select i.* from public.order_items i join sales s on s.id = i.order_id
  ), exp as (
    select coalesce(sum(amount), 0) as total from public.expenses
     where voided_at is null
       and spent_on >= (p_from at time zone 'Asia/Gaza')::date and spent_on < (p_to at time zone 'Asia/Gaza')::date
  ), created as (
    select count(*) as n,
           count(*) filter (where status = 'cancelled') as cancelled,
           count(*) filter (where status = 'delivered') as delivered
      from public.orders where created_at >= p_from and created_at < p_to
  )
  select jsonb_build_object(
    'orders', (select count(*) from sales),
    'revenue', (select coalesce(sum(total), 0) from sales),
    'products_net', (select coalesce(sum(net_line_amount), 0) from items),
    'delivery_fees', (select coalesce(sum(delivery_fee), 0) from sales),
    'discounts', (select coalesce(sum(discount_total), 0) from sales),
    'cogs', (select coalesce(sum(unit_cost_snapshot * quantity), 0) from items),
    'items_missing_cost', (select count(*) from items where unit_cost_snapshot is null),
    'manager_profit', (select coalesce(sum(manager_profit_amount), 0) from items),
    'store_due', (select coalesce(sum(store_due_amount), 0) from items),
    'items_missing_profit', (select count(*) from items where manager_profit_amount is null),
    'store_due_pending', (select coalesce(sum(net_line_amount), 0) from items where manager_profit_amount is null),
    'expenses', (select total from exp),
    'manager_net', (select coalesce(sum(manager_profit_amount), 0) from items)
                   + (select coalesce(sum(delivery_fee), 0) from sales) - (select total from exp),
    'units', (select coalesce(sum(quantity), 0) from items),
    'avg_order', (select coalesce(round(avg(total), 2), 0) from sales),
    'created_orders', (select n from created),
    'created_cancelled', (select cancelled from created),
    'created_delivered', (select delivered from created))
$$;

-- تقرير فترة كاملة (أيام بتوقيت فلسطين، شاملة البداية والنهاية) + مقارنة بالفترة السابقة المساوية
create or replace function public.finance_report(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_from timestamptz;
  v_to   timestamptz;
  v_days integer;
  v_prev_from timestamptz;
begin
  perform private.require_permission('finance.read');
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'invalid_range' using errcode = '22023';
  end if;
  v_from := p_from::timestamp at time zone 'Asia/Gaza';
  v_to := (p_to + 1)::timestamp at time zone 'Asia/Gaza';
  v_days := p_to - p_from + 1;
  v_prev_from := (p_from - v_days)::timestamp at time zone 'Asia/Gaza';

  return jsonb_build_object(
    'from', p_from, 'to', p_to, 'days', v_days,
    'kpis', private.finance_kpis(v_from, v_to),
    'previous', private.finance_kpis(v_prev_from, v_from),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'orders', coalesce(x.orders, 0),
               'revenue', coalesce(x.revenue, 0), 'profit', coalesce(x.profit, 0)) order by d.day), '[]')
        from generate_series(p_from, p_to, interval '1 day') as d(day)
        left join (
          select (o.confirmed_at at time zone 'Asia/Gaza')::date as day, count(*) as orders, sum(o.total) as revenue,
                 sum((select coalesce(sum(i.manager_profit_amount), 0) from public.order_items i where i.order_id = o.id)) as profit
            from public.orders o
           where o.confirmed_at >= v_from and o.confirmed_at < v_to and o.status <> 'cancelled'
           group by 1) x on x.day = d.day::date),
    'products', (
      select coalesce(jsonb_agg(t order by t.qty desc, t.revenue desc), '[]') from (
        select i.product_id, i.product_name_snapshot as name, sum(i.quantity) as qty, sum(i.net_line_amount) as revenue,
               sum(i.manager_profit_amount) as profit, sum(i.store_due_amount) as store_due,
               sum(i.unit_cost_snapshot * i.quantity) as cogs
          from public.order_items i join public.orders o on o.id = i.order_id
         where o.confirmed_at >= v_from and o.confirmed_at < v_to and o.status <> 'cancelled'
         group by i.product_id, i.product_name_snapshot) t),
    'categories', (
      select coalesce(jsonb_agg(t order by t.revenue desc), '[]') from (
        select coalesce(c.name, 'بدون تصنيف') as name, sum(i.quantity) as qty, sum(i.net_line_amount) as revenue
          from public.order_items i join public.orders o on o.id = i.order_id
          left join public.products p on p.id = i.product_id
          left join public.categories c on c.id = p.category_id
         where o.confirmed_at >= v_from and o.confirmed_at < v_to and o.status <> 'cancelled'
         group by 1) t),
    'unsold', (
      select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name) order by p.created_at), '[]')
        from (select * from public.products p where p.status = 'active'
                and not exists (select 1 from public.order_items i join public.orders o on o.id = i.order_id
                                 where i.product_id = p.id and o.confirmed_at >= v_from and o.confirmed_at < v_to
                                   and o.status <> 'cancelled')
               order by p.created_at limit 30) p),
    'expenses', (
      select coalesce(jsonb_agg(t order by t.amount desc), '[]') from (
        select category, sum(amount) as amount, count(*) as n from public.expenses
         where voided_at is null and spent_on between p_from and p_to group by category) t),
    'sources', (
      select coalesce(jsonb_agg(t order by t.orders desc), '[]') from (
        select coalesce(nullif(source, ''), 'غير معروف') as source, count(*) as orders, sum(total) as revenue
          from public.orders
         where confirmed_at >= v_from and confirmed_at < v_to and status <> 'cancelled'
         group by 1) t));
end $$;

-- لوحة المعلومات: اليوم + هذا الشهر + ما يحتاج انتباهاً الآن
create or replace function public.admin_dashboard()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Asia/Gaza')::date;
  v_month date := date_trunc('month', (now() at time zone 'Asia/Gaza'))::date;
  v_fin boolean := private.has_permission('finance.read');
begin
  perform private.require_permission('orders.read');
  return jsonb_build_object(
    'finance_visible', v_fin,
    'today', case when v_fin then private.finance_kpis(v_today::timestamp at time zone 'Asia/Gaza',
                                                       (v_today + 1)::timestamp at time zone 'Asia/Gaza') end,
    'month', case when v_fin then private.finance_kpis(v_month::timestamp at time zone 'Asia/Gaza',
                                                       (v_today + 1)::timestamp at time zone 'Asia/Gaza') end,
    'status_counts', (select coalesce(jsonb_object_agg(status, n), '{}') from (
        select status, count(*) as n from public.orders
         where status not in ('delivered', 'cancelled') or created_at > now() - interval '30 days'
         group by status) t),
    'pending_transfers', (select count(*) from public.orders where payment_status = 'awaiting_review' and status <> 'cancelled'),
    'expiring_soon', (select count(*) from public.orders where status in ('received', 'awaiting_confirmation')
                        and reservation_expires_at < now() + interval '30 minutes'),
    'low_stock', (select coalesce(jsonb_agg(t order by t.available), '[]') from (
        select p.id, p.name, sum(i.on_hand - i.reserved) as available, p.low_stock_threshold as threshold
          from public.products p
          join public.product_variants v on v.product_id = p.id and v.is_active
          join public.inventory i on i.variant_id = v.id
         where p.status = 'active' and p.availability_mode = 'stock'
         group by p.id
        having sum(i.on_hand - i.reserved) <= p.low_stock_threshold
         order by 3 limit 10) t),
    'top_month', case when v_fin then (select coalesce(jsonb_agg(t), '[]') from (
        select i.product_name_snapshot as name, sum(i.quantity) as qty, sum(i.net_line_amount) as revenue
          from public.order_items i join public.orders o on o.id = i.order_id
         where o.confirmed_at >= v_month::timestamp at time zone 'Asia/Gaza' and o.status <> 'cancelled'
         group by 1 order by 2 desc limit 5) t) end,
    'recent', (select coalesce(jsonb_agg(t), '[]') from (
        select id, order_number, status, total, created_at from public.orders order by created_at desc limit 6) t));
end $$;

-- ---------------------------------------------------------------------
-- الصلاحيات
-- ---------------------------------------------------------------------
revoke all on function public.add_expense(public.expense_category, numeric, text, date, uuid) from public, anon;
revoke all on function public.void_expense(uuid, text) from public, anon;
revoke all on function public.start_stocktake(text) from public, anon;
revoke all on function public.set_stocktake_count(bigint, integer) from public, anon;
revoke all on function public.apply_stocktake(uuid) from public, anon;
revoke all on function public.cancel_stocktake(uuid) from public, anon;
revoke all on function public.set_customer_tier(uuid, public.customer_tier) from public, anon;
revoke all on function public.finance_report(date, date) from public, anon;
revoke all on function public.admin_dashboard() from public, anon;
grant execute on function public.add_expense(public.expense_category, numeric, text, date, uuid) to authenticated;
grant execute on function public.void_expense(uuid, text) to authenticated;
grant execute on function public.start_stocktake(text) to authenticated;
grant execute on function public.set_stocktake_count(bigint, integer) to authenticated;
grant execute on function public.apply_stocktake(uuid) to authenticated;
grant execute on function public.cancel_stocktake(uuid) to authenticated;
grant execute on function public.set_customer_tier(uuid, public.customer_tier) to authenticated;
grant execute on function public.finance_report(date, date) to authenticated;
grant execute on function public.admin_dashboard() to authenticated;

revoke all on all functions in schema private from anon, authenticated;
grant execute on function private.is_service_role() to anon, authenticated, service_role;
grant execute on function private.has_permission(text) to anon, authenticated, service_role;
grant execute on function private.is_staff() to anon, authenticated, service_role;
grant execute on function private.require_permission(text) to anon, authenticated, service_role;
grant execute on function private.default_branch_id() to anon, authenticated, service_role;
