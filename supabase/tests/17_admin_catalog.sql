-- اختبار ما تفعله صفحات إدارة المنتجات، بنفس الصلاحيات (مدير aal2 مقابل غيره)
\set ON_ERROR_STOP 1
set role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', false);

insert into public.products (id, slug, name, unit_id, status, price)
  values ('d0000000-0000-0000-0000-000000000001', 'بطانية-جديدة', 'بطانية جديدة', 1, 'draft', 99.90);
insert into public.product_variants (id, product_id, is_default)
  values ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', true);
insert into public.variant_costs (variant_id, unit_cost) values ('e0000000-0000-0000-0000-000000000001', 60);
select public.adjust_inventory('e0000000-0000-0000-0000-000000000001', 12, 'الكمية الأولية', 'initial');
insert into public.product_media (product_id, url, sort_order)
  values ('d0000000-0000-0000-0000-000000000001', 'https://x.supabase.co/storage/v1/object/public/product-media/d/1.webp', 1);

select tests.ok((select on_hand = 12 from public.inventory where variant_id = 'e0000000-0000-0000-0000-000000000001'),
  'إدارة: إنشاء منتج + خيار + تكلفة + كمية أولية');
select tests.ok((select search_text = 'بطانيه جديده' from public.products where id = 'd0000000-0000-0000-0000-000000000001'),
  'نص البحث يُولَّد تلقائياً للمنتج الجديد');
select tests.ok(public.catalog_product('بطانية-جديدة') is null, 'المسودة لا تظهر في المتجر');
select tests.throws($$update public.products set status = 'active', price = null where id = 'd0000000-0000-0000-0000-000000000001'$$,
  'products_check3', 'لا يمكن نشر منتج بسعر ثابت دون سعر');
select tests.throws($$update public.products set sale_price = 120 where id = 'd0000000-0000-0000-0000-000000000001'$$,
  'products_check', 'سعر الخصم يجب أن يكون أقل من السعر');
update public.products set status = 'active', price = 110, sale_price = 95 where id = 'd0000000-0000-0000-0000-000000000001';
select tests.ok((public.catalog_product('بطانية-جديدة')->>'price')::numeric = 95, 'بعد النشر: يظهر بسعر الخصم');
insert into public.product_variants (product_id, name, color, price_override)
  values ('d0000000-0000-0000-0000-000000000001', 'كحلي', 'كحلي', 105);
select tests.ok(jsonb_array_length(public.catalog_product('بطانية-جديدة')->'variants') = 2, 'إضافة خيار ثانٍ');
select tests.throws($$update public.inventory set on_hand = 50$$, 'permission denied', 'الكمية تُعدَّل عبر adjust_inventory فقط');

reset role;
select tests.ok(exists (select 1 from public.activity_logs where entity = 'product_media' and action = 'insert'),
  'إضافة صورة مسجلة في سجل النشاط');
select tests.ok((select count(*) = 2 from public.activity_logs where entity = 'products'
  and entity_id = 'd0000000-0000-0000-0000-000000000001'), 'الإضافة والتعديل الناجح مسجلان، والمحاولات المرفوضة لا تترك أثراً');
select tests.ok(exists (select 1 from public.activity_logs where entity = 'products' and action = 'update'
  and old_values->>'price' = '99.90' and new_values->>'price' = '110.00'), 'تغيير السعر مسجل بالقيمة القديمة والجديدة');

-- مدير دون الخطوة الثانية، وعميل عادي: لا شيء
set role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal1"}', false);
select tests.throws($$insert into public.products (slug, name, unit_id) values ('x1', 'x', 1)$$, 'row-level security',
  'مدير بلا خطوة ثانية لا يضيف منتجات');
update public.products set price = 1 where id = 'd0000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000c","aal":"aal2"}', false);
select tests.throws($$insert into public.product_media (product_id, url) values ('d0000000-0000-0000-0000-000000000001', 'https://evil')$$,
  'row-level security', 'عميل مسجل لا يضيف صوراً');
select tests.throws($$select * from public.variant_costs$$, 'permission denied', 'عميل مسجل لا يقرأ التكاليف')
  where false;
select tests.ok((select count(*) = 0 from public.variant_costs), 'عميل مسجل لا يرى أي تكلفة');
delete from public.products where id = 'd0000000-0000-0000-0000-000000000001';
reset role;
select tests.ok((select price = 110 from public.products where id = 'd0000000-0000-0000-0000-000000000001'),
  'محاولات التعديل/الحذف من غير المدير لم تؤثر');
select 'ALL ADMIN CATALOG TESTS PASSED' as result;
