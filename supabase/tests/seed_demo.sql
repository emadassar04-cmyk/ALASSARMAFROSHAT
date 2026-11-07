-- بيانات تجريبية لقاعدة الاختبار المحلية فقط (لا تُطبق على Supabase أبداً)
update public.store_settings set is_published = true, whatsapp_number = '970599000000';

insert into public.products (slug, name, description, category_id, unit_id, status, price, sale_price, is_featured,
                             materials, prep_days_min, prep_days_max, availability_mode, requires_measurement)
select v.slug, v.name, v.description, (select id from public.categories where slug = v.cat),
       (select id from public.units where code = v.unit), 'active', v.price, v.sale, v.featured, v.materials, 1, 3,
       v.mode::public.availability_mode, v.measure
from (values
  ('سجادة-تركية-كلاسيك', 'سجادة تركية كلاسيك', 'سجادة تركية بنقوش كلاسيكية وألوان دافئة، سهلة التنظيف.', 'سجاد-وموكيت', 'piece', 450::numeric, 380::numeric, true, '{بوليستر}'::text[], 'stock', false),
  ('موكيت-حسب-المقاس', 'موكيت حسب المقاس', 'موكيت فاخر يُقص ويُركب حسب مقاس الغرفة.', 'سجاد-وموكيت', 'sqm', null, null, false, '{صوف}'::text[], 'made_to_order', true),
  ('ستارة-مخمل-ملكية', 'ستارة مخمل ملكية', 'ستائر مخمل معتمة تفصّل حسب مقاس النافذة.', 'ستائر', 'meter', null, null, true, '{مخمل}'::text[], 'made_to_order', true),
  ('مرتبة-طبية-فاخرة', 'مرتبة طبية فاخرة', 'مرتبة طبية بنوابض مستقلة لراحة الظهر.', 'مراتب-ومفروشات', 'piece', 1200, null, true, '{إسفنج,قطن}'::text[], 'stock', false),
  ('بطانية-شتوية-ناعمة', 'بطانية شتوية ناعمة', 'بطانية مزدوجة الوجه دافئة وخفيفة.', 'بطانيات-ولحف', 'piece', 160, 135, false, '{بوليستر}'::text[], 'stock', false),
  ('لحاف-قطن-مصري', 'لحاف قطن مصري', 'لحاف محشو بالقطن المصري مناسب لكل الفصول.', 'بطانيات-ولحف', 'piece', 220, null, false, '{قطن}'::text[], 'stock', false),
  ('طقم-شراشف-ساتان', 'طقم شراشف ساتان', 'طقم شراشف ساتان مع غطاءي مخدة.', 'شراشف', 'set', 140, null, false, '{ساتان}'::text[], 'stock', false),
  ('مخدة-فندقية', 'مخدة فندقية', 'مخدة فندقية بحشوة ألياف مجوفة.', 'مخدات', 'piece', 45, null, true, '{قطن}'::text[], 'stock', false),
  ('مفرش-طاولة-مطرز', 'مفرش طاولة مطرز', 'مفرش طاولة بتطريز يدوي.', 'مفروشات-منزلية', 'piece', 75, null, false, '{كتان}'::text[], 'coming_soon', false)
) as v(slug, name, description, cat, unit, price, sale, featured, materials, mode, measure);

insert into public.product_variants (product_id, name, color, size, is_default, price_override)
select p.id, v.name, v.color, v.size, v.is_default, v.price
from (values
  ('سجادة-تركية-كلاسيك', 'افتراضي', 'أحمر', '200×300', true, null::numeric),
  ('سجادة-تركية-كلاسيك', 'كبيرة', 'أحمر', '250×350', false, 520),
  ('سجادة-تركية-كلاسيك', 'رمادي', 'رمادي', '200×300', false, null),
  ('موكيت-حسب-المقاس', 'افتراضي', null, null, true, null),
  ('ستارة-مخمل-ملكية', 'افتراضي', 'بيج', null, true, null),
  ('مرتبة-طبية-فاخرة', 'مفردة', null, '90×190', true, null),
  ('مرتبة-طبية-فاخرة', 'مزدوجة', null, '160×200', false, 1650),
  ('بطانية-شتوية-ناعمة', 'افتراضي', 'بيج', '200×220', true, null),
  ('لحاف-قطن-مصري', 'افتراضي', 'أبيض', '220×240', true, null),
  ('طقم-شراشف-ساتان', 'افتراضي', 'ذهبي', '200×200', true, null),
  ('مخدة-فندقية', 'افتراضي', 'أبيض', '50×70', true, null),
  ('مفرش-طاولة-مطرز', 'افتراضي', 'أبيض', null, true, null)
) as v(slug, name, color, size, is_default, price)
join public.products p on p.slug = v.slug;

update public.inventory i set on_hand = q.n
from (values ('سجادة-تركية-كلاسيك', 'افتراضي', 6), ('سجادة-تركية-كلاسيك', 'كبيرة', 1),
             ('مرتبة-طبية-فاخرة', 'مفردة', 4), ('مرتبة-طبية-فاخرة', 'مزدوجة', 2),
             ('بطانية-شتوية-ناعمة', 'افتراضي', 15), ('لحاف-قطن-مصري', 'افتراضي', 0),
             ('طقم-شراشف-ساتان', 'افتراضي', 9), ('مخدة-فندقية', 'افتراضي', 40)) as q(slug, vname, n)
join public.products p on p.slug = q.slug
join public.product_variants v on v.product_id = p.id and v.name = q.vname
where i.variant_id = v.id;

insert into public.delivery_zones (name, fee, eta_text, sort_order) values
  ('دير البلح', 10, 'خلال يوم', 1), ('النصيرات', 15, 'خلال يوم', 2), ('الزوايدة', 20, 'خلال يومين', 3);
insert into public.coupons (code, kind, value) values ('WELCOME10', 'percent', 10);
