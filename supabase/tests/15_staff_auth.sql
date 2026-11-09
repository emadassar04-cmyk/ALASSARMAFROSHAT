-- اختبارات دخول الموظفين. تُشغَّل بعد 10_core.sql (تعيد استخدام tests.ok / tests.throws)
\set ON_ERROR_STOP 1
insert into private.staff_invites (email, role_code) values ('owner@test.local', 'owner');

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'Owner@Test.local', '{"full_name":"المالك"}'),
  ('00000000-0000-0000-0000-0000000000f2', 'stranger@test.local', '{}');
select tests.ok((select r.code = 'owner' from public.profiles p join public.roles r on r.id = p.role_id
  where p.id = '00000000-0000-0000-0000-0000000000f1'), 'البريد المدعوّ يحصل على دور المدير (دون حساسية لحالة الأحرف)');
select tests.ok(not exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-0000000000f2'),
  'أي حساب Google آخر لا يحصل على أي دور');
select tests.ok((select accepted_at is not null from private.staff_invites where email = 'owner@test.local'),
  'الدعوة تُستهلك مرة واحدة');
-- دعوة لمستخدم سجّل قبل إضافتها
insert into private.staff_invites (email, role_code) values ('stranger@test.local', 'reports');
select tests.ok(private.accept_pending_invites() = 1, 'تطبيق الدعوة على مستخدم موجود مسبقاً');
select tests.ok((select r.code = 'reports' from public.profiles p join public.roles r on r.id = p.role_id
  where p.id = '00000000-0000-0000-0000-0000000000f2'), 'المستخدم الموجود حصل على دوره');

set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select tests.throws('select public.my_staff_context()', 'permission denied', 'الزائر لا يستدعي سياق الموظف');

set role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000f1","aal":"aal1"}', false);
select tests.ok((select (c->>'is_staff_account')::boolean and c->>'aal' = 'aal1' and c->'permissions' = '[]'::jsonb
  from public.my_staff_context() c), 'قبل الخطوة الثانية: الحساب معروف كموظف لكن بلا صلاحيات');
select tests.throws('select public.record_staff_login()', 'forbidden', 'لا يُسجَّل دخول قبل الخطوة الثانية');

select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000f1","aal":"aal2"}', false);
select tests.ok((select jsonb_array_length(c->'permissions') = 12 and c->>'role' = 'owner'
  from public.my_staff_context() c), 'بعد الخطوة الثانية: المدير يملك كل الصلاحيات (12)');
select public.record_staff_login('test-agent');

select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000c9","aal":"aal2"}', false);
select tests.ok((select not (c->>'is_staff_account')::boolean from public.my_staff_context() c),
  'عميل عادي: ليس موظفاً');
select tests.throws('select * from private.staff_invites', 'permission denied', 'لا أحد يقرأ قائمة الدعوات عبر API');

reset role;
select tests.ok(exists (select 1 from public.activity_logs where action = 'auth.staff_login'), 'الدخول مسجل في سجل النشاط');
select 'ALL STAFF AUTH TESTS PASSED' as result;
