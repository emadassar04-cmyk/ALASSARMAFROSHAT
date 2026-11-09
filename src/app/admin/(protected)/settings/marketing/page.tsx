import { Suspense } from "react";
import { PageSkeleton } from "@/components/admin/PageSkeleton";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import type { PolicySlug } from "@/lib/catalog-types";
import { POLICY_PATHS } from "@/lib/site";
import { getDict } from "@/lib/admin/i18n";
import { Card, PageHeader } from "@/components/admin/ui";
import { MarketingForm, PolicyForm } from "./Forms";

export const instant = false;

async function MarketingSettingsContent() {
  const staff = await requireStaff();
  const t = getDict(staff.locale), S = t.set;
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
      <PageHeader title={S.marketingTitle} />
      <section className="space-y-3">
        <h2 className="text-lg">{S.policies}</h2>
        <p className="text-sm leading-6 text-[var(--a-muted-ink)]">{S.policiesHint}</p>
        {list.map((p) => (
          <PolicyForm key={p.slug} slug={p.slug as PolicySlug} path={POLICY_PATHS[p.slug as PolicySlug]} title={p.title} body={p.body} published={p.is_published} />
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg">{S.tracking}</h2>
        <MarketingForm ga={settings?.ga_measurement_id ?? null} pixel={settings?.meta_pixel_id ?? null} verification={settings?.google_site_verification ?? null} />
      </section>
      <Card title={S.seo}>
        <div className="space-y-2 text-sm">
          <p>{S.sitemap}: <a href={`${site}/sitemap.xml`} target="_blank" rel="noreferrer" dir="ltr" className="text-[var(--a-accent-ink)] underline">{site}/sitemap.xml</a></p>
          <p>{S.indexing}: {settings?.is_published ? S.indexed : S.notIndexed}</p>
          <p className="text-[var(--a-muted-ink)]">{S.afterPublish}</p>
        </div>
      </Card>
    </div>
  );
}

// الصفحة تُعرض فوراً بهيكل تحميل، ثم يتدفق المحتوى (تنقل سلس دون انتظار الخادم)
export default function MarketingSettings() {
  return <Suspense fallback={<PageSkeleton variant="form" />}><MarketingSettingsContent /></Suspense>;
}
