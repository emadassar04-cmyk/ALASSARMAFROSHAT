-- اختبارات قواعد العمل والأمان. تُشغَّل عبر run_tests.sh على قاعدة اختبار محلية فقط.
\set ON_ERROR_STOP 1
\set QUIET 1

-- ============ أدوات الاختبار ============
create schema tests;
grant usage on schema tests to anon, authenticated, service_role;

create function tests.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'FAIL: %', p_msg; end if;
  raise notice 'PASS: %', p_msg;
end $$;

-- ينفذ SQL ويتوقع خطأ يحتوي النص المحدد
create function tests.throws(p_sql text, p_like text, p_msg text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm ilike '%' || p_like || '%' then
      raise notice 'PASS: % (error: %)', p_msg, sqlerrm;
      return;
    end if;
    raise exception 'FAIL: % -> unexpected error: %', p_msg, sqlerrm;
  end;
  raise exception 'FAIL: % -> no error raised', p_msg;
end $$;
grant execute on all functions in schema tests to anon, authenticated, service_role;

-- مكان لحفظ نتائج وسيطة بين الأدوار
create table tests.ctx (k text primary key, v jsonb);
grant all on tests.ctx to anon, authenticated, service_role;

-- ============ بيانات الاختبار (كمالك قاعدة البيانات) ============
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'customer@test.local');
insert into public.profiles (id, full_name, role_id)
  select '00000000-0000-0000-0000-00000000000a', 'مدير الاختبار', id from public.roles where code = 'owner';

update public.store_settings set is_published = true;

insert into public.products (id, slug, name, category_id, unit_id, status, price, low_stock_threshold) values
  ('a0000000-0000-0000-0000-000000000001', 'سجادة-أ', 'سجادة أ', (select id from public.categories where slug='سجاد-وموكيت'),
   (select id from public.units where code='piece'), 'active', 100, 2),
  ('a0000000-0000-0000-0000-000000000002', 'مخدة-ب', 'مخدة ب', (select id from public.categories where slug='مخدات'),
   (select id from public.units where code='piece'), 'active', 50, 2),
  ('a0000000-0000-0000-0000-000000000003', 'لحاف-حسب-الطلب', 'لحاف حسب الطلب', null,
   (select id from public.units where code='piece'), 'active', 200, 2),
  ('a0000000-0000-0000-0000-000000000005', 'مسودة', 'منتج مسودة', null,
   (select id from public.units where code='piece'), 'draft', 10, 2);
update public.products set availability_mode = 'made_to_order' where id = 'a0000000-0000-0000-0000-000000000003';
insert into public.products (id, slug, name, unit_id, status, requires_measurement) values
  ('a0000000-0000-0000-0000-000000000004', 'ستارة-تفصيل', 'ستارة تفصيل',
   (select id from public.units where code='meter'), 'active', true);

insert into public.product_variants (id, product_id, is_default) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', true),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', true),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', true),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', true),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', true);
insert into public.variant_costs values
  ('b0000000-0000-0000-0000-000000000001', 60), ('b0000000-0000-0000-0000-000000000002', 30);
update public.inventory set on_hand = 1  where variant_id = 'b0000000-0000-0000-0000-000000000001';
update public.inventory set on_hand = 50 where variant_id = 'b0000000-0000-0000-0000-000000000002';

insert into public.delivery_zones (id, name, fee) values ('c0000000-0000-0000-0000-000000000001', 'دير البلح', 20);
insert into public.coupons (code, kind, value, max_uses) values ('SAVE10', 'percent', 10, 1), ('SAVE15', 'percent', 15, null);
insert into public.coupons (code, kind, value, vip_only) values ('VIPONLY', 'fixed', 5, true);

-- ============ 1) الزائر: ما يراه وما لا يراه ============
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);

select tests.ok((select count(*) from public.products) = 4, 'الزائر يرى المنتجات النشطة فقط (المسودة مخفية)');
select tests.throws('select * from public.variant_costs', 'permission denied', 'الزائر لا يقرأ التكاليف');
select tests.throws('select * from public.inventory', 'permission denied', 'الزائر لا يقرأ الكميات');
select tests.throws('select * from public.order_items', 'permission denied', 'الزائر لا يقرأ بنود الطلبات');
select tests.throws('select * from public.orders', 'permission denied', 'الزائر لا يقرأ الطلبات');
select tests.throws('select * from public.coupons', 'permission denied', 'الزائر لا يقرأ الكوبونات');
update public.products set price = 1;  -- RLS يمنعه بصمت (0 صفوف)
select tests.ok((select count(*) from public.products where price = 1) = 0, 'الأسعار لم تتغير');

