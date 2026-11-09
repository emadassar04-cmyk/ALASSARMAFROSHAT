-- =====================================================================
-- 0023 لوحة الإدارة الجديدة (إضافات فقط: لا حذف لأي جدول أو عمود أو بيانات)
-- - لغة الواجهة المفضلة لكل موظف (عربي/إنجليزي)
-- - أدوار جاهزة جديدة + اسم إنجليزي لكل دور + مصفوفة صلاحيات قابلة للتعديل من المدير
-- - دوال قراءة للوحة: نظرة عامة بفترة، قائمة طلبات بترقيم صفحات حقيقي، عملاء (CRM)،
--   سجل النشاط، مركز الإشعارات، البحث الشامل
-- - حذف منتج لم يُستخدم قط (وإلا الأرشفة)
-- كل دالة تتحقق من الصلاحية داخلياً (لا يُعتمد على إخفاء الأزرار)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) لغة الواجهة لكل موظف
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists locale text not null default 'ar'
  check (locale in ('ar', 'en'));

create or replace function public.set_my_locale(p_locale text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_locale not in ('ar', 'en') then raise exception 'invalid_locale' using errcode = '22023'; end if;
  update public.profiles set locale = p_locale where id = auth.uid();
end $$;
revoke all on function public.set_my_locale(text) from public, anon;
grant execute on function public.set_my_locale(text) to authenticated;

-- ---------------------------------------------------------------------
-- 2) الأدوار: اسم إنجليزي + أدوار جاهزة جديدة (الأدوار القديمة باقية كما هي)
-- ---------------------------------------------------------------------
alter table public.roles add column if not exists name_en text;
update public.roles set name_en = case code
  when 'owner' then 'Super Admin' when 'reception' then 'Reception'
  when 'inventory' then 'Inventory Clerk' when 'fulfilment' then 'Fulfilment Clerk'
  when 'reports' then 'Reports Viewer' else initcap(replace(code, '_', ' ')) end
 where name_en is null;
update public.roles set name_ar = 'المدير العام' where code = 'owner';

insert into public.roles (code, name_ar, name_en, is_system) values
  ('store_manager',    'مدير المتجر',   'Store Manager',    true),
  ('orders_manager',   'مدير الطلبات',  'Orders Manager',   true),
  ('products_manager', 'مدير المنتجات', 'Products Manager', true),
  ('accountant',       'محاسب',         'Accountant',       true),
  ('viewer',           'مشاهد',         'Viewer',           true)
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on (
     (r.code = 'store_manager'    and p.code not in ('staff.manage', 'settings.manage'))
  or (r.code = 'orders_manager'   and p.code in ('orders.read', 'orders.manage', 'sales.record'))
  or (r.code = 'products_manager' and p.code in ('catalog.manage', 'inventory.manage'))
  or (r.code = 'accountant'       and p.code in ('orders.read', 'finance.read', 'finance.manage', 'sales.review'))
  or (r.code = 'viewer'           and p.code in ('orders.read')))
on conflict do nothing;

-- سياق الموظف: + اللغة + اسم الدور بالإنجليزية
create or replace function public.my_staff_context()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'is_staff_account', pr.id is not null and pr.is_active and pr.role_id is not null,
    'aal', coalesce(auth.jwt()->>'aal', 'aal1'),
    'role', r.code,
    'role_name', r.name_ar,
    'role_name_en', r.name_en,
    'full_name', pr.full_name,
    'locale', coalesce(pr.locale, 'ar'),
    'permissions', case when coalesce(auth.jwt()->>'aal', '') = 'aal2' then
      coalesce((select jsonb_agg(pe.code order by pe.code) from public.role_permissions rp
                  join public.permissions pe on pe.id = rp.permission_id where rp.role_id = pr.role_id), '[]')
      else '[]'::jsonb end)
  from (select auth.uid() as uid) me
  left join public.profiles pr on pr.id = me.uid
  left join public.roles r on r.id = pr.role_id
$$;

