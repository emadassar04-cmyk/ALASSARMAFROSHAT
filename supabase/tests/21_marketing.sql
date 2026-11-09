-- اختبارات التسويق والمحتوى: السياسات (نشر، صلاحيات، منع الخانات الفارغة)، خريطة الموقع، معرّفات التحليلات
\set ON_ERROR_STOP 1

-- الزائر لا يرى السياسات غير المنشورة
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select tests.ok(jsonb_array_length(public.catalog_policies()) = 0, 'لا سياسات منشورة افتراضياً (لا نص مخترع)');
select tests.ok((select count(*) from public.store_policies) = 0, 'الزائر لا يقرأ المسودات مباشرة');
select tests.throws($$update public.store_policies set is_published = true$$, 'permission denied', 'الزائر لا يعدّل السياسات');

-- المدير يكتب وينشر
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', false);
select tests.ok((select count(*) from public.store_policies) = 3, 'المدير يرى المسودات الثلاث');
select tests.throws($$update public.store_policies set is_published = true where slug = 'returns'$$,
  'store_policies_publish_ready', 'لا تُنشر سياسة فارغة');
select tests.throws($$update public.store_policies set body = 'يمكن الاستبدال خلال [عدد الأيام] يوماً من تاريخ الاستلام بشرط سلامة المنتج.', is_published = true where slug = 'returns'$$,
  'store_policies_publish_ready', 'لا تُنشر سياسة فيها خانة لم تُملأ');
update public.store_policies set body = 'يمكن استبدال المنتج خلال ثلاثة أيام من تاريخ الاستلام بشرط أن يكون بحالته الأصلية.', is_published = true where slug = 'returns';
select tests.ok((select updated_by = '00000000-0000-0000-0000-00000000000a' from public.store_policies where slug = 'returns'), 'يُسجل من عدّل السياسة');
select tests.throws($$insert into public.store_policies (slug, title) values ('terms', 'شروط')$$, 'permission denied', 'لا إضافة صفحات سياسة جديدة');
select tests.throws($$delete from public.store_policies$$, 'permission denied', 'لا حذف لصفحات السياسة');

-- معرّفات التحليلات: صيغ صحيحة فقط
select tests.throws($$update public.store_settings set ga_measurement_id = 'UA-123'$$, 'store_settings_ga_measurement_id_check', 'معرّف GA بصيغة خاطئة مرفوض');
select tests.throws($$update public.store_settings set meta_pixel_id = '12ab'$$, 'store_settings_meta_pixel_id_check', 'معرّف Pixel بصيغة خاطئة مرفوض');
update public.store_settings set ga_measurement_id = 'G-ABC123XYZ', meta_pixel_id = '1234567890123456';

-- الزائر يرى المنشورة فقط
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select tests.ok(jsonb_array_length(public.catalog_policies()) = 1 and public.catalog_policies()->0->>'slug' = 'returns', 'الزائر يرى السياسة المنشورة فقط');
select tests.ok((select ga_measurement_id from public.store_settings) = 'G-ABC123XYZ', 'معرّف GA مقروء للمتجر');

-- خريطة الموقع: منتجات نشطة فقط
select tests.ok(
  (select count(*) from jsonb_array_elements(public.catalog_sitemap()->'products'))
    = (select (public.catalog_search('{"page_size":1}')->>'total')::int), 'خريطة الموقع تطابق المنتجات الظاهرة للزبون');
select tests.ok(jsonb_array_length(public.catalog_sitemap()->'policies') = 1, 'خريطة الموقع تضم السياسات المنشورة فقط');
select tests.ok(jsonb_array_length(public.catalog_branches()) >= 1, 'الفروع الفعّالة متاحة للبيانات المنظمة');
reset role;

select tests.ok(exists (select 1 from public.activity_logs where entity = 'store_policies'), 'تعديل السياسات مسجل في سجل النشاط');

-- إرجاع الحالة حتى لا تتأثر الاختبارات اللاحقة
update public.store_policies set is_published = false, body = '';
update public.store_settings set ga_measurement_id = null, meta_pixel_id = null;
select 'ALL MARKETING TESTS PASSED' as result;
