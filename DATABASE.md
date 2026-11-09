# قاعدة البيانات

**المشروع:** Supabase `puakwxubskwxostdtmzi` (PostgreSQL 17، منطقة ap-northeast-2، خطة مجانية).
الملفات في `supabase/migrations/` هي المصدر الوحيد للمخطط، وقد طُبقت كلها على Supabase وتطابقت بصمتها
(md5 للدوال والسياسات والقيود والأعمدة) مع النسخة المختبرة محلياً.

| الملف | المحتوى |
|---|---|
| `0001_foundation` | المخطط `private`، الأدوار والصلاحيات، `profiles`، `activity_logs` (append-only)، الفروع، الإعدادات، ساعات العمل |
| `0002_catalog` | الوحدات، التصنيفات (7 أساسية)، المنتجات، الخيارات، الوسائط، `variant_costs`، `inventory`، `inventory_movements` |
| `0003_orders` | العملاء، مناطق التوصيل، وسائل الدفع، الحسابات البنكية، الكوبونات، الطلبات وبنودها، الحجوزات، سجل الحالات، صندوق الأحداث |
| `0004_cron` | pg_cron: تحرير الحجوزات المنتهية كل 5 دقائق |
| `0005_place_order_server_only` | إنشاء الطلب من خادم Next.js فقط |
| `0006_staff_auth` | دعوات الموظفين بالبريد (`private.staff_invites`)، `my_staff_context`، `record_staff_login` |
| `0007_catalog_api` | البحث العربي (`ar_normalize`، مرادفات اللهجة، trigram + levenshtein)، `catalog_*` بحقول آمنة فقط |
| `0008_storage` | حاوية `product-media`: قراءة عامة، رفع/حذف لصاحب صلاحية الكتالوج |
| `0009_best_sellers` | الأكثر مبيعاً من الطلبات المؤكدة فقط |
| `0010`–`0011` | صلاحية قراءة ملفات الصور للمدير (شرط الحذف) + تدقيق الوسائط |
| `0012_checkout` | `quote_order` (ملخص بلا كتابة)، `rate_limit_hit`، تعليمات الدفع |
| `0013_telegram_notifications` | مفاتيح تكامل مجزأة، `notification_deliveries` لكل قناة، نصوص Telegram، التقرير اليومي |
| `0014_finance` | `expenses` (إلغاء لا حذف)، `stocktakes`، `finance_report`، `admin_dashboard`، `set_customer_tier` |
| `0015_marketing_policies` | `store_policies` (3 صفحات ثابتة، لا نشر لنص فارغ أو فيه خانات `[ ]`)، معرّفات GA4/Meta Pixel/Search Console في `store_settings`، `catalog_policies`، `catalog_sitemap`، `catalog_branches` |
| `0016_branches_locations` | الفروع: المدينة والإحداثيات وترتيب العرض + قيود (رابط https، صيغة الهاتف، الإحداثيات معاً)؛ بيانات فرعي دير البلح (الرئيسي) والنصيرات؛ `catalog_branches` بالحقول الجديدة. المخزون والطلبات تبقى على الفرع الرئيسي |
| `0017_branch_map_pins` | الإحداثيات الدقيقة للفرعين من روابط Google Maps التي أرسلها المالك |
| `0018_customer_identity` | هوية العميل الموحدة برقم الجوال: صيغة واحدة `05XXXXXXXX` (`private.canonical_phone`)، تحويل العملاء والطلبات الموجودة بعد فحص التكرار، قيد `customers_phone_canonical`. الرقم **مُعرّف فقط وليس إثبات هوية** |
| `0019_store_purchases` | مبيعات الفروع: صلاحيات `sales.record` / `sales.review` / `staff.manage` / `campaigns.manage`؛ جدول `store_purchases` (مُرسل ← معتمد / مرفوض / ملغى، مع سبب إلزامي للرفض والإلغاء)؛ `record_store_purchase` بمعرّف طلب فريد ضد التكرار + تنبيه «عملية مشابهة خلال دقيقتين»؛ المراجعة والتصحيح والاعتماد الجماعي؛ إدارة الموظفين |
| `0020_unified_purchases` | سجل مشتريات موحد (طلبات الموقع + مبيعات الفروع) `admin_purchases` و`purchases_summary` — للمدير فقط |
| `0021_campaigns` | حملة «تسوّق واربح»: `campaigns` و`campaign_entries` (فرصة واحدة لكل عملية: طلب «تم التسليم» أو بيع فرع «معتمد»، وتُلغى الفرصة عند الإلغاء/الرفض)؛ السحب بعد انتهاء الحملة فقط ومرة واحدة؛ إعلان الفائز برقم مخفي؛ `catalog_campaign` للواجهة |
| `0022_storefront_offers` | `catalog_offers` (خصم فعلي ضمن فترته فقط) و`quick_variant_id` لزر «أضف للسلة» من البطاقة |
| `0023_admin_console` | لوحة الإدارة الجديدة (إضافات فقط): لغة كل موظف `profiles.locale` + `set_my_locale`؛ اسم إنجليزي للأدوار + 5 أدوار جاهزة (مدير المتجر، مدير الطلبات، مدير المنتجات، محاسب، مشاهد) + مصفوفة صلاحيات `admin_roles`/`set_role_permissions` (المدير العام مقفل، كل تعديل مسجل)؛ `admin_overview` (مؤشرات الفترة والسابقة + سلاسل زمنية + أيام الأسبوع + الأكثر مبيعاً، كل قسم حسب الصلاحية، والأرقام المالية من `finance_kpis` نفسها)؛ `admin_orders` (بحث وفلترة وفرز وترقيم حقيقي وتصدير مسجل)؛ `admin_customers`/`admin_customer` (CRM: الموقع + الفروع المعتمدة)؛ `admin_activity`؛ `admin_notifications`؛ `admin_search`؛ `delete_product` (فقط لمنتج بلا أي تاريخ، وإلا الأرشفة) |

