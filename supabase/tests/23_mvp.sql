-- اختبارات الـ MVP: هوية العميل الموحدة، مبيعات الفروع، السجل الموحد، الموظفون، حملة السحب، العروض
\set ON_ERROR_STOP 1
delete from tests.ctx where k in ('o1','deir','nus','s1','s2','s3','s4','c1','w','sum');

-- ============ 1) توحيد رقم الجوال ============
select tests.ok(private.canonical_phone('0599123456') = '0599123456', 'جوال محلي 059');
select tests.ok(private.canonical_phone('0561234567') = '0561234567', 'جوال محلي 056');
select tests.ok(private.canonical_phone('+970599123456') = '0599123456', 'صيغة +970');
select tests.ok(private.canonical_phone('00972 59-912-3456') = '0599123456', 'صيغة 00972 مع مسافات وشرطات');
select tests.ok(private.canonical_phone('٠٥٩٩١٢٣٤٥٦') = '0599123456', 'أرقام عربية');
select tests.ok(private.canonical_phone('599123456') = '0599123456', 'دون الصفر الأول');
select tests.ok(private.canonical_phone('12345') is null and private.canonical_phone('0799123456') is null
  and private.canonical_phone('+9725912345678') is null and private.canonical_phone(null) is null, 'صيغ غير مدعومة تُرفض (لا تخمين)');
select tests.throws($$insert into public.customers (phone, name) values ('970599123456', 'x')$$, 'customers_phone_canonical', 'لا يُخزَّن رقم بغير الصيغة القانونية');

-- طلب أونلاين بصيغة دولية لعميل موجود بالصيغة المحلية ← نفس العميل (لا تكرار)
set role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
insert into tests.ctx select 'o1', public.place_order('{"customer_name":"سامر","phone":"+970 599 000 002","fulfillment":"pickup",
  "payment_method":"cash_in_store","terms_accepted":true,"items":[{"variant_id":"b0000000-0000-0000-0000-000000000002","quantity":1}]}');
reset role;
select tests.ok((select count(*) from public.customers where phone = '0599000002') = 1
  and not exists (select 1 from public.customers where phone like '970%' or phone like '972%'), 'الصيغة الدولية تُربط بالعميل الموجود نفسه');
select tests.ok((select customer_phone from public.orders where order_number = (select v->>'order_number' from tests.ctx where k = 'o1')) = '0599000002',
  'رقم الطلب محفوظ بالصيغة القانونية');

-- ============ 2) مبيعات الفروع ============
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b1', 'reception@test.local');
insert into public.profiles (id, full_name, role_id) select '00000000-0000-0000-0000-0000000000b1', 'موظف الاستقبال', id from public.roles where code = 'reception';
insert into tests.ctx select 'deir', to_jsonb(id) from public.branches where is_default;
insert into tests.ctx select 'nus', to_jsonb(id) from public.branches where city = 'النصيرات';

