import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import type { PolicySlug } from "@/lib/catalog-types";
import { POLICY_PATHS } from "@/lib/site";
import { MarketingForm, PolicyForm } from "./Forms";

export const instant = false;

export default async function MarketingSettings() {
  await requireStaff();
  const supabase = await createClient();
  const [{ data: policies }, { data: settings }] = await Promise.all([
    supabase.from("store_policies").select("slug, title, body, is_published"),
    supabase.from("store_settings").select("site_url, is_published, ga_measurement_id, meta_pixel_id, google_site_verification").single(),
  ]);
  const order: PolicySlug[] = ["delivery", "returns", "privacy"];
  const list = order.map((s) => (policies ?? []).find((p) => p.slug === s)).filter((p) => !!p);
  const site = settings?.site_url ?? "";

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <h1 className="text-2xl font-bold">التسويق والسياسات</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">صفحات السياسات</h2>
        <p className="text-sm opacity-70">
          لا تظهر الصفحة للزبائن إلا بعد تفعيل «منشورة». يمكنك البدء من مسودة مقترحة، لكن كل ما بين [ ] قرار يخص المحل
          ويجب أن تكتبه بنفسك — لن يقبل النظام النشر قبل ذلك. صفحة التوصيل تعرض تلقائياً مناطق التوصيل ورسومها وطرق الدفع.
        </p>
        {list.map((p) => (
          <PolicyForm key={p.slug} slug={p.slug as PolicySlug} path={POLICY_PATHS[p.slug as PolicySlug]} title={p.title} body={p.body} published={p.is_published} />
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">أدوات القياس والإعلانات</h2>
        <MarketingForm ga={settings?.ga_measurement_id ?? null} pixel={settings?.meta_pixel_id ?? null} verification={settings?.google_site_verification ?? null} />
      </section>

      <section className="space-y-2 rounded-2xl border border-gold/20 bg-white p-5 text-sm">
        <h2 className="text-lg font-bold">محركات البحث</h2>
        <p>خريطة الموقع: <a href={`${site}/sitemap.xml`} target="_blank" rel="noreferrer" dir="ltr" className="text-gold-dark underline">{site}/sitemap.xml</a></p>
        <p>
          حالة الفهرسة: {settings?.is_published
            ? "المتجر منشور — محركات البحث مسموح لها بأرشفة صفحات المتجر (عدا الإدارة والسلة والطلبات)."
            : "المتجر غير منشور بعد — محركات البحث ممنوعة من الأرشفة حتى لا يظهر متجر فارغ في Google."}
        </p>
        <p className="opacity-70">بعد النشر: أضف رابط خريطة الموقع في Google Search Console ← Sitemaps.</p>
      </section>
    </div>
  );
}
