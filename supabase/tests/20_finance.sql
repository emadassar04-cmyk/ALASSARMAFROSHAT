-- اختبارات المالية: المصروفات، التقرير يطابق الجداول، الجرد مع بيع أثناء العد، تصنيف العملاء
\set ON_ERROR_STOP 1
create temp table today_v as select (now() at time zone 'Asia/Gaza')::date as d;
grant select on today_v to authenticated, anon;

set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', false);

-- أرباح لكل البنود المؤكدة اليوم حتى تكتمل الحسابات
select public.set_item_profit(i.id, round(i.net_line_amount * 0.2, 2))
  from public.order_items i join public.orders o on o.id = i.order_id
 where o.status not in ('received', 'awaiting_confirmation', 'cancelled') and i.manager_profit_amount is null;

-- المصروفات
select public.add_expense('delivery', 30, 'أجرة المندوب');
insert into tests.ctx select 'e2', to_jsonb(public.add_expense('marketing', 20, 'إعلان'));
select public.void_expense((select (v->>'id')::uuid from tests.ctx where k = 'e2'), 'أُدخل بالخطأ');
select tests.throws($$select public.void_expense((select (v->>'id')::uuid from tests.ctx where k = 'e2'), 'مرة ثانية')$$,
  'expense_not_found_or_voided', 'لا يمكن إلغاء المصروف مرتين');
select tests.throws($$select public.add_expense('other', -5, 'سالب')$$, 'invalid_amount', 'مبلغ سالب مرفوض');
select tests.throws($$select public.add_expense('other', 1.234, 'كسور')$$, 'invalid_amount', 'أكثر من منزلتين مرفوض');
select tests.throws($$insert into public.expenses (category, amount, description) values ('other', 5, 'مباشر')$$,
  'permission denied', 'لا إدخال مباشر للمصروفات (عبر الدالة فقط)');
select tests.throws($$delete from public.expenses$$, 'permission denied', 'لا حذف للمصروفات');

-- التقرير يطابق الجداول (حساب مستقل)
insert into tests.ctx select 'r', public.finance_report((select d from today_v), (select d from today_v));
reset role;
create temp table expect as
select coalesce(sum(o.total), 0) as revenue, count(*) as orders, coalesce(sum(o.delivery_fee), 0) as fees,
       (select coalesce(sum(i.manager_profit_amount), 0) from public.order_items i join public.orders x on x.id = i.order_id
         where (x.confirmed_at at time zone 'Asia/Gaza')::date = (select d from today_v) and x.status <> 'cancelled') as profit,
       (select coalesce(sum(i.store_due_amount), 0) from public.order_items i join public.orders x on x.id = i.order_id
         where (x.confirmed_at at time zone 'Asia/Gaza')::date = (select d from today_v) and x.status <> 'cancelled') as due
  from public.orders o
 where (o.confirmed_at at time zone 'Asia/Gaza')::date = (select d from today_v) and o.status <> 'cancelled';
select tests.ok((select (v->'kpis'->>'revenue')::numeric = e.revenue and (v->'kpis'->>'orders')::int = e.orders
  from tests.ctx, expect e where k = 'r'), 'الإيراد وعدد الطلبات يطابقان الجداول');
select tests.ok((select (v->'kpis'->>'manager_profit')::numeric = e.profit and (v->'kpis'->>'store_due')::numeric = e.due
  from tests.ctx, expect e where k = 'r'), 'ربح المدير ومستحقات المحل يطابقان البنود');
select tests.ok((select (v->'kpis'->>'expenses')::numeric = 30 from tests.ctx where k = 'r'), 'المصروف الملغى لا يُحتسب');
select tests.ok((select (v->'kpis'->>'manager_net')::numeric = e.profit + e.fees - 30 from tests.ctx, expect e where k = 'r'),
  'صافي ربح المدير = الربح + رسوم التوصيل − المصروفات');
select tests.ok((select (v->'kpis'->>'manager_profit')::numeric + (v->'kpis'->>'store_due')::numeric
  = (v->'kpis'->>'products_net')::numeric from tests.ctx where k = 'r'), 'الربح + المستحقات = صافي المنتجات (لا فرق ضائع)');
select tests.ok((select sum((x->>'revenue')::numeric) = (v->'kpis'->>'revenue')::numeric
  from tests.ctx, jsonb_array_elements(v->'daily') x where k = 'r' group by v), 'مجموع الأيام = إجمالي الفترة');
select tests.ok((select sum((x->>'revenue')::numeric) = (v->'kpis'->>'products_net')::numeric
  from tests.ctx, jsonb_array_elements(v->'products') x where k = 'r' group by v), 'مجموع المنتجات = صافي المنتجات');
select tests.ok((select v->'previous' ? 'revenue' and jsonb_array_length(v->'daily') = 1 from tests.ctx where k = 'r'),
  'مقارنة بالفترة السابقة + سلسلة يومية');

