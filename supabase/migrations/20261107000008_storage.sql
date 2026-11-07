-- =====================================================================
-- 0008 تخزين صور وفيديو المنتجات في Supabase Storage
-- القراءة عامة (روابط الصور في المتجر)، والرفع/التعديل/الحذف لصاحب صلاحية الكتالوج فقط
-- (يُتخطى في الاختبار المحلي لعدم وجود مخطط storage)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-media', 'product-media', true, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy product_media_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'product-media' and private.has_permission('catalog.manage'));
create policy product_media_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'product-media' and private.has_permission('catalog.manage'))
  with check (bucket_id = 'product-media' and private.has_permission('catalog.manage'));
create policy product_media_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'product-media' and private.has_permission('catalog.manage'));
