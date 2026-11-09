import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Gift, Phone, ShoppingBag, Store } from "lucide-react";
import { getCampaign } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { PageHeader } from "@/components/store/Breadcrumbs";
import { PolicyBody } from "@/components/store/PolicyBody";
import { Countdown } from "@/components/store/Countdown";

export async function generateMetadata(): Promise<Metadata> {
  const { current } = await getCampaign();
  return {
    title: current?.title ?? "تسوّق واربح مع العصار",
    description: current ? `${current.title}: الجائزة ${current.prize}. اشترِ من المتجر الإلكتروني أو من فرعي دير البلح والنصيرات وادخل السحب.` : "حملات السحب الشهرية من مفروشات العصار.",
    alternates: { canonical: "/campaign" },
    ...(!current && { robots: { index: false, follow: true } }),
  };
}

const dateFmt = (iso: string) => new Date(iso).toLocaleDateString("ar", { numberingSystem: "latn", timeZone: "Asia/Gaza", dateStyle: "long" });

async function CampaignContent() {
  const { current, last_winner } = await getCampaign();
  if (!current) {
    return (
      <div className="space-y-6">
        <p className="rounded-[var(--radius-card)] border border-dashed border-gold/50 bg-white p-8 text-center text-muted-ink">
          لا توجد حملة سحب قائمة حالياً. تابعونا لمعرفة الحملة القادمة.
        </p>
        {last_winner && (
          <div className="panel p-6">
            <p className="kicker">الفائز السابق</p>
            <p className="mt-2 text-lg">{last_winner.title}: <strong>{last_winner.winner}</strong> — {last_winner.prize}</p>
            <p className="mt-1 text-sm text-muted-ink">أُجري السحب في {dateFmt(last_winner.drawn_at)}</p>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-8">
        <section aria-labelledby="prize" className="panel overflow-hidden">
          {current.prize_image_url && (
            // eslint-disable-next-line @next/next/no-img-element -- رابط صورة الجائزة يضيفه المدير (قد يكون من أي نطاق آمن)
            <img src={current.prize_image_url} alt={current.prize} loading="lazy" className="aspect-[16/9] w-full object-cover" />
          )}
          <div className="p-6">
            <p className="kicker"><Gift aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />الجائزة</p>
            <h2 id="prize" className="mt-2 text-title">{current.prize}</h2>
            {current.description && <p className="mt-3 leading-8 text-muted-ink">{current.description}</p>}
            <p className="mt-4 text-sm text-muted-ink">من {dateFmt(current.start_at)} إلى {dateFmt(current.end_at)}{current.min_amount ? ` · الحد الأدنى للشراء ${formatPrice(current.min_amount)}` : ""}</p>
            <div className="mt-5"><Countdown start={current.start_at} end={current.end_at} /></div>
            {current.entries > 0 && <p className="mt-3 text-sm text-muted-ink">{current.entries} مشاركة حتى الآن</p>}
          </div>
        </section>
        <section aria-labelledby="how">
          <h2 id="how" className="mb-4 text-xl">كيف أشارك؟</h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            {[
              [ShoppingBag, "اطلب من المتجر", "كل طلب يُسلَّم لك خلال فترة الحملة يمنحك مشاركة."],
              [Store, "أو اشترِ من الفرع", "أعطِ الموظف رقم جوالك عند الشراء من دير البلح أو النصيرات."],
              [Phone, "رقم واحد لكل مشترياتك", "نربط مشترياتك برقم جوالك، دون أي تسجيل إضافي."],
            ].map(([Icon, t, d]) => {
              const I = Icon as typeof Gift;
              return (
                <li key={t as string} className="panel p-5">
                  <I aria-hidden="true" strokeWidth={1.5} className="h-6 w-6 text-gold-ink" />
                  <p className="mt-3 font-medium">{t as string}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-ink">{d as string}</p>
                </li>
              );
            })}
          </ol>
        </section>
        <div className="flex flex-wrap gap-3">
          <Link href="/products" className="btn btn-primary">تسوّق الآن</Link>
          <Link href="/branches" className="btn btn-outline">فروعنا</Link>
        </div>
      </div>
      <aside aria-labelledby="terms" className="panel h-fit p-6 lg:sticky lg:top-28">
        <h2 id="terms" className="mb-4 font-sans text-base font-semibold">الشروط والأحكام</h2>
        <div className="text-sm"><PolicyBody text={current.terms} /></div>
        {last_winner && <p className="mt-6 border-t border-border pt-4 text-sm text-muted-ink">الفائز في الحملة السابقة: {last_winner.winner}</p>}
      </aside>
    </div>
  );
}

export default function CampaignPage() {
  return (
    <>
      <PageHeader title="تسوّق واربح مع العصار" crumbs={[{ name: "الرئيسية", href: "/" }, { name: "حملة السحب" }]}
        intro="حملة سحب شهرية لزبائن المتجر الإلكتروني والفرعين: مشترياتك برقم جوالك تمنحك فرصة للفوز." />
      <div className="shell py-8 md:py-10">
        <Suspense fallback={<div className="skeleton h-96 rounded-[var(--radius-card)]" />}><CampaignContent /></Suspense>
      </div>
    </>
  );
}