-- مصفوفة الأدوار والصلاحيات (للمدير/من يملك staff.manage)
create or replace function public.admin_roles()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_permission('staff.manage');
  return jsonb_build_object(
    'permissions', (select jsonb_agg(jsonb_build_object('code', code, 'description', description) order by id) from public.permissions),
    'roles', (select jsonb_agg(jsonb_build_object(
        'code', r.code, 'name', r.name_ar, 'name_en', r.name_en, 'locked', r.code = 'owner',
        'members', (select count(*) from public.profiles pr where pr.role_id = r.id and pr.is_active),
        'permissions', coalesce((select jsonb_agg(p.code order by p.code) from public.role_permissions rp
                                   join public.permissions p on p.id = rp.permission_id where rp.role_id = r.id), '[]'))
      order by r.code = 'owner' desc, r.id) from public.roles r));
end $$;

create or replace function public.set_role_permissions(p_role text, p_permissions text[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_role smallint; v_old jsonb;
begin
  perform private.require_permission('staff.manage');
  select id into v_role from public.roles where code = p_role;
  if v_role is null then raise exception 'invalid_role' using errcode = '22023'; end if;
  if p_role = 'owner' then raise exception 'cannot_change_owner' using errcode = '42501'; end if;
  if exists (select 1 from unnest(coalesce(p_permissions, '{}')) c where c not in (select code from public.permissions)) then
    raise exception 'invalid_permission' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(p.code order by p.code), '[]') into v_old
    from public.role_permissions rp join public.permissions p on p.id = rp.permission_id where rp.role_id = v_role;
  delete from public.role_permissions where role_id = v_role;
  insert into public.role_permissions (role_id, permission_id)
  select v_role, p.id from public.permissions p where p.code = any(coalesce(p_permissions, '{}'));
  perform private.log_activity('staff.role_permissions', 'roles', p_role, jsonb_build_object('permissions', v_old),
    jsonb_build_object('permissions', (select coalesce(jsonb_agg(c order by c), '[]') from unnest(coalesce(p_permissions, '{}')) c)));
end $$;

revoke all on function public.admin_roles() from public, anon;
revoke all on function public.set_role_permissions(text, text[]) from public, anon;
grant execute on function public.admin_roles() to authenticated;
grant execute on function public.set_role_permissions(text, text[]) to authenticated;

-- ---------------------------------------------------------------------
-- 3) نظرة عامة بفترة (أيام بتوقيت فلسطين، شاملة البداية والنهاية) + الفترة السابقة المساوية
--    كل قسم يظهر فقط لمن يملك صلاحيته؛ الأرقام المالية بنفس تعريفات finance_kpis
-- ---------------------------------------------------------------------
create or replace function private.order_counts(p_from timestamptz, p_to timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'total', count(*),
    'new', count(*) filter (where status in ('received', 'awaiting_confirmation')),
    'processing', count(*) filter (where status in ('confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery')),
    'completed', count(*) filter (where status = 'delivered'),
    'cancelled', count(*) filter (where status = 'cancelled'),
    'new_customers', (select count(*) from public.customers c where c.created_at >= p_from and c.created_at < p_to))
  from public.orders where created_at >= p_from and created_at < p_to
