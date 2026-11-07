# البنية

```
المتصفح (Next.js App Router, RTL)
   │  Server Components / Route Handlers / Server Actions
   ▼
طبقة الخادم (Vercel)  ── تحقق + rate limiting ──►  Supabase PostgreSQL
   │                                                 • جداول + RLS
   │                                                 • دوال RPC ذرية (حجز، تأكيد، تحرير، مالية)
   │                                                 • activity_logs (append-only)
   ▼
notification_outbox ──► n8n (webhook موقّع) ──► Telegram / WhatsApp Cloud API
```

## المسؤوليات
- **PostgreSQL:** مصدر الحقيقة لكل قواعد العمل: الحجز (ساعتان)، التأكيد، التحرير مرة واحدة، حساب الأرباح والمستحقات، الكوبونات.
- **Next.js:** العرض، التحقق من المدخلات، استدعاء RPC بالمفتاح المناسب. `SUPABASE_SERVICE_ROLE_KEY` للخادم فقط.
- **n8n:** إشعارات ومهام مجدولة فقط (إعادة محاولة، event_id لمنع التكرار). لا يعدّل الكميات ولا يحسب الأرباح.

## تدفق الطلب
1. العميل يرسل الطلب → API يتحقق → RPC `create_order` يحجز الكمية ذرياً (قفل صفوف المخزون) لساعتين.
2. صف في `notification_outbox` → n8n → Telegram للمدير.
3. المدير يؤكد عبر WhatsApp ثم يعتمد الطلب → RPC `confirm_order` يحوّل الحجز إلى خصم نهائي ويحفظ لقطة الأسعار والتكاليف والربح.
4. انتهاء الحجز: مهمة مجدولة تستدعي `release_expired_reservations` (idempotent).

## الأمان
RLS على كل الجداول الحساسة؛ التكلفة والربح في جداول/عروض لا يقرؤها الزوار؛ المدير: Google + 2FA؛ webhooks موقّعة؛ أسرار في Env فقط.
