-- اختبارات الإرسال المباشر لـ Telegram من خادم الموقع (0027). تُشغَّل بعد 26
\set ON_ERROR_STOP 1
reset role;
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select tests.throws($$select public.notifications_claim_service()$$, 'permission denied', 'الزائر لا يحجز الإشعارات');
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', false);
select tests.throws($$select public.notifications_claim_service()$$, 'permission denied', 'حتى المدير لا يحجز الإشعارات مباشرة');
reset role;
-- حدث قديم (أكثر من يوم) لا يُرسل
update public.notification_deliveries set created_at = now() - interval '2 days'
 where event_id in (select event_id from public.notification_outbox where event_type <> 'custom_order.created');
set role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
insert into tests.ctx select 'tg27', public.notifications_claim_service('telegram', 50);
select tests.ok((select jsonb_array_length(v) >= 1 and not exists (select 1 from jsonb_array_elements(v) x where x->>'event_type' <> 'custom_order.created')
  from tests.ctx where k = 'tg27'), 'يحجز أحداث آخر يوم فقط (طلبات التفصيل الجديدة)');
select tests.ok((select bool_and(x->>'text' like '%طلب تفصيل جديد%') from tests.ctx, jsonb_array_elements(v) x where k = 'tg27'), 'النص الجاهز للإرسال');
insert into tests.ctx select 'tg27b', public.notifications_claim_service('telegram', 50);
select tests.ok((select jsonb_array_length(v) = 0 from tests.ctx where k = 'tg27b'), 'المحجوز لا يُحجز مرة ثانية (لا تكرار مع n8n)');
select tests.ok(public.notifications_complete_service(((select v from tests.ctx where k = 'tg27')->0->>'event_id')::uuid, true) = 'sent', 'تسجيل الإرسال الناجح');
select tests.ok(public.notifications_complete_service(((select v from tests.ctx where k = 'tg27')->0->>'event_id')::uuid, true) = 'ignored', 'لا يُعاد تسجيل حدث أُرسل');
reset role;
