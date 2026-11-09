-- اختبارات لوحة الإدارة الجديدة (0023): اللغة، الأدوار ومصفوفة الصلاحيات، النظرة العامة، الطلبات، العملاء،
-- سجل النشاط، الإشعارات، البحث، حذف المنتج. تُشغَّل بعد 23_mvp.sql.
\set ON_ERROR_STOP 1
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1', 'viewer@test.local');
insert into public.profiles (id, full_name, role_id) select '00000000-0000-0000-0000-0000000000d1', 'مشاهد', id from public.roles where code = 'viewer';
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d2', 'orders@test.local');
insert into public.profiles (id, full_name, role_id) select '00000000-0000-0000-0000-0000000000d2', 'مدير طلبات', id from public.roles where code = 'orders_manager';
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d3', 'reception2@test.local');
insert into public.profiles (id, full_name, role_id) select '00000000-0000-0000-0000-0000000000d3', 'استقبال 2', id from public.roles where code = 'reception';
create temp table today24 as select (now() at time zone 'Asia/Gaza')::date as d;
grant select on today24 to authenticated, anon;

-- ============ 1) الأدوار الجاهزة ============
select tests.ok((select count(*) = 5 from public.roles where code in ('store_manager', 'orders_manager', 'products_manager', 'accountant', 'viewer')),
  'خمسة أدوار جاهزة جديدة');
select tests.ok(not exists (select 1 from public.role_permissions rp join public.roles r on r.id = rp.role_id join public.permissions p on p.id = rp.permission_id
  where r.code = 'store_manager' and p.code in ('staff.manage', 'settings.manage')), 'مدير المتجر لا يدير الموظفين ولا الإعدادات');
select tests.ok((select array_agg(p.code order by p.code) = '{orders.read}' from public.role_permissions rp join public.roles r on r.id = rp.role_id
  join public.permissions p on p.id = rp.permission_id where r.code = 'viewer'), 'المشاهد: عرض الطلبات فقط');
select tests.ok((select name_en = 'Super Admin' and name_ar = 'المدير العام' from public.roles where code = 'owner'), 'اسم المدير العام بالعربية والإنجليزية');

-- ============ 2) اللغة ============
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select tests.throws($$select public.set_my_locale('en')$$, 'permission denied', 'الزائر لا يغيّر لغة أحد');
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000d1","aal":"aal2"}', false);
select public.set_my_locale('en');
select tests.ok((select c->>'locale' = 'en' and c->>'role_name_en' = 'Viewer' from public.my_staff_context() c), 'اللغة تُحفظ لكل موظف وتعود في سياقه');
select tests.throws($$select public.set_my_locale('fr')$$, 'invalid_locale', 'لغة غير مدعومة مرفوضة');
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000d1","aal":"aal1"}', false);
select tests.throws($$select public.set_my_locale('ar')$$, 'forbidden', 'لا تغيير قبل الخطوة الثانية');

-- ============ 3) المشاهد: يرى الطلبات فقط ============
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000d1","aal":"aal2"}', false);
insert into tests.ctx select 'ov_viewer', public.admin_overview((select d from today24) - 6, (select d from today24));
select tests.ok((select v->'finance' = 'null'::jsonb and v->'series' = 'null'::jsonb and v->'orders' ? 'current' from tests.ctx where k = 'ov_viewer'),
  'المشاهد يرى أعداد الطلبات دون أي رقم مالي');
select tests.throws($$select public.admin_activity('{}')$$, 'forbidden', 'المشاهد لا يرى سجل النشاط');
select tests.throws($$select public.admin_roles()$$, 'forbidden', 'المشاهد لا يرى مصفوفة الصلاحيات');
select tests.throws($$select public.delete_product(gen_random_uuid())$$, 'forbidden', 'المشاهد لا يحذف المنتجات');
select tests.ok(public.admin_search('ab')->'products' = '[]'::jsonb, 'البحث لا يعرض المنتجات لمن لا يملك صلاحية الكتالوج');
select tests.ok(not exists (select 1 from jsonb_array_elements(public.admin_notifications()) n where n->>'kind' in ('low_stock', 'out_of_stock', 'store_sales')),
  'الإشعارات حسب الصلاحية فقط');

