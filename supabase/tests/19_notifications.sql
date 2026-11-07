-- اختبارات إشعارات Telegram ومفتاح التكامل والتقرير اليومي
\set ON_ERROR_STOP 1
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select tests.throws($$select public.notifications_claim()$$, 'invalid integration key', 'بلا مفتاح: مرفوض');
select set_config('request.headers', '{"x-alassar-key":"ak_guess"}', false);
select tests.throws($$select public.notifications_claim()$$, 'invalid integration key', 'مفتاح مخمَّن: مرفوض');
select tests.throws($$select public.generate_integration_key('n8n')$$, 'permission denied', 'الزائر لا ينشئ مفاتيح');

set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000c","aal":"aal2"}', false);
select tests.throws($$select public.generate_integration_key('n8n')$$, 'forbidden', 'عميل مسجل لا ينشئ مفاتيح');
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', false);
insert into tests.ctx select 'k1', to_jsonb(public.generate_integration_key('n8n'));
select tests.ok((select v #>> '{}' ~ '^ak_[0-9a-f]{64}$' from tests.ctx where k = 'k1'), 'المدير ينشئ مفتاحاً');
select tests.ok((public.integration_key_status('n8n')->>'exists')::boolean, 'حالة المفتاح تظهر للمدير');
reset role;
select tests.ok((select key_hash <> (select v #>> '{}' from tests.ctx where k = 'k1') from private.integration_keys), 'المفتاح مخزن مجزأً فقط');
select tests.ok(not exists (select 1 from public.activity_logs where new_values::text like '%ak_%' or note like '%ak_%'), 'المفتاح لا يُسجَّل في سجل النشاط');

-- اسم منتج فيه وسوم HTML يجب أن يُهرَّب
update public.order_items set product_name_snapshot = 'مخدة <b>ب</b> & co'
 where order_id = (select (v->>'order_id')::uuid from tests.ctx where k = 'p1');

set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select set_config('request.headers', json_build_object('x-alassar-key', (select v #>> '{}' from tests.ctx where k = 'k1'))::text, false);
insert into tests.ctx select 'c1', public.notifications_claim('telegram', 50);
select tests.ok((select jsonb_array_length(v) > 0 from tests.ctx where k = 'c1'), 'n8n يسحب الإشعارات بالمفتاح الصحيح');
select tests.ok((select bool_and(x->>'event_type' in ('order.created','payment.bank_transfer_selected','reservation.expired','auth.staff_login'))
  from tests.ctx, jsonb_array_elements(v) x where k = 'c1'), 'Telegram يستلم أحداث المدير فقط (لا تغييرات الحالة للزبون)');
select tests.ok((select bool_and(x->>'text' !~ '(0599|ريم|سامي|منى|أحمد|خالد|سارة|النصيرات، المخيم)')
  from tests.ctx, jsonb_array_elements(v) x where k = 'c1'), 'الرسائل بلا اسم الزبون أو هاتفه أو عنوانه');
select tests.ok((select bool_or(x->>'text' like '%/admin/orders/%') from tests.ctx, jsonb_array_elements(v) x where k = 'c1'),
  'الرسالة تحتوي رابط الطلب في لوحة التحكم');
select tests.ok((select bool_or(x->>'text' like '%مخدة &lt;b&gt;ب&lt;/b&gt; &amp; co%') from tests.ctx, jsonb_array_elements(v) x where k = 'c1'),
  'أسماء المنتجات تُهرَّب (لا حقن HTML)');
select tests.ok(public.notifications_claim('telegram', 50) = '[]'::jsonb, 'الحدث المسحوب لا يُسلَّم مرة ثانية');

select tests.ok(public.notifications_complete((select (v->0->>'event_id')::uuid from tests.ctx where k = 'c1'), true) = 'sent', 'تأكيد الإرسال');
select tests.ok(public.notifications_complete((select (v->0->>'event_id')::uuid from tests.ctx where k = 'c1'), false, 'x') = 'ignored',
  'لا يمكن تغيير نتيجة إشعار مُرسَل');
select tests.ok(public.notifications_complete((select (v->1->>'event_id')::uuid from tests.ctx where k = 'c1'), false, 'telegram 502') = 'failed',
  'فشل مؤقت ← إعادة محاولة لاحقاً');
reset role;
select tests.ok((select next_attempt_at > now() and last_error = 'telegram 502' from public.notification_deliveries
  where event_id = (select (v->1->>'event_id')::uuid from tests.ctx where k = 'c1')), 'إعادة المحاولة مؤجلة (تأخير متصاعد)');
update public.notification_deliveries set next_attempt_at = now() - interval '1 second'
 where event_id = (select (v->1->>'event_id')::uuid from tests.ctx where k = 'c1');
set role anon;
select tests.ok(jsonb_array_length(public.notifications_claim('telegram', 50)) = 1, 'الإشعار الفاشل يُعاد سحبه بعد التأخير');

-- دخول المدير يولّد تنبيهاً
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', false);
select public.record_staff_login('Mozilla/5.0 <script>');
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
insert into tests.ctx select 'c2', public.notifications_claim('telegram', 50);
select tests.ok((select x->>'event_type' = 'auth.staff_login' and x->>'text' like '%&lt;script&gt;%'
  from tests.ctx, jsonb_array_elements(v) x where k = 'c2'), 'دخول المدير ← تنبيه Telegram (مع تهريب نص الجهاز)');

-- التقرير اليومي
insert into tests.ctx select 'r1', public.notifications_daily_report();
select tests.ok((select v->>'text' like '%تقرير يوم%' and v->>'text' like '%مستحقات المحل%' from tests.ctx where k = 'r1'), 'التقرير اليومي يُبنى');
select tests.ok((select v->>'text' !~ '(0599|ريم|سامي)' from tests.ctx where k = 'r1'), 'التقرير بلا بيانات شخصية');

-- إعادة إنشاء المفتاح تبطل القديم
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', false);
select public.generate_integration_key('n8n');
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select tests.throws($$select public.notifications_claim()$$, 'invalid integration key', 'المفتاح القديم يتوقف بعد إنشاء جديد');
reset role;
select 'ALL NOTIFICATION TESTS PASSED' as result;
