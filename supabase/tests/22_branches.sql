-- اختبارات الفروع: البيانات، القيود، والواجهة العامة
\set ON_ERROR_STOP 1

set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select tests.ok(jsonb_array_length(public.catalog_branches()) = 2, 'فرعان فعّالان');
select tests.ok(public.catalog_branches()->0->>'city' = 'دير البلح' and (public.catalog_branches()->0->>'is_main')::boolean, 'دير البلح أولاً وهو الرئيسي');
select tests.ok(public.catalog_branches()->1->>'address' = 'مقابل Ooredoo', 'عنوان فرع النصيرات');
update public.branches set phone = '+970599999999';
reset role;
select tests.ok(not exists (select 1 from public.branches where phone = '+970599999999'), 'الزائر لا يعدّل الفروع (الصلاحيات تمنع التحديث)');

-- القيود
select tests.throws($$update public.branches set lat = 31.4 where is_default$$, 'branches_coords_pair', 'لا خط عرض دون خط طول');
select tests.throws($$update public.branches set map_url = 'javascript:alert(1)' where is_default$$, 'branches_map_url_https', 'رابط الخريطة https فقط');
select tests.throws($$update public.branches set phone = 'abc' where is_default$$, 'branches_phone_format', 'صيغة الهاتف');
select tests.ok((select private.default_branch_id()) = (select id from public.branches where city = 'دير البلح'), 'المخزون والطلبات ما زالت على فرع دير البلح');

-- المدير يحدّث الإحداثيات
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', false);
update public.branches set lat = 31.417000, lng = 34.351000, map_url = 'https://maps.app.goo.gl/test' where is_default;
select tests.ok((select lat from public.branches where is_default) = 31.417, 'المدير يحفظ موقع الفرع');
reset role;
select tests.ok(exists (select 1 from public.activity_logs where entity = 'branches' and action = 'update'), 'تعديل الفرع مسجل');
update public.branches set lat = null, lng = null, map_url = null where is_default;
select 'ALL BRANCH TESTS PASSED' as result;