$$;
revoke all on function private.order_counts(timestamptz, timestamptz) from public, anon, authenticated;

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
           count(*) as orders, sum(o.total) as revenue,
           sum((select coalesce(sum(i.manager_profit_amount), 0) from public.order_items i where i.order_id = o.id)) as profit
      from public.orders o
     where o.confirmed_at >= p_from::timestamp at time zone 'Asia/Gaza'
       and o.confirmed_at < (p_to + 1)::timestamp at time zone 'Asia/Gaza' and o.status <> 'cancelled'
     group by 1)
  select coalesce(jsonb_agg(jsonb_build_object(
           't', to_char(b.bucket, case p_unit when 'hour' then 'YYYY-MM-DD"T"HH24' when 'day' then 'YYYY-MM-DD' else 'YYYY-MM' end),
           'orders', coalesce(x.orders, 0), 'revenue', coalesce(x.revenue, 0), 'profit', coalesce(x.profit, 0))
         order by b.bucket), '[]')
    from b left join x on x.bucket = b.bucket
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
    -- سلسلة زمنية للفترة الحالية والسابقة (بالساعة ليوم واحد، باليوم حتى 92 يوماً، وإلا بالشهر)
    'series', case when v_fin then private.sales_series(p_from, p_to, v_unit) end,
    'series_prev', case when v_fin then private.sales_series(p_from - v_days, p_from - 1, v_unit) end,
    -- أفضل أيام الأسبوع (0 = الأحد) ضمن الفترة
    'weekdays', case when v_fin then (
        select coalesce(jsonb_agg(jsonb_build_object('dow', d, 'orders', coalesce(n, 0), 'revenue', coalesce(r, 0)) order by d), '[]')
          from generate_series(0, 6) d
          left join (select extract(dow from o.confirmed_at at time zone 'Asia/Gaza')::int as dow, count(*) as n, sum(o.total) as r
                       from public.orders o
                      where o.confirmed_at >= v_from and o.confirmed_at < v_to and o.status <> 'cancelled'
                      group by 1) w on w.dow = d) end,
    'top_products', case when v_fin then (
        select coalesce(jsonb_agg(t), '[]') from (
          select i.product_id, i.product_name_snapshot as name, sum(i.quantity) as qty, sum(i.net_line_amount) as revenue
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

-- ---------------------------------------------------------------------
-- 4) قائمة الطلبات: بحث، فلترة، فرز، ترقيم صفحات حقيقي (حتى 100 بالصفحة، أو 5000 للتصدير)
-- ---------------------------------------------------------------------
-- volatile (لا stable): التصدير يكتب في سجل النشاط، وPostgREST يشغّل الدوال الثابتة في معاملة للقراءة فقط
create or replace function public.admin_orders(p jsonb default '{}')
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_q text := nullif(left(trim(coalesce(p->>'q', '')), 60), '');
  v_digits text;
  v_status public.order_status;
  v_pay public.payment_method_code;
  v_from date; v_to date;
  v_sort text := coalesce(p->>'sort', 'created_at');
  v_dir text := case when lower(coalesce(p->>'dir', 'desc')) = 'asc' then 'asc' else 'desc' end;
  v_export boolean := coalesce((p->>'export')::boolean, false);
  v_size integer := least(greatest(coalesce((p->>'page_size')::int, 20), 1), case when v_export then 5000 else 100 end);
  v_page integer := greatest(coalesce((p->>'page')::int, 1), 1);
  v_result jsonb;
begin
  perform private.require_permission('orders.read');
  if v_sort not in ('created_at', 'total', 'order_number', 'customer_name') then v_sort := 'created_at'; end if;
  begin
    v_status := nullif(p->>'status', '')::public.order_status;
    v_pay := nullif(p->>'payment_method', '')::public.payment_method_code;
    v_from := nullif(p->>'from', '')::date;
    v_to := nullif(p->>'to', '')::date;
  exception when others then raise exception 'invalid_filter' using errcode = '22023';
  end;
  v_digits := case when v_q is not null then nullif(regexp_replace(translate(v_q, '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g'), '') end;

  with base as (
    select o.* from public.orders o
     where (v_from is null or o.created_at >= v_from::timestamp at time zone 'Asia/Gaza')
       and (v_to is null or o.created_at < (v_to + 1)::timestamp at time zone 'Asia/Gaza')
       and (v_pay is null or o.payment_method = v_pay)
       and (v_q is null
            or o.order_number ilike '%' || v_q || '%'
            or o.customer_name ilike '%' || replace(replace(v_q, '%', ''), '_', '') || '%'
            or (v_digits is not null and length(v_digits) >= 3 and o.customer_phone like '%' || v_digits || '%'))
  ), filtered as (
    select * from base where (v_status is null or status = v_status)
       and (not coalesce((p->>'open')::boolean, false) or status not in ('delivered', 'cancelled'))
  ), page as (
    select f.* from filtered f
     order by
       case when v_dir = 'asc' and v_sort = 'created_at' then f.created_at end asc,
       case when v_dir = 'desc' and v_sort = 'created_at' then f.created_at end desc,
       case when v_dir = 'asc' and v_sort = 'total' then f.total end asc,
       case when v_dir = 'desc' and v_sort = 'total' then f.total end desc,
       case when v_dir = 'asc' and v_sort = 'order_number' then f.order_number end asc,
       case when v_dir = 'desc' and v_sort = 'order_number' then f.order_number end desc,
       case when v_dir = 'asc' and v_sort = 'customer_name' then f.customer_name end asc,
       case when v_dir = 'desc' and v_sort = 'customer_name' then f.customer_name end desc,
       f.created_at desc
     limit v_size offset (v_page - 1) * v_size
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'page', v_page, 'page_size', v_size,
    'status_counts', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) as n from base group by status) t),
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
        'id', pg.id, 'order_number', pg.order_number, 'customer_name', pg.customer_name, 'customer_phone', pg.customer_phone,
        'status', pg.status, 'fulfillment', pg.fulfillment, 'payment_method', pg.payment_method,
        'payment_status', pg.payment_status, 'subtotal', pg.subtotal, 'discount_total', pg.discount_total,
        'delivery_fee', pg.delivery_fee, 'total', pg.total, 'created_at', pg.created_at,
        'reservation_expires_at', pg.reservation_expires_at, 'source', pg.source,
        'items_count', (select coalesce(sum(i.quantity), 0) from public.order_items i where i.order_id = pg.id),
        'first_item', (select i.product_name_snapshot from public.order_items i where i.order_id = pg.id order by i.created_at limit 1),
        'lines', (select count(*) from public.order_items i where i.order_id = pg.id))
      order by
       case when v_dir = 'asc' and v_sort = 'created_at' then pg.created_at end asc,
       case when v_dir = 'desc' and v_sort = 'created_at' then pg.created_at end desc,
       case when v_dir = 'asc' and v_sort = 'total' then pg.total end asc,
       case when v_dir = 'desc' and v_sort = 'total' then pg.total end desc,
       case when v_dir = 'asc' and v_sort = 'order_number' then pg.order_number end asc,
       case when v_dir = 'desc' and v_sort = 'order_number' then pg.order_number end desc,
       case when v_dir = 'asc' and v_sort = 'customer_name' then pg.customer_name end asc,
       case when v_dir = 'desc' and v_sort = 'customer_name' then pg.customer_name end desc,
       pg.created_at desc) from page pg), '[]'))
  into v_result;
  if v_export then
    perform private.log_activity('orders.exported', 'orders', null, null,
      jsonb_build_object('rows', jsonb_array_length(v_result->'rows'), 'filters', p - 'export'));
  end if;
  return v_result;
