-- اختبارات طلبات التفصيل حسب المقاس (0025). تُشغَّل بعد 24_admin_console.sql (تستخدم المشاهد d1 ومدير الطلبات d2).
\set ON_ERROR_STOP 1
reset role;

-- ============ 1) لا وصول مباشر للجداول ============
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select tests.throws($$select * from public.custom_orders$$, 'permission denied', 'الزائر لا يقرأ طلبات التفصيل');
select tests.throws($$select public.submit_custom_order('{}')$$, 'permission denied', 'الزائر لا يستدعي دالة الحفظ مباشرة');
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000d1","aal":"aal2"}', false);
select tests.throws($$select * from public.custom_orders$$, 'permission denied', 'الموظف لا يقرأ الجدول مباشرة (عبر الدوال فقط)');
select tests.throws($$select public.submit_custom_order('{}')$$, 'permission denied', 'الموظف لا يستدعي دالة الحفظ');

-- ============ 2) الحفظ من الخادم (مفتاح الخدمة) ============
set role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
insert into tests.ctx select 'co25_first', public.submit_custom_order(jsonb_build_object(
  'request_id', '11111111-1111-1111-1111-111111111111', 'product_type', 'curtains',
  'specs', '{"windows":[{"width":2.5,"height":2.8,"count":1,"panels":2,"unit":"m"},{"width":3,"height":2.7,"count":2,"panels":2,"unit":"m"}],"fabric":"كتان","color":"بيج","blackout":"partial","style":"كسرات عادية","notes":""}'::jsonb,
  'customer_name', 'سامي', 'phone', '+970 599 123 456', 'area', 'دير البلح'));
select tests.ok((select v->>'number' like 'SO-%' and (v->>'duplicate')::boolean = false from tests.ctx where k = 'co25_first'), 'ستائر بشباكين بمقاسين مختلفين تُحفظ برقم طلب');
select tests.ok((select phone = '0599123456' and status = 'new' and final_price is null from public.custom_orders where request_id = '11111111-1111-1111-1111-111111111111'),
  'الجوال يُحفظ بالصيغة الموحدة، والحالة «جديد» بلا سعر تلقائي');
select tests.ok((select (specs->'windows'->1->>'width')::numeric = 3 and specs->'windows'->0->>'unit' = 'm'
  from public.custom_orders where request_id = '11111111-1111-1111-1111-111111111111'), 'المقاس والوحدة يُخزنان منفصلين وبالدقة نفسها');
insert into tests.ctx select 'co25_dup', public.submit_custom_order(jsonb_build_object(
  'request_id', '11111111-1111-1111-1111-111111111111', 'product_type', 'curtains',
  'specs', '{"windows":[{"width":2.5,"height":2.8,"count":1,"panels":2,"unit":"m"}],"blackout":"none"}'::jsonb,
  'customer_name', 'سامي', 'phone', '0599123456', 'area', 'دير البلح'));
select tests.ok((select (v->>'duplicate')::boolean and v->>'number' = (select v2->>'number' from tests.ctx x, lateral (select x.v as v2) y where x.k = 'co25_first') from tests.ctx where k = 'co25_dup'),
  'النقر المتكرر بنفس المعرّف لا يكرر الطلب');
select tests.ok((select count(*) = 1 from public.custom_orders where request_id = '11111111-1111-1111-1111-111111111111'), 'طلب واحد فقط محفوظ');

select public.submit_custom_order(jsonb_build_object('request_id', gen_random_uuid(), 'product_type', 'ceiling',
  'specs', '{"width":4,"length":5.25,"unit":"m","quantity":1,"fabric":"","color":"عاجي","design":"pleated","notes":""}'::jsonb,
  'customer_name', 'منى', 'phone', '0598765432', 'area', 'النصيرات'));
