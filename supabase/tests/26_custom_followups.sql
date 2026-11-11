-- اختبارات متابعات استوديو التفصيل (0026): إشعار Telegram + خيارات الأقمشة والألوان. تُشغَّل بعد 25_custom_orders.sql
\set ON_ERROR_STOP 1
reset role;

-- ============ 1) طلب تفصيل جديد ⇒ حدث وتسليم Telegram ونص بلا بيانات شخصية ============
set role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
select public.submit_custom_order(jsonb_build_object('request_id', '33333333-3333-3333-3333-333333333333', 'product_type', 'mattress',
  'specs', '{"width":90,"length":190,"height":20,"unit":"cm","quantity":1,"fabric":"قطن","color":"عاجي","cover":"fitted","notes":""}'::jsonb,
  'customer_name', 'زبون الإشعار', 'phone', '0597111222', 'area', 'النصيرات'));
reset role;
create temp table ev26 as select e.* from public.notification_outbox e where e.event_type = 'custom_order.created'
  and e.payload->>'number' = (select number from public.custom_orders where request_id = '33333333-3333-3333-3333-333333333333');
select tests.ok((select count(*) = 1 from ev26), 'طلب التفصيل يضيف حدثاً في صندوق الأحداث');
select tests.ok(exists (select 1 from public.notification_deliveries d join ev26 using (event_id) where d.channel = 'telegram' and d.status = 'pending'),
  'الحدث يُوجَّه لقناة Telegram');
select tests.ok((select t like '%طلب تفصيل جديد SO-%' and t like '%90 × 190 × 20 سم%' and t like '%/admin/custom-orders/%' and t like '%النصيرات%'
    and t not like '%0597111222%' and t not like '%زبون الإشعار%' from (select private.telegram_text(e) t from public.notification_outbox e where e.event_id = (select event_id from ev26)) x),
  'نص الإشعار: الرقم والنوع والمقاسات والمنطقة والرابط، بلا اسم أو جوال العميل');
select tests.ok((select count(*) from public.custom_orders where request_id = '33333333-3333-3333-3333-333333333333') = 1, 'طلب واحد');
set role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
select public.submit_custom_order(jsonb_build_object('request_id', '33333333-3333-3333-3333-333333333333', 'product_type', 'mattress',
  'specs', '{"width":90,"length":190,"height":20,"unit":"cm","quantity":1,"cover":"fitted"}'::jsonb, 'customer_name', 'زبون الإشعار', 'phone', '0597111222', 'area', 'النصيرات'));
reset role;
select tests.ok((select count(*) from public.notification_outbox where event_type = 'custom_order.created' and payload->>'number' = (select number from public.custom_orders where request_id = '33333333-3333-3333-3333-333333333333')) = 1, 'إعادة الإرسال بنفس المعرّف لا تكرر الإشعار');
select tests.ok(private.telegram_text((select e from public.notification_outbox e where event_type = 'order.created' limit 1)) like '%طلب جديد%'
  or not exists (select 1 from public.notification_outbox where event_type = 'order.created'), 'رسائل الطلبات العادية كما هي');

-- ============ 2) الأقمشة والألوان ============
select tests.ok((select count(*) = 5 from public.custom_fabrics where product_type = 'curtains') and (select count(*) = 10 from public.custom_colors),
  'القيم الأولية = الخيارات الحالية');
update public.custom_fabrics set is_active = false where product_type = 'curtains' and name = 'جاكار';
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select tests.ok((select count(*) = 4 from public.custom_fabrics where product_type = 'curtains'), 'الزائر يرى الأقمشة المفعّلة فقط');
select tests.throws($$insert into public.custom_fabrics (product_type, name) values ('curtains', 'تجربة')$$, 'permission denied', 'الزائر لا يضيف أقمشة');
select tests.throws($$update public.custom_colors set hex = '#000000'$$, 'permission denied', 'الزائر لا يعدّل الألوان');
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000d1","aal":"aal2"}', false);
select tests.throws($$insert into public.custom_fabrics (product_type, name) values ('curtains', 'تجربة')$$, 'row-level security', 'المشاهد لا يضيف أقمشة');
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', false);
insert into public.custom_fabrics (product_type, name, texture_url, sort_order) values ('curtains', 'مخمل المحل', 'https://example.supabase.co/storage/v1/object/public/product-media/fabrics/x.jpg', 9);
select tests.ok((select count(*) = 6 from public.custom_fabrics where product_type = 'curtains'), 'المدير يرى كل الأقمشة (والمعطّل) ويضيف قماشاً بصورة');
select tests.throws($$insert into public.custom_fabrics (product_type, name, texture_url) values ('curtains', 'سيء', 'javascript:alert(1)')$$, 'custom_fabrics_texture_url_check', 'رابط صورة غير آمن مرفوض');
select tests.throws($$insert into public.custom_colors (name, hex) values ('خطأ', 'red')$$, 'custom_colors_hex_check', 'لون بصيغة غير HEX مرفوض');
insert into public.custom_colors (name, hex, sort_order) values ('ذهبي', '#b49a68', 11);
reset role;
select tests.ok(exists (select 1 from public.activity_logs where entity = 'custom_fabrics' and action = 'insert')
  and exists (select 1 from public.activity_logs where entity = 'custom_colors' and action = 'insert'), 'تعديلات الخيارات مسجلة في سجل النشاط');