end $$;

revoke all on function public.admin_orders(jsonb) from public, anon;
grant execute on function public.admin_orders(jsonb) to authenticated;
create index if not exists orders_created_idx on public.orders(created_at desc);

-- ---------------------------------------------------------------------
-- 5) العملاء (CRM): مشتريات الموقع (طلبات غير ملغاة بعد التأكيد) + مبيعات الفروع المعتمدة
-- ---------------------------------------------------------------------
create or replace function private.customer_stats()
returns table (customer_id uuid, orders_count bigint, delivered_count bigint, online_spent numeric,
               store_count bigint, store_spent numeric, last_purchase_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id,
         coalesce(o.n, 0), coalesce(o.delivered, 0), coalesce(o.spent, 0),
         coalesce(s.n, 0), coalesce(s.spent, 0),
         greatest(o.last_at, s.last_at)
    from public.customers c
    left join (select customer_id, count(*) as n, count(*) filter (where status = 'delivered') as delivered,
                      sum(total) filter (where confirmed_at is not null and status <> 'cancelled') as spent,
                      max(created_at) filter (where status <> 'cancelled') as last_at
                 from public.orders group by customer_id) o on o.customer_id = c.id
    left join (select customer_id, count(*) as n, sum(amount) as spent, max(created_at) as last_at
                 from public.store_purchases where status = 'approved' group by customer_id) s on s.customer_id = c.id
$$;
revoke all on function private.customer_stats() from public, anon, authenticated;

create or replace function public.admin_customers(p jsonb default '{}')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_q text := nullif(left(trim(coalesce(p->>'q', '')), 60), '');
  v_digits text;
  v_segment text := coalesce(p->>'segment', 'all');
  v_tier text := nullif(p->>'tier', '');
  v_sort text := coalesce(p->>'sort', 'last_purchase');
  v_size integer := least(greatest(coalesce((p->>'page_size')::int, 20), 1), 100);
  v_page integer := greatest(coalesce((p->>'page')::int, 1), 1);
begin
  perform private.require_permission('orders.read');
  if v_sort not in ('last_purchase', 'spent', 'orders', 'created', 'name') then v_sort := 'last_purchase'; end if;
  if v_segment not in ('all', 'top', 'new', 'buyers', 'inactive') then v_segment := 'all'; end if;
  v_digits := case when v_q is not null then nullif(regexp_replace(translate(v_q, '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g'), '') end;

  return (
    with s as (
      select c.id, c.name, c.phone, c.tier, c.marketing_consent, c.created_at, c.auth_user_id,
             st.orders_count, st.delivered_count, st.online_spent, st.store_count, st.store_spent,
             st.online_spent + st.store_spent as total_spent, st.last_purchase_at
        from public.customers c join private.customer_stats() st on st.customer_id = c.id
       where (v_q is null or c.name ilike '%' || replace(replace(v_q, '%', ''), '_', '') || '%'
              or (v_digits is not null and length(v_digits) >= 3 and c.phone like '%' || v_digits || '%'))
         and (v_tier is null or c.tier::text = v_tier)
    ), f as (
      select * from s where case v_segment
        when 'top' then total_spent > 0
        when 'new' then created_at > now() - interval '30 days'
        when 'buyers' then total_spent > 0
        when 'inactive' then total_spent > 0 and last_purchase_at < now() - interval '90 days'
        else true end
    ), pg as (
      select * from f order by
        case when v_segment = 'top' or v_sort = 'spent' then total_spent end desc nulls last,
        case when v_sort = 'orders' then orders_count + store_count end desc nulls last,
        case when v_sort = 'created' then created_at end desc,
        case when v_sort = 'name' then name end asc,
        last_purchase_at desc nulls last, created_at desc
      limit v_size offset (v_page - 1) * v_size)
    select jsonb_build_object(
      'total', (select count(*) from f), 'page', v_page, 'page_size', v_size,
      'summary', (select jsonb_build_object(
          'customers', count(*),
          'buyers', count(*) filter (where st.online_spent + st.store_spent > 0),
          'new_30d', count(*) filter (where c.created_at > now() - interval '30 days'),
          'total_spent', coalesce(sum(st.online_spent + st.store_spent), 0))
        from public.customers c join private.customer_stats() st on st.customer_id = c.id),
      'rows', coalesce((select jsonb_agg(jsonb_build_object(
          'id', id, 'name', name, 'phone', phone, 'tier', tier, 'marketing_consent', marketing_consent,
          'created_at', created_at, 'has_account', auth_user_id is not null,
          'orders_count', orders_count, 'delivered_count', delivered_count, 'store_count', store_count,
          'online_spent', online_spent, 'store_spent', store_spent, 'total_spent', total_spent,
          'last_purchase_at', last_purchase_at)
        order by
          case when v_segment = 'top' or v_sort = 'spent' then total_spent end desc nulls last,
          case when v_sort = 'orders' then orders_count + store_count end desc nulls last,
          case when v_sort = 'created' then created_at end desc,
          case when v_sort = 'name' then name end asc,
          last_purchase_at desc nulls last, created_at desc) from pg), '[]')));
end $$;

create or replace function public.admin_customer(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  perform private.require_permission('orders.read');
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'phone', c.phone, 'tier', c.tier, 'marketing_consent', c.marketing_consent,
    'created_at', c.created_at, 'deletion_requested_at', c.deletion_requested_at,
    'email', (select u.email from auth.users u where u.id = c.auth_user_id),
    'stats', (select to_jsonb(st) - 'customer_id' from private.customer_stats() st where st.customer_id = c.id),
    'addresses', coalesce((select jsonb_agg(distinct o.address) from public.orders o
                            where o.customer_id = c.id and coalesce(trim(o.address), '') <> ''), '[]'),
    'orders', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'order_number', o.order_number, 'status', o.status,
                 'total', o.total, 'created_at', o.created_at, 'payment_method', o.payment_method) order by o.created_at desc)
               from (select * from public.orders where customer_id = c.id order by created_at desc limit 100) o), '[]'),
    'store_purchases', case when private.has_permission('sales.review') then coalesce((select jsonb_agg(jsonb_build_object(
                 'id', sp.id, 'amount', sp.amount, 'status', sp.status, 'created_at', sp.created_at, 'branch', b.name)
                 order by sp.created_at desc)
               from (select * from public.store_purchases where customer_id = c.id order by created_at desc limit 100) sp
               join public.branches b on b.id = sp.branch_id), '[]') end)
  into v from public.customers c where c.id = p_id;
  if v is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  return v;