select tests.ok((select jsonb_object_agg(variant_id, availability) from public.get_variant_availability(array[
  'b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000004']::uuid[]))
  = '{"b0000000-0000-0000-0000-000000000001":"limited","b0000000-0000-0000-0000-000000000002":"in_stock",
      "b0000000-0000-0000-0000-000000000003":"made_to_order","b0000000-0000-0000-0000-000000000004":"made_to_order"}'::jsonb,
  'حالة التوفر تظهر كتصنيف دون كمية');

select tests.throws($$select public.place_order('{}')$$, 'permission denied',
  'الزائر لا يستدعي place_order مباشرة (فقط عبر خادم Next.js)');

-- ============ 2) إنشاء الطلب والحجز (من الخادم بمفتاح service_role) ============
set role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
insert into tests.ctx select 'o1', public.place_order('{
  "customer_name":"أحمد","phone":"0599-000-001","fulfillment":"pickup","payment_method":"cash_in_store",
  "terms_accepted":true,"items":[{"variant_id":"b0000000-0000-0000-0000-000000000001","quantity":1,"price":0.01}]}');
select tests.ok((select (v->>'total')::numeric = 100 from tests.ctx where k='o1'), 'السعر من قاعدة البيانات وليس من المتصفح');
select tests.ok((select (v->>'reservation_expires_at')::timestamptz between now() + interval '119 minutes' and now() + interval '121 minutes'
  from tests.ctx where k='o1'), 'مدة الحجز ساعتان');

select tests.throws($$select public.place_order('{"customer_name":"سارة","phone":"0599000002","fulfillment":"pickup",
  "payment_method":"cash_in_store","terms_accepted":true,
  "items":[{"variant_id":"b0000000-0000-0000-0000-000000000001","quantity":1}]}')$$,
  'insufficient_stock', 'لا يمكن حجز آخر قطعة مرتين');

select tests.throws($$select public.place_order('{"customer_name":"سارة","phone":"0599000002","fulfillment":"pickup",
  "payment_method":"cash_in_store","terms_accepted":true,
  "items":[{"variant_id":"b0000000-0000-0000-0000-000000000004","quantity":1}]}')$$,
  'requires_measurement', 'منتجات القياس لا تُطلب بسعر تلقائي');
select tests.throws($$select public.place_order('{"customer_name":"سارة","phone":"0599000002","fulfillment":"pickup",
  "payment_method":"cash_on_delivery","terms_accepted":true,
  "items":[{"variant_id":"b0000000-0000-0000-0000-000000000002","quantity":1}]}')$$,
  'payment_fulfillment_mismatch', 'الدفع عند الاستلام يتطلب توصيلاً');
select tests.throws($$select public.place_order('{"customer_name":"سارة","phone":"0599000002","fulfillment":"pickup",
  "payment_method":"cash_in_store","terms_accepted":false,
  "items":[{"variant_id":"b0000000-0000-0000-0000-000000000002","quantity":1}]}')$$,
  'terms_not_accepted', 'الموافقة على الشروط إلزامية');
select tests.throws($$select public.place_order('{"customer_name":"سارة","phone":"0599000002","fulfillment":"pickup",
  "payment_method":"cash_in_store","terms_accepted":true,
  "items":[{"variant_id":"b0000000-0000-0000-0000-000000000005","quantity":1}]}')$$,
  'product_unavailable', 'لا يمكن طلب منتج غير منشور');
select tests.throws($$select public.place_order('{"customer_name":"سارة","phone":"0599000002","fulfillment":"pickup",
  "payment_method":"cash_in_store","terms_accepted":true,
  "items":[{"variant_id":"b0000000-0000-0000-0000-000000000002","quantity":-3}]}')$$,
  'invalid_items', 'الكمية السالبة مرفوضة');

-- توصيل + كوبون + توزيع الخصم على البنود
insert into tests.ctx select 'o2', public.place_order('{
  "customer_name":"سارة","phone":"0599000002","fulfillment":"delivery","payment_method":"cash_on_delivery",
  "delivery_zone_id":"c0000000-0000-0000-0000-000000000001","address":"دير البلح، شارع البحر",
  "coupon_code":"save10","terms_accepted":true,
  "items":[{"variant_id":"b0000000-0000-0000-0000-000000000002","quantity":2}]}');
select tests.ok((select v->>'discount' = '10.00' and v->>'total' = '110.00' from tests.ctx where k='o2'),
  'كوبون 10% + رسوم توصيل 20: 100 − 10 + 20 = 110');
