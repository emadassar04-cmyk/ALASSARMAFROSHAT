# مصادر الصور

كل الصور الثابتة في الموقع (غير صور المنتجات) من **Unsplash** وتخضع لـ [رخصة Unsplash](https://unsplash.com/license):
استخدام تجاري مجاني دون الحاجة لإذن أو نسب. نُزّلت وحُفظت داخل المشروع (لا روابط خارجية وقت التصفح)،
ويقدّمها `next/image` بصيغ AVIF/WebP وبالأحجام المناسبة لكل شاشة.

**تنبيه:** هذه صور توضيحية لأجواء المنزل وأنواع المنتجات، **وليست** صوراً لمنتجات المحل أو لفروعه.
صور المنتجات الحقيقية تُرفع من لوحة الإدارة (Supabase Storage) ولها الأولوية دائماً. وصورة القسم المرفوعة
من الإدارة (`categories.image_url`) تحل محل الصورة التوضيحية للقسم تلقائياً.

| الملف | الاستخدام | المصدر (معرّف Unsplash) |
|---|---|---|
| `src/assets/home/hero-living-room.webp` | واجهة الصفحة الرئيسية، صورة المشاركة | `photo-1615529182904-14819c35db37` |
| `src/assets/home/editorial-living.webp` | القسم التحريري «جدّد منزلك» | `photo-1616486338812-3dadae4b4ace` |
| `src/assets/home/about-living.webp` | قسم «عن مفروشات العصار» | `photo-1600210492486-724fe5c67fb0` |
| `public/images/categories/rugs.webp` | قسم السجاد والموكيت | `photo-1616046229478-9901c5536a45` |
| `public/images/categories/curtains.webp` | قسم الستائر | `photo-1493663284031-b7e3aefcae8e` |
| `public/images/categories/mattresses.webp` | قسم المراتب والمفروشات | `photo-1617325247661-675ab4b64ae2` |
| `public/images/categories/blankets.webp` | قسم البطانيات واللحف | `photo-1629949009765-40fc74c9ec21` |
| `public/images/categories/sheets.webp` | قسم الشراشف | `photo-1595526114035-0d45ed16cfbf` |
| `public/images/categories/pillows.webp` | قسم المخدات | `photo-1579656381226-5fc0f0100c3b` |
| `public/images/categories/home-textiles.webp` | مفروشات منزلية متنوعة (والقسم الافتراضي) | `photo-1631679706909-1844bbd07221` |
| `src/app/opengraph-image.jpg`, `twitter-image.jpg` | صورة المشاركة على WhatsApp وFacebook | مركّبة من صورة الواجهة + اسم المحل |

رابط أي صورة: `https://images.unsplash.com/<المعرّف>`.
أسماء المصورين غير مطلوبة بموجب الرخصة، ويمكن إضافتها لاحقاً من صفحة كل صورة على Unsplash.
