-- 0028: طريقة دفع جديدة «المحفظة الإلكترونية».
-- قيمة enum الجديدة في ملف مستقل: Postgres لا يسمح باستخدام قيمة أُضيفت في نفس المعاملة.
-- إضافة فقط (لا حذف ولا تعديل لبيانات موجودة).
alter type public.payment_method_code add value if not exists 'e_wallet';