## تعريفات التقارير المالية
- البيع يُحتسب عند **تأكيد** الطلب (بتوقيت فلسطين) ويُستبعد إن أُلغي لاحقاً.
- ربح المدير = مجموع الربح اليدوي للبنود؛ مستحقات المحل = صافي البنود − ربح المدير.
- رسوم التوصيل المحصّلة للمدير، وأجرة المندوب الفعلية تُسجَّل كمصروف «توصيل».
- **صافي ربح المدير = ربح المدير + رسوم التوصيل − المصروفات.**
- خصومات الكوبونات مخصومة من صافي البنود أصلاً، فلا تُسجَّل كمصروف (منعاً للخصم المزدوج).

## مبادئ التصميم
- **المبالغ:** `numeric(12,2)`، العملة ILS. لا floating point.
- **الكتابة على المخزون والطلبات عبر دوال فقط.** حتى المدير لا يملك `UPDATE` على `inventory` أو `orders`؛ هذا يضمن أن كل تغيير يمر بالقيود ويُسجَّل.
- **دوال `security definer`** كلها بـ `search_path = ''` وأسماء مؤهلة، وكل واحدة تتحقق من الصلاحية أولاً.
- **الصلاحيات:** `private.has_permission(code)` تشترط دور نشط **وجلسة بخطوتين `aal2`**. المدير الذي دخل بكلمة مرور فقط لا يملك أي صلاحية.
- **الفروع:** `branch_id` في المخزون والطلبات ومناطق التوصيل؛ فرع افتراضي واحد حالياً.

## المخزون والحجز
`inventory(on_hand, reserved)` لكل خيار وفرع، والمتاح = `on_hand − reserved`.
قيود: `on_hand ≥ 0`، `reserved ≥ 0`، `reserved ≤ on_hand`.

| العملية | الدالة | ما يحدث |
|---|---|---|
| طلب جديد | `place_order` | تحديث شرطي ذري `reserved += q WHERE on_hand − reserved ≥ q`؛ البنود مرتبة بـ variant_id لمنع deadlock |
| تأكيد | `confirm_order` | يقفل الطلب؛ يرفض المنتهي أو المؤكد سابقاً؛ `on_hand −= q, reserved −= q`؛ يحفظ لقطة التكلفة |
| إلغاء قبل التأكيد | `cancel_order` | يحرر الحجوزات `active` فقط |
| إلغاء بعد التأكيد | `cancel_order` | يعيد الكمية مرة واحدة؛ بعد بدء التجهيز يتطلب `p_force` |
| انتهاء المهلة | `release_expired_reservations` | `FOR UPDATE SKIP LOCKED`؛ يحرر ويلغي الطلب؛ آمن عند التكرار والتوازي |
| بيع في المحل | `record_in_store_sale` | من المتاح فقط، لا يمس المحجوز |
| تعديل/جرد | `adjust_inventory` | لا ينزل تحت المحجوز؛ يتطلب سبباً |

كل تغيير يُكتب في `inventory_movements` (غير قابل للتعديل).

## المالية في `order_items`
- `gross_line_amount = unit_price × quantity` (محسوب)
- `net_line_amount = gross − discount_amount` (محسوب)
- `manager_profit_amount`: يدوي عبر `set_item_profit`، بعد التأكيد فقط، وقيد `≤ net_line_amount`
- `store_due_amount = net − manager_profit` (محسوب، لا يُدخل يدوياً)
- `unit_cost_snapshot`: يُنسخ من `variant_costs` لحظة التأكيد ولا يتغير بعدها
- خصم الكوبون يوزع على البنود بالتناسب، والباقي من التقريب على آخر بند

## ما يراه الزائر
المنتجات والتصنيفات والوسائط النشطة، ومناطق التوصيل، ووسائل الدفع والحسابات البنكية المفعلة، والإعدادات العامة.
التوفر عبر `get_variant_availability` يعيد تصنيفاً فقط (`in_stock`/`limited`/`out_of_stock`/`made_to_order`/`coming_soon`/`unavailable`).
التتبع عبر `track_order(رقم الطلب، الرمز السري)`؛ الرمز يُخزَّن مجزأً (sha256).
السياسات المنشورة فقط (المسودات للموظفين). معرّفات GA4 وMeta Pixel عامة بطبيعتها (تظهر في كود الصفحة).
**لا يصل الزائر إطلاقاً إلى:** التكاليف، الكميات، الطلبات، بنود الطلبات، العملاء، الكوبونات، السجلات.

## صندوق الأحداث (لـ n8n)
`notification_outbox` بـ `event_id` فريد. n8n يستدعي `claim_outbox_events` (يقفل بـ SKIP LOCKED) ثم
`complete_outbox_event`. إعادة المحاولة بتأخير أسي حتى 5 محاولات ثم `dead`. الأحداث:
`order.created`، `payment.bank_transfer_selected`، `order.status_changed`، `reservation.expired`.

## جداول لم تُنشأ بعد (مراحل لاحقة)
stocktakes/stocktake_items، expenses، returns، reviews، wishlists، carts، conversations/messages،
notification_logs، analytics_events، abandoned_cart_events، content_sections، banners،
integration_settings، العروض المتدرجة (اشترِ أكثر ووفر أكثر).