select tests.throws($$select public.place_order('{"customer_name":"سارة","phone":"0599000003","fulfillment":"pickup",
  "payment_method":"cash_in_store","coupon_code":"SAVE10","terms_accepted":true,
  "items":[{"variant_id":"b0000000-0000-0000-0000-000000000002","quantity":1}]}')$$,
  'invalid_coupon', 'الكوبون لا يتجاوز حد الاستخدام');
select tests.throws($$select public.place_order('{"customer_name":"سارة","phone":"0599000003","fulfillment":"pickup",
  "payment_method":"cash_in_store","coupon_code":"VIPONLY","terms_accepted":true,
  "items":[{"variant_id":"b0000000-0000-0000-0000-000000000002","quantity":1}]}')$$,
  'invalid_coupon', 'كوبون VIP مرفوض لعميل عادي');

insert into tests.ctx select 'o3', public.place_order('{
  "customer_name":"منى","phone":"0599000004","fulfillment":"pickup","payment_method":"bank_transfer",
  "coupon_code":"SAVE15","terms_accepted":true,
  "items":[{"variant_id":"b0000000-0000-0000-0000-000000000002","quantity":1},
           {"variant_id":"b0000000-0000-0000-0000-000000000003","quantity":1}]}');
select tests.ok((select v->>'discount' = '37.50' and v->>'total' = '212.50' and v->>'reservation_expires_at' is not null
  from tests.ctx where k='o3'), 'خصم 15% على 250 = 37.50');

reset role;
select tests.ok((select sum(discount_amount) = 37.50 and min(discount_amount) = 7.50
  from public.order_items where order_id = (select (v->>'order_id')::uuid from tests.ctx where k='o3')),
  'الخصم موزع على البنود بالتناسب ومجموعه مطابق');
select tests.ok((select reserved = 1 and on_hand = 1 from public.inventory
  where variant_id = 'b0000000-0000-0000-0000-000000000001'), 'الحجز لا يخصم المخزون النهائي');
select tests.ok((select reserved = 3 from public.inventory where variant_id = 'b0000000-0000-0000-0000-000000000002'),
  'حجز مخدة ب = 2 + 1');
select tests.ok((select count(*) = 0 from public.stock_reservations where variant_id = 'b0000000-0000-0000-0000-000000000003'),
  'منتج حسب الطلب لا يحجز مخزوناً');
select tests.ok((select count(*) = 2 from public.notification_outbox
  where order_id = (select (v->>'order_id')::uuid from tests.ctx where k='o3')),
  'حدث طلب جديد + حدث تحويل بنكي في صندوق الأحداث');

-- ============ 3) تتبع الطلب ============
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select tests.ok(public.track_order((select v->>'order_number' from tests.ctx where k='o1'), 'wrong') is null,
  'التتبع برمز خاطئ لا يعيد شيئاً');
select tests.ok((select public.track_order(v->>'order_number', v->>'tracking_token') ->> 'status' = 'received'
  from tests.ctx where k='o1'), 'التتبع بالرمز الصحيح يعمل');
select tests.ok((select public.track_order(v->>'order_number', v->>'tracking_token')::text !~ '(cost|profit|store_due)'
  from tests.ctx where k='o1'), 'التتبع لا يكشف التكلفة أو الربح');

-- ============ 4) صلاحيات المدير و2FA ============
set role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal1"}', false);
select tests.throws($$select public.confirm_order((select (v->>'order_id')::uuid from tests.ctx where k='o1'))$$,
  'forbidden', 'المدير دون خطوتين (aal1) لا يملك صلاحيات');
select tests.ok((select count(*) from public.orders) = 0, 'aal1 لا يقرأ الطلبات');

select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000c","aal":"aal2"}', false);
select tests.ok((select count(*) from public.orders) = 0, 'عميل مسجل لا يقرأ طلبات غيره');
select tests.ok((select count(*) from public.order_items) = 0, 'عميل مسجل لا يقرأ بنود الطلبات');
select tests.throws($$select public.set_item_profit((select id from public.order_items limit 1), 1)$$,
  'forbidden', 'عميل مسجل لا يحدد الأرباح');

select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', false);
select tests.ok((select count(*) from public.orders) = 3, 'المدير (aal2) يقرأ الطلبات');
select tests.throws($$update public.inventory set on_hand = 999$$, 'permission denied',
  'حتى المدير لا يعدل المخزون مباشرة (فقط عبر الدوال)');

