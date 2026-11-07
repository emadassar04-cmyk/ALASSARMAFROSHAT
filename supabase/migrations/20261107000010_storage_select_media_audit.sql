-- =====================================================================
-- 0010 إصلاح حذف الصور من Storage + تدقيق الوسائط
-- Supabase Storage يتطلب صلاحية SELECT على الملف قبل حذفه؛ بدونها يفشل remove() بصمت
-- فيبقى الملف في التخزين بعد حذف سجله. (الملفات تبقى عامة للقراءة عبر روابطها لأن الحاوية public)
-- =====================================================================
create policy product_media_staff_select on storage.objects for select to authenticated
  using (bucket_id = 'product-media' and private.has_permission('catalog.manage'));
