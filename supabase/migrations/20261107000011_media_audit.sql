-- =====================================================================
-- 0011 تسجيل إضافة/حذف/ترتيب صور المنتجات في سجل النشاط
-- =====================================================================
create trigger product_media_audit after insert or update or delete on public.product_media
  for each row execute function private.audit_row();