-- ============ 4) الاستقبال: لا يرى الطلبات، والحساب الموقوف لا يرى شيئاً ============
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000b1","aal":"aal2"}', false);
select tests.throws($$select public.admin_overview(current_date, current_date)$$, 'forbidden', 'الحساب الموقوف لا يرى لوحة المعلومات');
select tests.throws($$select public.admin_notifications()$$, 'forbidden', 'الحساب الموقوف لا يرى الإشعارات');
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000d3","aal":"aal2"}', false);
select tests.throws($$select public.admin_orders('{}')$$, 'forbidden', 'موظف الاستقبال لا يرى قائمة الطلبات');
select tests.throws($$select public.admin_customers('{}')$$, 'forbidden', 'موظف الاستقبال لا يرى العملاء');
select tests.ok((select v->'orders' = 'null'::jsonb from (select public.admin_overview(current_date, current_date) v) x), 'النظرة العامة فارغة لمن لا يملك صلاحيات');

-- ============ 5) المدير: النظرة العامة تطابق التقارير ============
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', false);
insert into tests.ctx select 'ov7', public.admin_overview((select d from today24) - 6, (select d from today24));
insert into tests.ctx select 'fr7', public.finance_report((select d from today24) - 6, (select d from today24));
select tests.ok((select a.v->'finance'->'current' = b.v->'kpis' and a.v->'finance'->'previous' = b.v->'previous' from tests.ctx a, tests.ctx b where a.k = 'ov7' and b.k = 'fr7'),
  'أرقام النظرة العامة = finance_report نفسه (لا حسابات موازية)');
select tests.ok((select jsonb_array_length(v->'series') = 7 and jsonb_array_length(v->'series_prev') = 7 and v->>'unit' = 'day' from tests.ctx where k = 'ov7'),
  'سلسلة يومية للفترة والفترة السابقة');
select tests.ok((select sum((x->>'revenue')::numeric) = (v->'finance'->'current'->>'revenue')::numeric from tests.ctx, jsonb_array_elements(v->'series') x where k = 'ov7' group by v),
  'مجموع السلسلة = إجمالي المبيعات');
select tests.ok((select sum((x->>'revenue')::numeric) = (v->'finance'->'current'->>'revenue')::numeric from tests.ctx, jsonb_array_elements(v->'weekdays') x where k = 'ov7' group by v),
  'مجموع أيام الأسبوع = إجمالي المبيعات');
select tests.ok((select jsonb_array_length(public.admin_overview((select d from today24), (select d from today24))->'series') = 24), 'يوم واحد = 24 ساعة');
select tests.ok((select public.admin_overview((select d from today24) - 200, (select d from today24))->>'unit' = 'month'), 'فترة طويلة = بالشهر');
select tests.throws($$select public.admin_overview(current_date, current_date - 1)$$, 'invalid_range', 'فترة مقلوبة مرفوضة');
select tests.throws($$select public.admin_overview(current_date - 400, current_date)$$, 'invalid_range', 'أكثر من سنة مرفوضة');
select tests.ok((select (v->'orders'->'current'->>'total')::int = (select count(*) from public.orders
  where created_at >= ((select d from today24) - 6)::timestamp at time zone 'Asia/Gaza') from tests.ctx where k = 'ov7'), 'عدد الطلبات يطابق الجدول');

-- ============ 6) قائمة الطلبات: ترقيم حقيقي وفلترة وفرز ============
select tests.ok((public.admin_orders('{"page_size":2}')->>'total')::int = (select count(*) from public.orders), 'الإجمالي = كل الطلبات');
select tests.ok(jsonb_array_length(public.admin_orders('{"page_size":2}')->'rows') = least(2, (select count(*) from public.orders)::int), 'حجم الصفحة');
select tests.ok(jsonb_array_length(public.admin_orders('{"page_size":1000}')->'rows') <= 100, 'حد أقصى 100 بالصفحة');
select tests.ok((select bool_and(x->>'status' = 'cancelled') from jsonb_array_elements(public.admin_orders('{"status":"cancelled","page_size":100}')->'rows') x) is not false,
  'فلترة الحالة');
select tests.ok((select (r->'rows'->0->>'total')::numeric <= (r->'rows'->1->>'total')::numeric from (select public.admin_orders('{"sort":"total","dir":"asc","page_size":5}') r) x)
  or (select count(*) < 2 from public.orders), 'الفرز بالمبلغ تصاعدياً');