set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', false);
select tests.throws($$select public.finance_report('2026-01-01', '2028-01-01')$$, 'invalid_range', 'فترة أطول من سنة مرفوضة');
select tests.ok((public.admin_dashboard()->>'finance_visible')::boolean and public.admin_dashboard() ? 'low_stock',
  'لوحة المعلومات للمدير');

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000c","aal":"aal2"}', false);
select tests.throws($$select public.finance_report(current_date, current_date)$$, 'forbidden', 'العميل لا يرى التقارير');
select tests.throws($$select public.admin_dashboard()$$, 'forbidden', 'العميل لا يرى لوحة المعلومات');
select tests.ok((select count(*) = 0 from public.expenses), 'العميل لا يرى المصروفات');
select tests.throws($$select public.set_customer_tier((select id from public.customers limit 1), 'vip')$$, 'forbidden',
  'العميل لا يغيّر التصنيفات');
set role anon;
select tests.throws($$select public.finance_report(current_date, current_date)$$, 'permission denied', 'الزائر لا يرى التقارير');

-- الجرد مع بيع أثناء العد
reset role;
update public.inventory set on_hand = 20, reserved = 0 where variant_id = 'b0000000-0000-0000-0000-000000000002';
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', false);
insert into tests.ctx select 's1', to_jsonb(public.start_stocktake('جرد نهاية الشهر'));
select tests.throws($$select public.start_stocktake()$$, 'stocktake_already_open', 'جرد واحد مفتوح فقط');
select tests.ok((select expected_on_hand = 20 from public.stocktake_items where variant_id = 'b0000000-0000-0000-0000-000000000002'
  and stocktake_id = (select (v->>'id')::uuid from tests.ctx where k = 's1')), 'الكمية المتوقعة ملتقطة عند البدء');
select public.set_stocktake_count((select id from public.stocktake_items where variant_id = 'b0000000-0000-0000-0000-000000000002'
  and stocktake_id = (select (v->>'id')::uuid from tests.ctx where k = 's1')), 17);
select public.record_in_store_sale('b0000000-0000-0000-0000-000000000002', 2, 'بيع أثناء الجرد');
insert into tests.ctx select 's1r', public.apply_stocktake((select (v->>'id')::uuid from tests.ctx where k = 's1'));
reset role;
select tests.ok((select on_hand = 15 from public.inventory where variant_id = 'b0000000-0000-0000-0000-000000000002'),
  'الجرد يطبّق الفرق (17−20) على الكمية الحالية فلا يضيع بيع أثناء العد: 20−2−3 = 15');
select tests.ok((select v->>'adjusted' = '1' and v->>'total_delta' = '-3' from tests.ctx where k = 's1r'), 'ملخص الجرد');
select tests.ok(exists (select 1 from public.inventory_movements where kind = 'stocktake' and on_hand_delta = -3
  and variant_id = 'b0000000-0000-0000-0000-000000000002'), 'حركة جرد مسجلة');
set role authenticated;
select tests.throws($$select public.set_stocktake_count(1, 5)$$, 'stocktake_not_open', 'لا تعديل على جرد معتمد');
select tests.throws($$select public.apply_stocktake((select (v->>'id')::uuid from tests.ctx where k = 's1'))$$,
  'stocktake_not_open', 'لا اعتماد الجرد مرتين');

-- الجرد لا ينزل تحت المحجوز
reset role;
update public.inventory set reserved = 10 where variant_id = 'b0000000-0000-0000-0000-000000000002';
set role authenticated;
insert into tests.ctx select 's2', to_jsonb(public.start_stocktake());
select public.set_stocktake_count((select id from public.stocktake_items where variant_id = 'b0000000-0000-0000-0000-000000000002'
  and stocktake_id = (select (v->>'id')::uuid from tests.ctx where k = 's2')), 5);
select tests.throws($$select public.apply_stocktake((select (v->>'id')::uuid from tests.ctx where k = 's2'))$$,
  'stocktake_below_reserved', 'الجرد لا يجعل الكمية أقل من المحجوز');
select public.cancel_stocktake((select (v->>'id')::uuid from tests.ctx where k = 's2'));
reset role;
update public.inventory set reserved = 0 where variant_id = 'b0000000-0000-0000-0000-000000000002';

-- تصنيف VIP يفعّل كوبونات VIP
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', false);
select public.set_customer_tier((select id from public.customers where phone = '0599000004'), 'vip');
select tests.throws($$update public.customers set name = 'x'$$, 'permission denied', 'لا تعديل مباشر لبيانات العميل');
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select tests.ok((public.quote_order('{"coupon_code":"VIPONLY","phone":"0599000004","items":[{"variant_id":"b0000000-0000-0000-0000-000000000002","quantity":1}]}')
  ->'coupon'->>'valid')::boolean, 'عميل VIP يستخدم كوبون VIP');
reset role;
select tests.ok(exists (select 1 from public.activity_logs where action = 'customer.tier'), 'تغيير التصنيف مسجل');
select tests.ok(exists (select 1 from public.activity_logs where action = 'finance.expense_voided'), 'إلغاء المصروف مسجل');
select 'ALL FINANCE TESTS PASSED' as result;