-- الزائر وأي مستخدم دون صلاحية: مرفوض
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select tests.throws($$select public.record_store_purchase('0599777001', 50, (select (v#>>'{}')::uuid from tests.ctx where k='deir'), gen_random_uuid())$$,
  'permission denied', 'الزائر لا يسجل مبيعات');
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000c9","aal":"aal1"}', false);
select tests.throws($$select public.record_store_purchase('0599777001', 50, (select (v#>>'{}')::uuid from tests.ctx where k='deir'), gen_random_uuid())$$,
  'forbidden', 'مستخدم دون صلاحية لا يسجل مبيعات');

-- موظف الاستقبال (بعد الخطوة الثانية)
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000b1","aal":"aal2"}', false);
select tests.throws($$select public.record_store_purchase('0599777001', 50, (select (v#>>'{}')::uuid from tests.ctx where k='deir'), null)$$,
  'missing_request_id', 'معرّف الطلب مطلوب');
select tests.throws($$select public.record_store_purchase('123', 50, (select (v#>>'{}')::uuid from tests.ctx where k='deir'), gen_random_uuid())$$,
  'invalid_phone', 'رقم غير صالح مرفوض');
select tests.throws($$select public.record_store_purchase('', 50, (select (v#>>'{}')::uuid from tests.ctx where k='deir'), gen_random_uuid())$$,
  'invalid_phone', 'رقم فارغ مرفوض');
select tests.throws($$select public.record_store_purchase('0599777001', 0, (select (v#>>'{}')::uuid from tests.ctx where k='deir'), gen_random_uuid())$$,
  'invalid_amount', 'مبلغ صفر مرفوض');
select tests.throws($$select public.record_store_purchase('0599777001', -5, (select (v#>>'{}')::uuid from tests.ctx where k='deir'), gen_random_uuid())$$,
  'invalid_amount', 'مبلغ سالب مرفوض');
select tests.throws($$select public.record_store_purchase('0599777001', 10.555, (select (v#>>'{}')::uuid from tests.ctx where k='deir'), gen_random_uuid())$$,
  'invalid_amount', 'أكثر من منزلتين عشريتين مرفوض');
select tests.throws($$select public.record_store_purchase('0599777001', 50, gen_random_uuid(), gen_random_uuid())$$,
  'invalid_branch', 'فرع غير موجود مرفوض');

-- عميل جديد
insert into tests.ctx select 's1', public.record_store_purchase('+970599777001', 250, (select (v#>>'{}')::uuid from tests.ctx where k='deir'),
  'aaaaaaaa-0000-0000-0000-000000000001');
select tests.ok((select (v->>'new_customer')::boolean and v->>'status' = 'submitted' and (v->>'amount')::numeric = 250 and v->>'phone' = '0599777001'
  from tests.ctx where k = 's1'), 'بيع لعميل جديد: إنشاء عميل وتسجيل العملية بانتظار الاعتماد');
-- نفس الطلب مرة ثانية (ضغطتان / إعادة إرسال) ← لا تكرار
select tests.ok((select (public.record_store_purchase('0599777001', 250, (select (v#>>'{}')::uuid from tests.ctx where k='deir'),
  'aaaaaaaa-0000-0000-0000-000000000001')->>'replayed')::boolean), 'إعادة إرسال الطلب نفسه لا تُنشئ عملية ثانية');
-- عملية مطابقة خلال دقيقتين تحتاج تأكيداً
select tests.throws($$select public.record_store_purchase('0599777001', 250, (select (v#>>'{}')::uuid from tests.ctx where k='deir'), gen_random_uuid())$$,
  'possible_duplicate', 'عملية مطابقة خلال دقيقتين تحتاج تأكيداً');
insert into tests.ctx select 's2', public.record_store_purchase('0599777001', 250, (select (v#>>'{}')::uuid from tests.ctx where k='deir'),
  'aaaaaaaa-0000-0000-0000-000000000002', true);
-- عميل موجود (من طلب أونلاين) في فرع النصيرات
insert into tests.ctx select 's3', public.record_store_purchase('00972599000002', 120.50, (select (v#>>'{}')::uuid from tests.ctx where k='nus'),
  'aaaaaaaa-0000-0000-0000-000000000003');
select tests.ok((select not (v->>'new_customer')::boolean and v->>'branch' = 'فرع النصيرات' from tests.ctx where k = 's3'),
  'بيع لعميل موجود: يُربط بسجله بصيغة رقم مختلفة');
select tests.ok((select count(*) from public.store_purchases) = 3, 'الموظف يرى عملياته فقط (3)');
select tests.throws($$select public.review_store_purchase((select (v->>'id')::uuid from tests.ctx where k='s1'), 'approve')$$,
  'forbidden', 'موظف الاستقبال لا يعتمد المبيعات');
select tests.throws($$select public.admin_purchases('{}')$$, 'forbidden', 'موظف الاستقبال لا يرى السجل الموحد');
select tests.throws($$update public.store_purchases set amount = 1$$, 'permission denied', 'لا تعديل مباشر لعمليات الفرع');
select tests.throws($$delete from public.store_purchases$$, 'permission denied', 'لا حذف لعمليات الفرع');
reset role;
select tests.ok((select created_by = '00000000-0000-0000-0000-0000000000b1' from public.store_purchases where request_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'يُسجَّل الموظف المُدخِل تلقائياً');
select tests.ok((select name from public.customers where phone = '0599777001') = 'عميل من الفرع', 'عميل الفرع الجديد باسم مؤقت');

-- ============ 3) حملة السحب (قبل الاعتماد حتى نختبر إنشاء المشاركات تلقائياً) ============
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', false);
insert into tests.ctx select 'c1', to_jsonb(public.save_campaign(jsonb_build_object(
  'slug', 'shop-and-win-test', 'title', 'تسوّق واربح مع العصار', 'prize', 'طقم شراشف فاخر',
  'terms', 'كل شراء مؤهل خلال فترة الحملة يمنح مشاركة واحدة في السحب.',
  'start_at', now() - interval '1 day', 'end_at', now() + interval '1 day', 'min_amount', '100')));
select tests.ok((select v->>'status' = 'draft' from tests.ctx where k = 'c1'), 'الحملة تبدأ مسودة');
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select tests.ok(public.catalog_campaign()->'current' = 'null'::jsonb, 'المسودة لا تظهر للزوار');
select tests.throws($$select public.save_campaign('{}')$$, 'permission denied', 'الزائر لا يدير الحملات');
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', false);
select public.set_campaign_status((select (v->>'id')::uuid from tests.ctx where k = 'c1'), 'published');

-- الاعتماد ينشئ مشاركة (مرة واحدة)، والرفض لا ينشئ
select public.review_store_purchase((select (v->>'id')::uuid from tests.ctx where k='s1'), 'approve');
select tests.throws($$select public.review_store_purchase((select (v->>'id')::uuid from tests.ctx where k='s1'), 'approve')$$,
  'invalid_transition', 'لا اعتماد مرتين');
select tests.throws($$select public.review_store_purchase((select (v->>'id')::uuid from tests.ctx where k='s2'), 'reject')$$,
  'reason_required', 'الرفض يحتاج سبباً');
select public.review_store_purchase((select (v->>'id')::uuid from tests.ctx where k='s2'), 'reject', 'أُدخلت مرتين بالخطأ');
select public.correct_store_purchase((select (v->>'id')::uuid from tests.ctx where k='s3'), 130, (select (v#>>'{}')::uuid from tests.ctx where k='nus'), 'المبلغ الصحيح 130');
select tests.ok(public.approve_store_purchases(array[(select (v->>'id')::uuid from tests.ctx where k='s3')]) = 1, 'اعتماد جماعي');
reset role;
select tests.ok((select count(*) from public.campaign_entries where store_purchase_id is not null and voided_at is null) = 2,
  'المعتمد فقط يدخل السحب (المرفوض لا)');
select tests.ok(exists (select 1 from public.activity_logs where entity = 'store_purchases' and action = 'update'), 'المراجعة مسجلة في سجل النشاط');
select tests.ok(exists (select 1 from public.activity_logs where action = 'store_purchase.corrected'), 'التصحيح مسجل بالسبب');

-- طلب أونلاين: مؤهل عند التسليم فقط، والإلغاء بعده يبطل المشاركة
update public.orders set subtotal = 150 + discount_total - delivery_fee, total = 150 where order_number = (select v->>'order_number' from tests.ctx where k = 'o1');
select tests.ok(not exists (select 1 from public.campaign_entries where order_id is not null), 'طلب لم يُسلَّم لا يدخل السحب');
update public.orders set status = 'delivered' where order_number = (select v->>'order_number' from tests.ctx where k = 'o1');
update public.orders set status = 'delivered' where order_number = (select v->>'order_number' from tests.ctx where k = 'o1');
select tests.ok((select count(*) from public.campaign_entries where order_id is not null) = 1, 'الطلب المُسلَّم يدخل السحب مرة واحدة');
update public.orders set status = 'cancelled' where order_number = (select v->>'order_number' from tests.ctx where k = 'o1');
select tests.ok((select voided_at is not null from public.campaign_entries where order_id is not null), 'إلغاء الطلب يبطل مشاركته');

-- الحد الأدنى للمبلغ
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000b1","aal":"aal2"}', false);
insert into tests.ctx select 's4', public.record_store_purchase('0599777009', 40, (select (v#>>'{}')::uuid from tests.ctx where k='deir'), gen_random_uuid());
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', false);
select public.review_store_purchase((select (v->>'id')::uuid from tests.ctx where k='s4'), 'approve');
reset role;
select tests.ok(not exists (select 1 from public.campaign_entries e join public.store_purchases s on s.id = e.store_purchase_id where s.amount < 100),
  'شراء أقل من الحد الأدنى لا يدخل السحب');

-- إلغاء بيع معتمد يبطل مشاركته
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', false);
select public.review_store_purchase((select (v->>'id')::uuid from tests.ctx where k='s3'), 'void', 'استرجاع البضاعة');
reset role;
select tests.ok((select voided_at is not null from public.campaign_entries where store_purchase_id = (select (v->>'id')::uuid from tests.ctx where k='s3')),
  'إلغاء البيع المعتمد يبطل مشاركته');

-- الواجهة العامة: عدد المشاركات الفعلي فقط
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select tests.ok((public.catalog_campaign()->'current'->>'entries')::int = 1, 'العدد العام = المشاركات السارية فقط');
select tests.throws($$select count(*) from public.campaign_entries$$, 'permission denied', 'الزائر لا يرى المشاركات');
select tests.ok(public.catalog_campaign()::text !~ '0599777001', 'لا أرقام جوال في الواجهة العامة');

-- السحب: ممنوع قبل الانتهاء، ثم مرة واحدة
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', false);
select tests.throws($$select public.draw_campaign_winner((select (v->>'id')::uuid from tests.ctx where k='c1'))$$,
  'campaign_not_ended', 'لا سحب قبل انتهاء الحملة');
reset role;
update public.campaigns set end_at = now() - interval '1 second' where slug = 'shop-and-win-test';
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', false);
insert into tests.ctx select 'w', public.draw_campaign_winner((select (v->>'id')::uuid from tests.ctx where k='c1'));
select tests.ok((select v->>'winner' = '059****001' and (v->>'entries')::int = 1 from tests.ctx where k = 'w'), 'السحب بين المشاركات السارية، والرقم مخفي جزئياً');
select tests.throws($$select public.draw_campaign_winner((select (v->>'id')::uuid from tests.ctx where k='c1'))$$,
  'not_drawable', 'لا سحب مرتين');
select tests.throws($$select public.save_campaign(jsonb_build_object('id', (select v->>'id' from tests.ctx where k='c1'), 'slug','x-x-x','title','تعديل','prize','x','terms','شروط معدلة بعد السحب لا يجب قبولها','start_at', now(), 'end_at', now() + interval '1 day'))$$,
  'campaign_locked', 'لا تعديل للحملة بعد السحب');
reset role;
select tests.ok(exists (select 1 from public.activity_logs where action = 'campaign.drawn'), 'السحب مسجل في سجل النشاط');
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select tests.ok(public.catalog_campaign()->'last_winner'->>'winner' = '059****001', 'إعلان الفائز للزوار');

-- ============ 4) السجل الموحد والملخص ============
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', false);
select tests.ok((public.admin_purchases('{"phone":"+970599777001"}')->>'total')::int = 2, 'البحث بالرقم بأي صيغة');
select tests.ok((public.admin_purchases('{"source":"store","status_group":"completed"}')->>'total')::int = 2, 'فلترة الفروع المعتمدة');
select tests.ok((public.admin_purchases('{"source":"online","phone":"0599000002"}')->>'total')::int >= 1, 'الطلبات الأونلاين في السجل نفسه');
select tests.ok((public.admin_purchases('{"phone":"123"}')->>'invalid_phone')::boolean, 'رقم بحث غير صالح يُبلَّغ ولا يعرض الكل');
select tests.ok((public.admin_purchases('{"page_size":1}')->'items'->0->>'source') is not null, 'تقسيم الصفحات');
insert into tests.ctx select 'sum', public.purchases_summary(current_date, current_date);
select tests.ok((select (v->'store_approved'->>'count')::int = 2 and (v->'store_approved'->>'amount')::numeric = 290 from tests.ctx where k = 'sum'),
  'ملخص الفروع: المعتمد فقط (250 + 40)');

-- ============ 5) الموظفون ============
select tests.ok(jsonb_array_length(public.staff_overview()->'roles') = 4, 'أدوار قابلة للمنح دون المدير الكامل');
select public.staff_invite('New.Staff@Test.local', 'reception');
select tests.ok((public.staff_overview()->'invites'->0->>'email') = 'new.staff@test.local', 'دعوة موظف بالبريد');
select tests.throws($$select public.staff_invite('x@test.local', 'owner')$$, 'invalid_role', 'لا منح دور المدير الكامل من الواجهة');
select tests.throws($$select public.staff_update('00000000-0000-0000-0000-00000000000a', 'reception', true)$$, 'cannot_change_self', 'لا تعديل لحسابك نفسه');
select public.staff_update('00000000-0000-0000-0000-0000000000b1', 'reception', false);
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000b1","aal":"aal2"}', false);
select tests.throws($$select public.record_store_purchase('0599777001', 50, (select (v#>>'{}')::uuid from tests.ctx where k='deir'), gen_random_uuid())$$,
  'forbidden', 'الموظف الموقوف لا يسجل مبيعات');
select tests.ok(public.staff_overview() is null, 'الموظف لا يرى قائمة الموظفين');
reset role;

-- ============ 6) العروض والإضافة السريعة ============
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select tests.ok(not exists (select 1 from jsonb_array_elements(public.catalog_offers(24)) c
  where (c->>'compare_at_price') is null or (c->>'price')::numeric >= (c->>'compare_at_price')::numeric), 'العروض: خصم فعلي فقط');
select tests.ok(not exists (select 1 from jsonb_array_elements(public.catalog_search('{"page_size":50}')->'items') c
  where (c->>'requires_measurement')::boolean and c->>'quick_variant_id' is not null), 'لا إضافة سريعة لمنتج حسب المقاس');
reset role;

select 'ALL MVP TESTS PASSED' as result;
