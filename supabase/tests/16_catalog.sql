-- اختبارات واجهة الكتالوج العامة والبحث العربي (بعد 10_core و15_staff_auth)
\set ON_ERROR_STOP 1
select tests.ok(private.ar_normalize('أَحْمَدُ') = 'احمد', 'إزالة التشكيل وتوحيد الهمزة');
select tests.ok(private.ar_normalize('مخدّة  كبيرة') = 'مخده كبيره', 'توحيد التاء المربوطة والمسافات');
select tests.ok(private.ar_normalize('مـــرتبة') = 'مرتبه', 'إزالة التطويل');

update public.products set materials = '{قطن}', is_featured = true where slug = 'مخدة-ب';
insert into public.product_variants (product_id, name, color, size, price_override)
  values ('a0000000-0000-0000-0000-000000000002', 'كبير', 'أبيض', '50×70', 65);
insert into public.product_media (product_id, url, sort_order) values
  ('a0000000-0000-0000-0000-000000000002', 'https://example.test/b2.webp', 2),
  ('a0000000-0000-0000-0000-000000000002', 'https://example.test/b1.webp', 1);

set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);

select tests.ok((select jsonb_array_length(c) = 7 from public.catalog_categories() c), 'التصنيفات السبعة الأساسية');
select tests.ok((public.catalog_search('{}')->>'total')::int = 4, 'التصفح يعرض المنتجات النشطة الأربعة فقط');
select tests.ok(public.catalog_search('{}')::text !~* '(cost|on_hand|reserved|profit|store_due|low_stock)',
  'نتائج التصفح لا تحتوي أي بيانات داخلية');
select tests.ok(public.catalog_product('مخدة-ب')::text !~* '(cost|on_hand|reserved|profit|store_due|low_stock)',
  'صفحة المنتج لا تحتوي أي بيانات داخلية');
select tests.ok(public.catalog_product('مسودة') is null, 'المنتج غير المنشور لا يظهر حتى برابطه');

-- البحث العربي
select tests.ok((public.catalog_search('{"q":"مخده"}')->'items'->0->>'slug') = 'مخدة-ب', 'البحث دون همزة/تاء مربوطة');
select tests.ok((public.catalog_search('{"q":"وسادة"}')->'items'->0->>'slug') = 'مخدة-ب', 'البحث بمرادف لهجة (وسادة ← مخدة)');
select tests.ok((public.catalog_search('{"q":"برداية"}')->'items'->0->>'slug') = 'ستارة-تفصيل', 'برداية ← ستارة');
select tests.ok((public.catalog_search('{"q":"سجاده"}')->'items'->0->>'slug') = 'سجادة-أ', 'سجاده ← سجادة');
select tests.ok((public.catalog_search('{"q":"مخدة قطن"}')->>'total')::int >= 1, 'البحث بالخامة');
select tests.ok((public.catalog_search('{"q":"محدة"}')->'items'->0->>'slug') = 'مخدة-ب', 'تحمّل خطأ إملائي (محدة ← مخدة)');
select tests.ok((public.catalog_search('{"q":"ثلاجة"}')->>'total')::int = 0, 'كلمة لا علاقة لها: لا نتائج');
select tests.ok(public.catalog_suggest('م') = '[]'::jsonb or public.catalog_suggest('م') is null, 'لا اقتراحات لحرف واحد');
select tests.ok(jsonb_array_length(public.catalog_suggest('مخد')) between 1 and 6, 'اقتراحات أثناء الكتابة');
select tests.ok(public.catalog_suggest('مخد')->0->'image'->>'url' = 'https://example.test/b1.webp', 'الاقتراح يعرض أول صورة بالترتيب');

-- الفلاتر والترتيب
select tests.ok((public.catalog_search('{"category":"مخدات"}')->>'total')::int = 1, 'فلتر التصنيف');
select tests.ok((public.catalog_search('{"color":"أبيض"}')->>'total')::int = 1, 'فلتر اللون');
select tests.ok((public.catalog_search('{"featured":true}')->>'total')::int = 1, 'المنتجات المميزة');
select tests.ok((public.catalog_search('{"min_price":60,"max_price":150}')->>'total')::int = 1, 'فلتر السعر (سجادة 100 فقط)');
select tests.ok((select array_agg(x->>'slug') from jsonb_array_elements(public.catalog_search('{"sort":"price_asc"}')->'items') x)
  = array['مخدة-ب','سجادة-أ','لحاف-حسب-الطلب','ستارة-تفصيل'], 'الترتيب حسب السعر تصاعدياً (منتج القياس بلا سعر في الآخر)');
select tests.ok((public.catalog_search('{"availability":"available"}')->>'total')::int = 3, 'فلتر "متوفر" يستبعد المنتج النافد');
select tests.ok((public.catalog_search('{"page_size":2,"page":2}')->'items'->>0) is not null
  and jsonb_array_length(public.catalog_search('{"page_size":2,"page":2}')->'items') = 2, 'التقسيم إلى صفحات');
select tests.ok((public.catalog_search('{"page_size":1000}')->>'page_size')::int = 48, 'حد أقصى 48 منتجاً للصفحة');

-- بيانات البطاقة وصفحة المنتج
select tests.ok((public.catalog_product('مخدة-ب')->>'price')::numeric = 50, 'سعر البطاقة = أقل سعر بين الخيارات');
select tests.ok(jsonb_array_length(public.catalog_product('مخدة-ب')->'variants') = 2, 'الخيارات النشطة');
select tests.ok(public.catalog_product('مخدة-ب')->'breadcrumbs'->0->>'name' = 'المخدات', 'مسار التصنيف');
select tests.ok(public.catalog_product('ستارة-تفصيل')->>'price' is null
  and public.catalog_product('ستارة-تفصيل')->>'availability' = 'made_to_order', 'منتج القياس بلا سعر تقديري');
select tests.ok(public.catalog_product('سجادة-أ')->>'availability' = 'out_of_stock', 'النافد يظهر نافداً دون كمية');
select tests.ok((select (x->>'price')::numeric = 65 from jsonb_array_elements(
  public.catalog_variants(array(select id from public.product_variants where name = 'كبير'))) x), 'بيانات السلة بالسعر الحالي');
select tests.ok(public.catalog_facets() @> '{"colors":["أبيض"],"sizes":["50×70"]}', 'قيم الفلاتر المتاحة');
select tests.throws($$insert into public.search_synonyms (term, synonym) values ('x','y')$$, 'row-level security',
  'الزائر لا يعدّل المرادفات');

-- الأكثر مبيعاً: فقط ما بيع فعلاً في طلبات مؤكدة (سجادة أ بيعت في o1 المؤكد؛ o2 أُلغي)
select tests.ok((select array_agg(x->>'slug') from jsonb_array_elements(public.catalog_best_sellers()) x) = array['سجادة-أ'],
  'الأكثر مبيعاً يعرض المنتجات المباعة فعلاً فقط');
select tests.ok(public.catalog_best_sellers()::text !~* '(cost|profit|on_hand)', 'الأكثر مبيعاً بلا بيانات داخلية');

reset role;
select 'ALL CATALOG TESTS PASSED' as result;
