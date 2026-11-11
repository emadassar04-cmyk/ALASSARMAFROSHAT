-- طرق الدفع بعد 0028/0029: الأسماء والأوصاف الجديدة، والمحفظة الإلكترونية بمسار المراجعة اليدوية مثل التحويل البنكي
\set ON_ERROR_STOP 1
reset role;
select tests.ok((select string_agg(name_ar, '|' order by sort_order) from public.payment_methods)
  = 'الدفع عند الاستلام|تحويل بنكي|الدفع عبر المحفظة الإلكترونية|الدفع نقداً في المحل',
  'طرق الدفع بالأسماء والترتيب الجديد (مع إبقاء الدفع في المحل للاستلام)');
select tests.ok((select instructions like 'الدفع عند وصول الطلب واستلامه%' from public.payment_methods where code = 'cash_on_delivery')
  and (select instructions like 'التحويل مباشرة إلى الحساب البنكي%WhatsApp%' from public.payment_methods where code = 'bank_transfer')
  and (select instructions like 'الدفع باستخدام محفظة إلكترونية%WhatsApp%' and is_enabled from public.payment_methods where code = 'e_wallet'),
  'أوصاف طرق الدفع الجديدة، والمحفظة مفعّلة');

-- طلب بالمحفظة (توصيل) وآخر (استلام): كلاهما مسموح ويبدأ «بانتظار المراجعة»
set role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
insert into tests.ctx select 'w1', public.place_order('{"customer_name":"هبة","phone":"0599333444","fulfillment":"delivery",
  "delivery_zone_id":"c0000000-0000-0000-0000-000000000002","address":"النصيرات، شارع البحر","payment_method":"e_wallet",
  "terms_accepted":true,"items":[{"variant_id":"b0000000-0000-0000-0000-000000000003","quantity":1}]}');
insert into tests.ctx select 'w2', public.place_order('{"customer_name":"هبة","phone":"0599333444","fulfillment":"pickup",
  "payment_method":"e_wallet","terms_accepted":true,"items":[{"variant_id":"b0000000-0000-0000-0000-000000000003","quantity":1}]}');
reset role;
select tests.ok((select bool_and(o.payment_status = 'awaiting_review' and o.payment_method = 'e_wallet')
  from public.orders o join tests.ctx c on o.id = (c.v->>'order_id')::uuid where c.k in ('w1', 'w2')),
  'المحفظة: الطلب يبدأ بانتظار مراجعة الدفع (توصيل واستلام)');
select tests.ok((select private.telegram_text(e) like '%الدفع: محفظة إلكترونية%' from public.notification_outbox e
  where e.event_type = 'order.created' and e.order_id = (select (v->>'order_id')::uuid from tests.ctx where k = 'w1')),
  'إشعار الطلب الجديد يذكر المحفظة الإلكترونية');
select tests.ok((select payment_status = 'unpaid' from public.orders where payment_method = 'cash_on_delivery' limit 1),
  'طرق الدفع الأخرى لم تتغير حالتها الافتراضية');

-- المراجعة اليدوية: الزائر ممنوع، والمدير يعتمد الدفع
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select tests.throws(format($$select public.review_bank_transfer(%L, true)$$, (select v->>'order_id' from tests.ctx where k = 'w1')),
  'permission denied', 'الزائر لا يستطيع اعتماد دفع المحفظة');
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', false);
select tests.ok((select (public.review_bank_transfer((select (v->>'order_id')::uuid from tests.ctx where k = 'w1'), true, 120, 'WAL-1')).payment_status = 'paid'),
  'المدير يعتمد دفع المحفظة بعد المراجعة');
select tests.throws(format($$select public.review_bank_transfer(%L, true)$$, (select v->>'order_id' from tests.ctx where k = 'w1')),
  'payment_not_reviewable', 'لا اعتماد مرتين لنفس الدفع');
reset role;