select tests.ok((select (public.admin_orders(jsonb_build_object('q', order_number))->>'total')::int >= 1 from public.orders limit 1), 'البحث برقم الطلب');
select tests.ok((public.admin_orders('{"q":"%"}')->>'total')::int = (public.admin_orders('{"q":"%"}')->>'total')::int, 'رموز البحث لا تكسر الاستعلام');
select tests.throws($$select public.admin_orders('{"status":"nope"}')$$, 'invalid_filter', 'حالة غير معروفة مرفوضة');
select tests.ok(not exists (select 1 from jsonb_array_elements(public.admin_orders('{"open":true,"page_size":100}')->'rows') x where x->>'status' in ('delivered', 'cancelled')),
  'لوحة الحالات: الطلبات المفتوحة فقط');
select public.admin_orders('{"export":true}');
select tests.ok(exists (select 1 from public.activity_logs where action = 'orders.exported'), 'التصدير يُسجَّل في سجل النشاط');

-- ============ 7) العملاء (CRM) ============
insert into tests.ctx select 'cust', public.admin_customers('{"sort":"spent","page_size":100}');
select tests.ok((select (v->>'total')::int = (select count(*) from public.customers) from tests.ctx where k = 'cust'), 'كل العملاء');
select tests.ok((select bool_and((x->>'online_spent')::numeric = (select coalesce(sum(o.total), 0) from public.orders o
    where o.customer_id = (x->>'id')::uuid and o.confirmed_at is not null and o.status <> 'cancelled'))
  from tests.ctx, jsonb_array_elements(v->'rows') x where k = 'cust'), 'مشتريات الموقع = الطلبات المؤكدة غير الملغاة');
select tests.ok((select bool_and((x->>'store_spent')::numeric = (select coalesce(sum(s.amount), 0) from public.store_purchases s
    where s.customer_id = (x->>'id')::uuid and s.status = 'approved'))
  from tests.ctx, jsonb_array_elements(v->'rows') x where k = 'cust'), 'مشتريات الفروع = المعتمدة فقط');
select tests.ok((select (v->'summary'->>'total_spent')::numeric = (select sum((x->>'total_spent')::numeric) from jsonb_array_elements(v->'rows') x)
  from tests.ctx where k = 'cust'), 'الملخص = مجموع العملاء');
select tests.ok((select public.admin_customer((select id from public.customers limit 1)) ? 'orders'), 'ملف العميل');
select tests.throws($$select public.admin_customer(gen_random_uuid())$$, 'not_found', 'عميل غير موجود');

-- ============ 8) مصفوفة الصلاحيات ============
select tests.throws($$select public.set_role_permissions('owner', '{}')$$, 'cannot_change_owner', 'لا تعديل لصلاحيات المدير العام');
select tests.throws($$select public.set_role_permissions('viewer', '{orders.read,hack.all}')$$, 'invalid_permission', 'صلاحية غير معروفة مرفوضة');
select public.set_role_permissions('viewer', '{orders.read,audit.read}');
select tests.ok(exists (select 1 from public.activity_logs where action = 'staff.role_permissions' and entity_id = 'viewer'), 'تعديل الصلاحيات يُسجَّل');
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000d1","aal":"aal2"}', false);
select tests.ok((public.admin_activity('{"page_size":5}')->>'total')::int > 0, 'الصلاحية الجديدة تعمل فوراً (المشاهد يرى السجل)');
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', false);
select public.set_role_permissions('viewer', '{orders.read}');
select tests.ok(exists (select 1 from jsonb_array_elements(public.admin_roles()->'roles') r where r->>'code' = 'owner' and (r->>'locked')::boolean), 'المدير العام مقفل في المصفوفة');

-- ============ 9) حذف المنتج ============
reset role;
insert into public.products (slug, name, category_id, unit_id, status, price)
select 'منتج-للحذف', 'منتج للحذف', (select id from public.categories limit 1), (select id from public.units limit 1), 'draft', 10;
insert into public.product_variants (product_id, name, is_default) select id, 'افتراضي', true from public.products where slug = 'منتج-للحذف';
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', false);
select tests.throws($$select public.delete_product((select product_id from public.order_items where product_id is not null limit 1))$$,
  'product_has_history', 'منتج له طلبات لا يُحذف (يُؤرشف)');
select public.delete_product((select id from public.products where slug = 'منتج-للحذف'));
select tests.ok(not exists (select 1 from public.products where slug = 'منتج-للحذف'), 'منتج بلا تاريخ يُحذف');
select tests.ok(exists (select 1 from public.activity_logs where action = 'catalog.product_deleted'), 'الحذف يُسجَّل في سجل النشاط');
reset role;