select public.submit_custom_order(jsonb_build_object('request_id', '22222222-2222-2222-2222-222222222222', 'product_type', 'mattress',
  'specs', '{"width":160,"length":200,"height":25,"unit":"cm","quantity":2,"fabric":"قطن","color":"عاجي","cover":"zipper","notes":""}'::jsonb,
  'customer_name', 'خالد', 'phone', '0597000001', 'area', 'دير البلح'));
select tests.ok(exists (select 1 from public.custom_orders where product_type = 'ceiling' and (specs->>'length')::numeric = 5.25), 'بطانة سقف بالمتر (5.25) تُحفظ');
select tests.ok(exists (select 1 from public.custom_orders where product_type = 'mattress' and specs->>'unit' = 'cm' and (specs->>'height')::numeric = 25), 'وجه فرشة بالسنتيمتر بأبعاده الثلاثة');

-- رفض القيم غير الصحيحة
select tests.throws($$select public.submit_custom_order(jsonb_build_object('request_id', gen_random_uuid(), 'product_type', 'curtains',
  'specs', '{"windows":[{"width":0,"height":2.8,"count":1,"panels":2,"unit":"m"}],"blackout":"none"}'::jsonb, 'customer_name', 'أ ب', 'phone', '0599123456', 'area', 'غزة'))$$,
  'invalid_specs', 'عرض صفري مرفوض');
select tests.throws($$select public.submit_custom_order(jsonb_build_object('request_id', gen_random_uuid(), 'product_type', 'curtains',
  'specs', '{"windows":[{"width":-2,"height":2.8,"count":1,"panels":2,"unit":"m"}],"blackout":"none"}'::jsonb, 'customer_name', 'أ ب', 'phone', '0599123456', 'area', 'غزة'))$$,
  'invalid_specs', 'قيمة سالبة مرفوضة');
select tests.throws($$select public.submit_custom_order(jsonb_build_object('request_id', gen_random_uuid(), 'product_type', 'curtains',
  'specs', '{"windows":[{"width":250,"height":280,"count":1,"panels":2,"unit":"m"}],"blackout":"none"}'::jsonb, 'customer_name', 'أ ب', 'phone', '0599123456', 'area', 'غزة'))$$,
  'invalid_specs', 'خلط الوحدات (سنتيمتر في حقل متر) مرفوض بالحدود');
select tests.throws($$select public.submit_custom_order(jsonb_build_object('request_id', gen_random_uuid(), 'product_type', 'mattress',
  'specs', '{"width":1.6,"length":2,"height":0.25,"unit":"m","quantity":1,"cover":"zipper"}'::jsonb, 'customer_name', 'أ ب', 'phone', '0599123456', 'area', 'غزة'))$$,
  'invalid_specs', 'وجه الفرشة يقبل السنتيمتر فقط');
select tests.throws($$select public.submit_custom_order(jsonb_build_object('request_id', gen_random_uuid(), 'product_type', 'ceiling',
  'specs', '{"width":4.123,"length":5,"unit":"m","quantity":1,"design":"plain"}'::jsonb, 'customer_name', 'أ ب', 'phone', '0599123456', 'area', 'غزة'))$$,
  'invalid_specs', 'أكثر من منزلتين عشريتين مرفوض');
select tests.throws($$select public.submit_custom_order(jsonb_build_object('request_id', gen_random_uuid(), 'product_type', 'sofa',
  'specs', '{}'::jsonb, 'customer_name', 'أ ب', 'phone', '0599123456', 'area', 'غزة'))$$, 'invalid_specs', 'نوع غير معروف مرفوض');
select tests.throws($$select public.submit_custom_order(jsonb_build_object('request_id', gen_random_uuid(), 'product_type', 'ceiling',
  'specs', '{"width":4,"length":5,"unit":"m","quantity":1,"design":"plain"}'::jsonb, 'customer_name', 'أ ب', 'phone', '12345', 'area', 'غزة'))$$,
  'invalid_phone', 'رقم جوال غير صالح مرفوض');