end $$;

revoke all on function public.admin_customers(jsonb) from public, anon;
revoke all on function public.admin_customer(uuid) from public, anon;
grant execute on function public.admin_customers(jsonb) to authenticated;
grant execute on function public.admin_customer(uuid) to authenticated;
create index if not exists customers_created_idx on public.customers(created_at desc);

-- ---------------------------------------------------------------------
-- 6) سجل النشاط (قراءة فقط، لصاحب audit.read)
-- ---------------------------------------------------------------------
create or replace function public.admin_activity(p jsonb default '{}')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_q text := nullif(left(trim(coalesce(p->>'q', '')), 60), '');
  v_entity text := nullif(p->>'entity', '');
  v_actor uuid;
  v_from date; v_to date;
  v_size integer := least(greatest(coalesce((p->>'page_size')::int, 30), 1), 100);
  v_page integer := greatest(coalesce((p->>'page')::int, 1), 1);
begin
  perform private.require_permission('audit.read');
  begin
    v_actor := nullif(p->>'actor', '')::uuid;
    v_from := nullif(p->>'from', '')::date;
    v_to := nullif(p->>'to', '')::date;
  exception when others then raise exception 'invalid_filter' using errcode = '22023';
  end;
  return (
    with f as (
      select a.* from public.activity_logs a
       where (v_entity is null or a.entity = v_entity)
         and (v_actor is null or a.actor_id = v_actor)
         and (v_from is null or a.occurred_at >= v_from::timestamp at time zone 'Asia/Gaza')
         and (v_to is null or a.occurred_at < (v_to + 1)::timestamp at time zone 'Asia/Gaza')
         and (v_q is null or a.action ilike '%' || v_q || '%' or a.entity_id ilike '%' || v_q || '%'
              or a.note ilike '%' || v_q || '%')
    ), pg as (select * from f order by occurred_at desc, id desc limit v_size offset (v_page - 1) * v_size)
    select jsonb_build_object(
      'total', (select count(*) from f), 'page', v_page, 'page_size', v_size,
      'entities', (select coalesce(jsonb_agg(e order by e), '[]') from (select distinct entity as e from public.activity_logs) x),
      'actors', (select coalesce(jsonb_agg(jsonb_build_object('id', pr.id, 'name', coalesce(pr.full_name, u.email)) order by pr.created_at), '[]')
                   from public.profiles pr join auth.users u on u.id = pr.id),
      'rows', coalesce((select jsonb_agg(jsonb_build_object(
          'id', pg.id, 'occurred_at', pg.occurred_at, 'action', pg.action, 'entity', pg.entity, 'entity_id', pg.entity_id,
          'actor_role', pg.actor_role, 'note', pg.note, 'old_values', pg.old_values, 'new_values', pg.new_values,
          'actor', (select coalesce(pr.full_name, u.email) from auth.users u left join public.profiles pr on pr.id = u.id where u.id = pg.actor_id))
        order by pg.occurred_at desc, pg.id desc) from pg), '[]')));
