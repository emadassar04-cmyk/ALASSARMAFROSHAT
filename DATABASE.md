# قاعدة البيانات (مسودة – تُنفذ في المرحلة 2)

الجداول الأساسية مذكورة في وثيقة المتطلبات (الجزء الثاني). قرارات التصميم:

- المبالغ: `NUMERIC(12,2)` مع `CHECK (>= 0)`؛ العملة ILS.
- `inventory`: `on_hand`, `reserved`, `available` (محسوب = on_hand − reserved) مع `CHECK (on_hand >= 0 AND reserved >= 0 AND reserved <= on_hand)`.
- `stock_reservations`: `status` (active/confirmed/released/expired)، `expires_at = now() + 2h`. التحرير بتحديث شرطي `WHERE status='active'` فلا يتكرر.
- `order_items`: لقطة (اسم، مواصفات، كمية، سعر، تكلفة، خصم، `net_line_amount`, `manager_profit_amount`, `store_due_amount`) مع `CHECK (manager_profit_amount <= net_line_amount)` و`store_due_amount = net_line_amount − manager_profit_amount`.
- `activity_logs`: INSERT فقط؛ triggers تمنع UPDATE/DELETE، وسحب الصلاحيات عن الأدوار العادية.
- الفروع: `branch_id` في الجداول التشغيلية لقبول التوسع.
- الأدوار: `roles/permissions/role_permissions` جاهزة دون إنشاء موظفين.
- RLS: الزوار لا يقرؤون إلا المنتجات المنشورة (عبر عرض بلا تكلفة)؛ العميل يقرأ طلبه فقط؛ المدير بدور admin.

## قيود إلزامية
لا مخزون سالب · لا ربح > صافي البند · لا تأكيد بعد انتهاء الحجز · لا تأكيد مرتين · لا تحرير مرتين · لا كوبون غير صالح · لا تعديل لسجل النشاط.
