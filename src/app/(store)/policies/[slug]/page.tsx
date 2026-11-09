import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCheckoutOptions, getPolicies } from "@/lib/catalog";
import type { PolicySlug } from "@/lib/catalog-types";
import { formatPrice } from "@/lib/format";
import { POLICY_PATHS } from "@/lib/site";
import { PolicyBody } from "@/components/store/PolicyBody";

const TITLES: Record<PolicySlug, string> = {
  delivery: "سياسة التوصيل",
  returns: "سياسة الاستبدال والإرجاع",
  privacy: "سياسة الخصوصية",
};

const isSlug = (s: string): s is PolicySlug => s in TITLES;

export function generateStaticParams() {
  return Object.keys(TITLES).map((slug) => ({ slug }));
}

async function load(params: Promise<{ slug: string }>) {
  const { slug } = await params;
  if (!isSlug(slug)) return null;
  const policy = (await getPolicies()).find((p) => p.slug === slug) ?? null;
  return { slug, policy };
}

export async function generateMetadata({ params }: PageProps<"/policies/[slug]">): Promise<Metadata> {
  const r = await load(params);
  if (!r) return { title: "صفحة غير موجودة" };
  const title = r.policy?.title ?? TITLES[r.slug];
  return {
    title,
    description: `${title} في مفروشات العصار – دير البلح والنصيرات.`,
    alternates: { canonical: POLICY_PATHS[r.slug] },
    // الصفحة غير المنشورة لا تُفهرس
    ...(!r.policy && { robots: { index: false, follow: true } }),
  };
}

// مناطق التوصيل ورسومها وطرق الدفع الفعلية من الإعدادات (تتحدث تلقائياً)
async function DeliveryFacts() {
  const { zones, methods } = await getCheckoutOptions();
  return (
    <section aria-labelledby="zones" className="mt-10 space-y-6">
      <div>
        <h2 id="zones" className="mb-3 text-lg font-bold">مناطق التوصيل ورسومها</h2>
        {zones.length ? (
          <div className="overflow-x-auto rounded-2xl border border-gold/20 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-beige/60 text-right">
                <tr><th scope="col" className="p-3">المنطقة</th><th scope="col" className="p-3">رسوم التوصيل</th><th scope="col" className="p-3">مدة التوصيل</th></tr>
              </thead>
              <tbody>
                {zones.map((z) => (
                  <tr key={z.id} className="border-t border-gold/10">
                    <td className="p-3">{z.name}</td>
                    <td className="p-3">{Number(z.fee) === 0 ? "مجاني" : formatPrice(z.fee)}</td>
                    <td className="p-3">{z.eta_text ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="opacity-70">سيتم إعلان مناطق التوصيل قريباً. للاستفسار تواصل معنا عبر WhatsApp.</p>}
      </div>
      {methods.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-bold">طرق الدفع</h2>
          <ul className="list-disc space-y-1 ps-6">{methods.map((m) => <li key={m.code}>{m.name_ar}</li>)}</ul>
        </div>
      )}
    </section>
  );
}

async function PolicyContent({ params }: { params: Promise<{ slug: string }> }) {
  const r = await load(params);
  if (!r) notFound();
  return (
    <article>
      <h1 className="mb-6 text-2xl font-bold">{r.policy?.title ?? TITLES[r.slug]}</h1>
      {r.policy ? (
        <>
          <PolicyBody text={r.policy.body} />
          <p className="mt-8 text-xs opacity-60">
            آخر تحديث: {new Date(r.policy.updated_at).toLocaleDateString("ar", { numberingSystem: "latn", timeZone: "Asia/Gaza", dateStyle: "long" })}
          </p>
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-gold/40 bg-white p-6 opacity-80">
          نعمل على إعداد هذه الصفحة. لأي استفسار تواصل معنا عبر WhatsApp.
        </p>
      )}
      {r.slug === "delivery" && <DeliveryFacts />}
    </article>
  );
}

export default function PolicyPage({ params }: PageProps<"/policies/[slug]">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-white" />}>
        <PolicyContent params={params} />
      </Suspense>
    </div>
  );
}