select public.confirm_order((select (v->>'order_id')::uuid from tests.ctx where k='o1'));
select tests.throws($$select public.confirm_order((select (v->>'order_id')::uuid from tests.ctx where k='o1'))$$,
  'invalid_transition', 'لا يمكن تأكيد الطلب مرتين');

reset role;
select tests.ok((select on_hand = 0 and reserved = 0 from public.inventory
  where variant_id = 'b0000000-0000-0000-0000-000000000001'), 'التأكيد حوّل الحجز إلى خصم نهائي');
select tests.ok((select unit_cost_snapshot = 60 from public.order_items
  where order_id = (select (v->>'order_id')::uuid from tests.ctx where k='o1')), 'لقطة التكلفة محفوظة وقت التأكيد');
update public.variant_costs set unit_cost = 75 where variant_id = 'b0000000-0000-0000-0000-000000000001';
select tests.ok((select unit_cost_snapshot = 60 from public.order_items
  where order_id = (select (v->>'order_id')::uuid from tests.ctx where k='o1')), 'تعديل التكلفة لاحقاً لا يغير اللقطة');

-- ============ 5) الربح اليدوي ومستحقات المحل ============
set role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', false);
select public.set_item_profit((select id from public.order_items
  where order_id = (select (v->>'order_id')::uuid from tests.ctx where k='o1')), 25.50);
select tests.ok((select manager_profit_amount = 25.50 and store_due_amount = 74.50 from public.order_items
  where order_id = (select (v->>'order_id')::uuid from tests.ctx where k='o1')), 'مستحقات المحل = 100 − 25.50 = 74.50');
select tests.throws($$select public.set_item_profit((select id from public.order_items
  where order_id = (select (v->>'order_id')::uuid from tests.ctx where k='o1')), 100.01)$$,
  'profit_exceeds_net_line', 'الربح لا يتجاوز صافي البند');
select tests.throws($$select public.set_item_profit((select id from public.order_items
  where order_id = (select (v->>'order_id')::uuid from tests.ctx where k='o2')), 1)$$,
  'order_not_confirmed', 'لا ربح لطلب غير مؤكد');

-- ============ 6) مسار الحالات والإلغاء ============
select public.confirm_order((select (v->>'order_id')::uuid from tests.ctx where k='o2'));
select public.update_order_status((select (v->>'order_id')::uuid from tests.ctx where k='o2'), 'preparing');
select tests.throws($$select public.update_order_status((select (v->>'order_id')::uuid from tests.ctx where k='o2'), 'ready_for_pickup')$$,
  'invalid_transition', 'طلب التوصيل لا يصبح "جاهز للاستلام"');
select tests.throws($$select public.cancel_order((select (v->>'order_id')::uuid from tests.ctx where k='o2'), 'العميل غيّر رأيه')$$,
  'requires_admin_approval', 'الإلغاء بعد بدء التجهيز يحتاج موافقة الإدارة');
select public.update_order_address((select (v->>'order_id')::uuid from tests.ctx where k='o2'), 'دير البلح، حي جديد');
select public.cancel_order((select (v->>'order_id')::uuid from tests.ctx where k='o2'), 'موافقة الإدارة', true);
select tests.throws($$select public.cancel_order((select (v->>'order_id')::uuid from tests.ctx where k='o2'), 'مرة ثانية', true)$$,
  'invalid_transition', 'لا يمكن إلغاء الطلب مرتين');

reset role;
select tests.ok((select on_hand = 50 and reserved = 1 from public.inventory
  where variant_id = 'b0000000-0000-0000-0000-000000000002'), 'الإلغاء بعد التأكيد أعاد الكمية مرة واحدة');

-- ============ 7) انتهاء الحجز ============
update public.orders set reservation_expires_at = now() - interval '1 minute'
 where id = (select (v->>'order_id')::uuid from tests.ctx where k='o3');

set role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', false);
select tests.throws($$select public.confirm_order((select (v->>'order_id')::uuid from tests.ctx where k='o3'))$$,
  'reservation_expired', 'لا يمكن تأكيد طلب منتهي الحجز');

set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select tests.throws('select public.release_expired_reservations()', 'permission denied', 'الزائر لا يستدعي تحرير الحجوزات');
select tests.throws('select public.claim_outbox_events()', 'permission denied', 'الزائر لا يقرأ صندوق الأحداث');

set role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
select tests.ok(public.release_expired_reservations() = 1, 'تحرير الحجز المنتهي');
select tests.ok(public.release_expired_reservations() = 0, 'إعادة التشغيل لا تحرر شيئاً مرة ثانية');