select tests.throws($$select public.submit_custom_order(jsonb_build_object('request_id', gen_random_uuid(), 'product_type', 'ceiling',
  'specs', '{"width":4,"length":5,"unit":"m","quantity":1,"design":"plain"}'::jsonb, 'customer_name', 'أ ب', 'phone', '0599123456', 'area', 'غزة',
  'preview_image', '<svg onload=alert(1)>'))$$, 'custom_orders_preview_image_check', 'صورة المعاينة تُقبل JPEG فقط');

-- ============ 3) الإدارة: المشاهد يقرأ فقط ============
reset role;
create temp table co as select id, number from public.custom_orders where request_id = '22222222-2222-2222-2222-222222222222';
grant select on co to authenticated;
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000d1","aal":"aal2"}', false);
select tests.ok((select (public.admin_custom_orders('{}')->>'total')::int = 3), 'المشاهد يرى قائمة طلبات التفصيل');
select tests.ok((select (public.admin_custom_orders('{"type":"mattress"}')->>'total')::int = 1), 'التصفية حسب نوع المنتج');
select tests.ok((select (public.admin_custom_orders('{"q":"سامي"}')->>'total')::int = 1), 'البحث باسم العميل');
select tests.ok((select (public.admin_custom_orders(jsonb_build_object('q', (select number from co)))->>'total')::int = 1), 'البحث برقم الطلب');
select tests.ok((select (public.admin_custom_orders('{"status":"new"}')->>'total')::int = 3 and (public.admin_custom_orders('{"status":"ready"}')->>'total')::int = 0), 'التصفية حسب الحالة');
select tests.ok((select (public.admin_custom_orders(jsonb_build_object('from', current_date - 1, 'to', current_date + 1))->>'total')::int = 3
  and (public.admin_custom_orders(jsonb_build_object('from', current_date - 30, 'to', current_date - 10))->>'total')::int = 0), 'التصفية حسب التاريخ');
select tests.throws($$select public.update_custom_order((select id from co), 'reviewing')$$,
  'forbidden', 'المشاهد لا يغيّر الحالة');

-- الحساب الموقوف/بلا صلاحية
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000d3","aal":"aal2"}', false);
select tests.throws($$select public.admin_custom_orders('{}')$$, 'forbidden', 'موظف الاستقبال لا يرى طلبات التفصيل');

-- ============ 4) مدير الطلبات: الحالة والسعر والملاحظات والسجل ============
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000d2","aal":"aal2"}', false);
select public.update_custom_order((select id from co), 'reviewing', null, 'راجعنا المقاسات');
select public.update_custom_order((select id from co), 'awaiting_customer', 340.50);
select tests.ok((select v->>'status' = 'awaiting_customer' and (v->>'final_price')::numeric = 340.50
  from (select public.admin_custom_order((select id from co)) v) x), 'تحديد الحالة والسعر النهائي');
select tests.ok((select jsonb_array_length(v->'events') = 5
    and v->'events'->0->>'kind' = 'created' and v->'events'->1->>'status' = 'reviewing' and v->'events'->2->>'note' = 'راجعنا المقاسات'
    and v->'events'->3->>'status' = 'awaiting_customer' and (v->'events'->4->>'price')::numeric = 340.50 and v->'events'->1->>'actor' = 'مدير طلبات'
  from (select public.admin_custom_order((select id from co)) v) x), 'سجل التحديثات: الإنشاء + الحالة + الملاحظة + السعر مع اسم الموظف');
select tests.throws($$select public.update_custom_order((select id from co), 'shipped')$$, 'invalid_status', 'حالة غير معروفة مرفوضة');
select tests.throws($$select public.update_custom_order((select id from co), null, -5)$$, 'invalid_price', 'سعر سالب مرفوض');
reset role;
select tests.ok(exists (select 1 from public.activity_logs where action = 'custom_order.updated' and entity_id = (select number from co)),
  'التحديث مسجل في سجل النشاط');
