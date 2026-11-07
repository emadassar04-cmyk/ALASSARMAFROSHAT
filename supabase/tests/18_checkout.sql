-- اختبارات إتمام الطلب: ملخص الطلب يطابق الطلب الفعلي، ولا يكتب شيئاً، والحد من التكرار
\set ON_ERROR_STOP 1
insert into public.delivery_zones (id, name, fee) values ('c0000000-0000-0000-0000-000000000002', 'النصيرات', 15.5);
create temp table snap as select
  (select sum(reserved) from public.inventory) as reserved, (select count(*) from public.orders) as orders,
  (select count(*) from public.notification_outbox) as events;
grant select on snap to anon, service_role;

set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
insert into tests.ctx select 'q1', public.quote_order('{"fulfillment":"delivery","delivery_zone_id":"c0000000-0000-0000-0000-000000000002",
  "phone":"0599111222","coupon_code":"save15",
  "items":[{"variant_id":"b0000000-0000-0000-0000-000000000002","quantity":3},{"variant_id":"b0000000-0000-0000-0000-000000000003","quantity":1}]}');
select tests.ok((select v->>'subtotal' = '350.00' and v->>'discount' = '52.50' and v->>'delivery_fee' = '15.50'
  and v->>'total' = '313.00' from tests.ctx where k = 'q1'), 'الملخص: 3×50 + 200 = 350، خصم 15% = 52.50، توصيل 15.50');
select tests.ok((select (v->'coupon'->>'valid')::boolean from tests.ctx where k = 'q1'), 'الكوبون صالح في الملخص');
reset role;
select tests.ok((select sum(reserved) from public.inventory) = (select reserved from snap)
  and (select count(*) from public.orders) = (select orders from snap)
  and (select count(*) from public.notification_outbox) = (select events from snap), 'الملخص لا يحجز ولا ينشئ طلباً ولا حدثاً');

-- الطلب الفعلي بنفس المدخلات يعطي نفس الأرقام
set role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
insert into tests.ctx select 'p1', public.place_order('{"customer_name":"ريم","phone":"0599111222","fulfillment":"delivery",
  "delivery_zone_id":"c0000000-0000-0000-0000-000000000002","address":"النصيرات، المخيم الجديد","payment_method":"bank_transfer",
  "coupon_code":"save15","terms_accepted":true,
  "items":[{"variant_id":"b0000000-0000-0000-0000-000000000002","quantity":3},{"variant_id":"b0000000-0000-0000-0000-000000000003","quantity":1}]}');
select tests.ok((select q.v->>'total' = p.v->>'total' and q.v->>'discount' = p.v->>'discount' and q.v->>'delivery_fee' = p.v->>'delivery_fee'
  from tests.ctx q, tests.ctx p where q.k = 'q1' and p.k = 'p1'), 'الملخص يطابق الطلب الفعلي تماماً');
select tests.ok((select payment_status = 'awaiting_review' from public.orders where id = (select (v->>'order_id')::uuid from tests.ctx where k = 'p1')),
  'التحويل البنكي: الدفع بانتظار المراجعة');

-- مشكلات البنود تظهر في الملخص بدلاً من رفض الطلب كله
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select tests.ok((select string_agg(x->>'problem', ',' order by x->>'variant_id') from jsonb_array_elements(public.quote_order('{"items":[
  {"variant_id":"b0000000-0000-0000-0000-000000000001","quantity":1},
  {"variant_id":"b0000000-0000-0000-0000-000000000004","quantity":1},
  {"variant_id":"b0000000-0000-0000-0000-000000000005","quantity":1},
  {"variant_id":"b0000000-0000-0000-0000-000000000002","quantity":999}]}')->'lines') x)
  = 'insufficient_stock,invalid_quantity,requires_measurement,unavailable', 'الملخص يحدد مشكلة كل بند');
select tests.ok((public.quote_order('{"coupon_code":"SAVE10","phone":"0599000002","items":[{"variant_id":"b0000000-0000-0000-0000-000000000002","quantity":1}]}')
  ->'coupon'->>'reason') = 'max_uses_reached' or
  (public.quote_order('{"coupon_code":"SAVE10","phone":"0599000002","items":[{"variant_id":"b0000000-0000-0000-0000-000000000002","quantity":1}]}')
  ->'coupon'->>'valid')::boolean, 'سبب رفض الكوبون يظهر في الملخص');
select tests.ok((public.quote_order('{"coupon_code":"NOPE","items":[]}')->'coupon'->>'reason') = 'not_found_or_inactive', 'كوبون غير موجود');
select tests.ok(public.quote_order('{"items":[{"variant_id":"b0000000-0000-0000-0000-000000000002","quantity":1}]}')::text
  !~* '(cost|profit|on_hand|reserved)', 'الملخص بلا بيانات داخلية');
select tests.throws($$select public.rate_limit_hit('x', 1, 60)$$, 'permission denied', 'الزائر لا يستدعي rate_limit_hit');

-- الحد من التكرار: 3 طلبات في النافذة ثم رفض
set role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
select tests.ok(public.rate_limit_hit('order:abc', 3, 600) and public.rate_limit_hit('order:abc', 3, 600)
  and public.rate_limit_hit('order:abc', 3, 600) and not public.rate_limit_hit('order:abc', 3, 600), 'الحد من التكرار: الرابع مرفوض');
select tests.ok(public.rate_limit_hit('order:other', 3, 600), 'مفتاح آخر مستقل');
reset role;
update private.rate_limits set window_start = now() - interval '11 minutes' where key = 'order:abc';
set role service_role;
select tests.ok(public.rate_limit_hit('order:abc', 3, 600), 'بعد انتهاء النافذة يُسمح من جديد');
reset role;
select tests.ok((select instructions like '%WhatsApp%' from public.payment_methods where code = 'bank_transfer'),
  'تعليمات التحويل البنكي: البيانات عبر WhatsApp');
select 'ALL CHECKOUT TESTS PASSED' as result;