reset role;
select tests.ok((select reserved = 0 and on_hand = 50 from public.inventory
  where variant_id = 'b0000000-0000-0000-0000-000000000002'), 'الكمية المحجوزة عادت إلى المتاح');
select tests.ok((select count(*) = 1 from public.inventory_movements
  where kind = 'release' and order_id = (select (v->>'order_id')::uuid from tests.ctx where k='o3')),
  'حركة تحرير واحدة فقط');
select tests.ok((select status = 'cancelled' and cancel_reason = 'reservation_expired' from public.orders
  where id = (select (v->>'order_id')::uuid from tests.ctx where k='o3')), 'الطلب المنتهي أصبح ملغى');

-- ============ 8) المخزون الإداري ============
set role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', false);
reset role;
insert into tests.ctx select 'o4', public.place_order('{"customer_name":"خالد","phone":"0599000005","fulfillment":"pickup",
  "payment_method":"cash_in_store","terms_accepted":true,
  "items":[{"variant_id":"b0000000-0000-0000-0000-000000000002","quantity":45}]}');
set role authenticated;
select tests.throws($$select public.record_in_store_sale('b0000000-0000-0000-0000-000000000002', 6, 'بيع في المحل')$$,
  'insufficient_stock', 'البيع في المحل لا يأخذ من الكمية المحجوزة');
select public.record_in_store_sale('b0000000-0000-0000-0000-000000000002', 5, 'بيع في المحل');
select tests.throws($$select public.adjust_inventory('b0000000-0000-0000-0000-000000000002', 10, 'جرد')$$,
  'below reserved', 'لا يمكن تعديل الكمية تحت المحجوز');
select public.adjust_inventory('b0000000-0000-0000-0000-000000000002', 60, 'جرد فعلي', 'stocktake');
select public.cancel_order((select (v->>'order_id')::uuid from tests.ctx where k='o4'), 'اختبار');
reset role;
select tests.ok((select on_hand = 60 and reserved = 0 from public.inventory
  where variant_id = 'b0000000-0000-0000-0000-000000000002'), 'الجرد والإلغاء قبل التأكيد صحيحان');
select tests.throws($$update public.inventory set reserved = on_hand + 1$$, 'inventory_reserved_le_on_hand',
  'قيد قاعدة البيانات يمنع حجزاً أكبر من الكمية');
select tests.throws($$update public.inventory set on_hand = -1, reserved = 0$$, 'inventory_non_negative',
  'قيد قاعدة البيانات يمنع المخزون السالب');

-- ============ 9) سجل النشاط append-only ============
select tests.ok((select count(*) > 0 from public.activity_logs where action = 'order.confirm'), 'تأكيد الطلب مسجل');
select tests.ok((select count(*) > 0 from public.activity_logs where entity = 'variant_costs' and action = 'update'
  and old_values->>'unit_cost' = '60.00' and new_values->>'unit_cost' = '75.00'), 'تغيير التكلفة مسجل بالقيمتين');
select tests.throws('update public.activity_logs set note = $x$x$x$', 'append-only', 'حتى مالك القاعدة لا يعدل السجل');
select tests.throws('delete from public.activity_logs', 'append-only', 'حتى مالك القاعدة لا يحذف السجل');
select tests.throws('update public.order_status_history set note = $x$x$x$', 'append-only', 'سجل الحالات غير قابل للتعديل');
set role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', false);
select tests.throws('delete from public.activity_logs', 'permission denied', 'المدير لا يحذف السجل عبر API');
select tests.throws($$insert into public.activity_logs (action, entity) values ('fake','x')$$, 'permission denied',
  'لا يمكن تزوير سجل النشاط عبر API');

-- ============ 10) صندوق الأحداث لـ n8n ============
set role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
insert into tests.ctx select 'ev', to_jsonb(e) from public.claim_outbox_events(1) e;
select tests.ok((select count(*) = 0 from public.claim_outbox_events(100) e
  where e.event_id = (select (v->>'event_id')::uuid from tests.ctx where k='ev')), 'الحدث المحجوز لا يُسلَّم مرتين');
select public.complete_outbox_event((select (v->>'event_id')::uuid from tests.ctx where k='ev'), true);
select tests.ok(public.complete_outbox_event((select (v->>'event_id')::uuid from tests.ctx where k='ev'), false, 'x') is null,
  'لا يمكن تغيير نتيجة حدث مكتمل');

reset role;
select 'ALL CORE TESTS PASSED' as result;