end $$;
revoke all on function public.admin_activity(jsonb) from public, anon;
grant execute on function public.admin_activity(jsonb) to authenticated;
create index if not exists activity_logs_actor_idx on public.activity_logs(actor_id, occurred_at desc);

-- ---------------------------------------------------------------------
-- 7) مركز الإشعارات: أشياء حقيقية تحتاج انتباهاً الآن (لا أرقام وهمية)
-- ---------------------------------------------------------------------
create or replace function public.admin_notifications()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb := '[]';
begin
  if not private.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  if private.has_permission('orders.read') then
    v := v || (select jsonb_build_array(
      jsonb_build_object('kind', 'expiring', 'severity', 'critical', 'href', '/admin/orders?status=received',
        'count', (select count(*) from public.orders where status in ('received', 'awaiting_confirmation')
                    and reservation_expires_at < now() + interval '30 minutes')),
      jsonb_build_object('kind', 'new_orders', 'severity', 'info', 'href', '/admin/orders?status=received',
        'count', (select count(*) from public.orders where status in ('received', 'awaiting_confirmation'))),
      jsonb_build_object('kind', 'transfers', 'severity', 'warning', 'href', '/admin/orders',
        'count', (select count(*) from public.orders where payment_status = 'awaiting_review' and status <> 'cancelled'))));
  end if;
  if private.has_permission('inventory.manage') or private.has_permission('catalog.manage') then
    v := v || (select jsonb_build_array(
      jsonb_build_object('kind', 'out_of_stock', 'severity', 'critical', 'href', '/admin/inventory?filter=out', 'count', count(*) filter (where a <= 0)),
      jsonb_build_object('kind', 'low_stock', 'severity', 'warning', 'href', '/admin/inventory?filter=low', 'count', count(*) filter (where a > 0 and a <= t)))
      from (select sum(i.on_hand - i.reserved) as a, p.low_stock_threshold as t
              from public.products p join public.product_variants pv on pv.product_id = p.id and pv.is_active
              join public.inventory i on i.variant_id = pv.id
             where p.status = 'active' and p.availability_mode = 'stock' group by p.id) s);
  end if;
  if private.has_permission('sales.review') then
    v := v || jsonb_build_array(jsonb_build_object('kind', 'store_sales', 'severity', 'warning',
      'href', '/admin/purchases?source=store&status=pending',
      'count', (select count(*) from public.store_purchases where status = 'submitted')));
  end if;
  return (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(v) x where (x->>'count')::int > 0);
end $$;
revoke all on function public.admin_notifications() from public, anon;
grant execute on function public.admin_notifications() to authenticated;

-- ---------------------------------------------------------------------
-- 8) البحث الشامل: طلبات / عملاء (orders.read) ومنتجات (catalog.manage أو inventory.manage)
-- ---------------------------------------------------------------------
create or replace function public.admin_search(p_q text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_q text := nullif(replace(replace(left(trim(coalesce(p_q, '')), 60), '%', ''), '_', ''), '');
  v_digits text;
begin
  if not private.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_q is null or length(v_q) < 2 then return jsonb_build_object('orders', '[]'::jsonb, 'customers', '[]'::jsonb, 'products', '[]'::jsonb); end if;
  v_digits := nullif(regexp_replace(translate(v_q, '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g'), '');
  return jsonb_build_object(
    'orders', case when private.has_permission('orders.read') then (select coalesce(jsonb_agg(t), '[]') from (
        select id, order_number, customer_name, status, total from public.orders
         where order_number ilike '%' || v_q || '%' or customer_name ilike '%' || v_q || '%'
            or (v_digits is not null and length(v_digits) >= 3 and customer_phone like '%' || v_digits || '%')
         order by created_at desc limit 5) t) else '[]' end,
    'customers', case when private.has_permission('orders.read') then (select coalesce(jsonb_agg(t), '[]') from (
        select id, name, phone from public.customers
         where name ilike '%' || v_q || '%' or (v_digits is not null and length(v_digits) >= 3 and phone like '%' || v_digits || '%')
         order by last_order_at desc nulls last limit 5) t) else '[]' end,
    'products', case when private.has_permission('catalog.manage') or private.has_permission('inventory.manage') then
        (select coalesce(jsonb_agg(t), '[]') from (
        select p.id, p.name, p.status from public.products p
         where p.name ilike '%' || v_q || '%'
            or exists (select 1 from public.product_variants v where v.product_id = p.id and v.sku ilike '%' || v_q || '%')
         order by p.created_at desc limit 5) t) else '[]' end);
end $$;
revoke all on function public.admin_search(text) from public, anon;
grant execute on function public.admin_search(text) to authenticated;

-- ---------------------------------------------------------------------
-- 9) حذف منتج: فقط إن لم يُستخدم قط (لا طلبات ولا حركات مخزون ولا جرد ولا حجوزات)، وإلا الأرشفة
-- ---------------------------------------------------------------------
create or replace function public.delete_product(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_old public.products;
begin
  perform private.require_permission('catalog.manage');
  select * into v_old from public.products where id = p_id for update;
  if v_old.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.order_items where product_id = p_id)
     or exists (select 1 from public.product_variants v where v.product_id = p_id and (
          exists (select 1 from public.inventory_movements m where m.variant_id = v.id)
       or exists (select 1 from public.stock_reservations r where r.variant_id = v.id)
       or exists (select 1 from public.stocktake_items s where s.variant_id = v.id)
       or exists (select 1 from public.inventory i where i.variant_id = v.id and (i.on_hand <> 0 or i.reserved <> 0)))) then
    raise exception 'product_has_history' using errcode = '23503';
  end if;
  delete from public.inventory where variant_id in (select id from public.product_variants where product_id = p_id);
  delete from public.products where id = p_id;
  perform private.log_activity('catalog.product_deleted', 'products', p_id::text,
    jsonb_build_object('name', v_old.name, 'slug', v_old.slug, 'status', v_old.status), null);
end $$;
revoke all on function public.delete_product(uuid) from public, anon;
grant execute on function public.delete_product(uuid) to authenticated;
