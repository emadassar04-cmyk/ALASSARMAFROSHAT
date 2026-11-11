import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, Ruler, ShieldCheck, Sparkles } from "lucide-react";
import { getCustomOptions, getStoreSettings } from "@/lib/catalog";
import { TYPES, type ProductType } from "@/lib/custom-order/spec";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { StudioLoader } from "./StudioLoader";

export const metadata: Metadata = {
  title: "فصّل منتجك على مقاسك",
  description: "اختر المنتج (ستائر، بطانة سقف، وجه فرشة، أو غيرها)، أدخل مقاساتك، وحدد الخامة واللون، وشاهد تصوراً ثلاثي الأبعاد لطلبك قبل إرساله إلى مفروشات العصار.",
  alternates: { canonical: "/special-order" },
};

// صور البطاقات: صور الأقسام الموجودة في المتجر، وصورة بطانة السقف من مجسم المعاينة نفسه (ليست صورة بطانية)
const CARD_IMAGES: Record<ProductType, string> = {
  curtains: "/images/categories/curtains.webp",
  ceiling: "/images/custom/ceiling.webp",
  mattress: "/images/categories/mattresses.webp",
  other: "/images/categories/home-textiles.webp",
};

async function StudioSection({ searchParams }: { searchParams: PageProps<"/special-order">["searchParams"] }) {
  const [{ type, product }, s, options] = await Promise.all([searchParams, getStoreSettings(), getCustomOptions().catch(() => undefined)]);
  const t = TYPES.find((x) => x.id === type)?.id;
  return <StudioLoader whatsapp={s.whatsapp_number} initialType={t} productHint={typeof product === "string" ? decodeURIComponent(product).slice(0, 80) : undefined} options={options} />;
}

export default function SpecialOrderPage({ searchParams }: PageProps<"/special-order">) {
  return (
    <>
      <section className="border-b border-border bg-champagne">
        <div className="shell pt-10 pb-14 md:pt-14 md:pb-20">
          <Breadcrumbs items={[{ name: "الرئيسية", href: "/" }, { name: "التفصيل حسب المقاس" }]} />
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-end">
            <div>
              <p className="kicker">استوديو التفصيل</p>
              <h1 className="mt-5 text-display font-light">فصّل منتجك{" "}<span className="font-medium text-gold-ink">على مقاسك</span></h1>
            </div>
            <p className="max-w-xl text-lead text-muted-ink">
              اختر المنتج، أدخل مقاساتك، وحدد الخامة واللون، وشاهد تصوراً لطلبك قبل إرساله إلى فريق مفروشات العصار.
            </p>
          </div>

          <ul className="mt-12 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {TYPES.map((t, i) => (
              <li key={t.id}>
                <Link href={`/special-order?type=${t.id}#studio`} scroll={false} className="group block h-full overflow-hidden rounded-[var(--radius-card)] border border-border bg-white shadow-soft transition-[transform,box-shadow] duration-500 hover:-translate-y-1 hover:shadow-lift">
                  <span className="relative block aspect-[4/3] overflow-hidden bg-surface-soft">
                    <Image src={CARD_IMAGES[t.id]} alt="" fill sizes="(min-width: 1024px) 25vw, 50vw" className="img-zoom object-cover" />
                    <span className="index-num absolute start-3 top-3 rounded-full bg-ivory/95 px-2.5 py-1">{String(i + 1).padStart(2, "0")}</span>
                  </span>
                  <span className="block p-4 sm:p-5">
                    <span className="block text-[1.1rem] font-medium text-charcoal sm:text-[1.25rem]">{t.title}</span>
                    <span className="mt-1 block text-[0.8125rem] leading-6 text-muted-ink">{t.short}</span>
                    <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-charcoal px-4 py-2 text-[0.8125rem] font-medium text-ivory transition-colors group-hover:bg-gold-ink">
                      ابدأ التفصيل<ArrowLeft aria-hidden="true" strokeWidth={1.5} className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="studio" aria-label="خطوات الطلب" className="shell scroll-mt-40 py-12 md:py-16">
        <Suspense fallback={<div className="skeleton h-96 rounded-[var(--radius-card)]" />}><StudioSection searchParams={searchParams} /></Suspense>
      </section>

      <section className="border-t border-border bg-surface">
        <ul className="shell grid gap-6 py-10 sm:grid-cols-3">
          {[
            { icon: Ruler, t: "مقاسات دقيقة", d: "كل قيمة تُحفظ مع وحدتها، ونراجعها معك قبل التنفيذ." },
            { icon: Sparkles, t: "معاينة قبل الطلب", d: "تصور ثلاثي الأبعاد يتغير مع مقاساتك وألوانك." },
            { icon: ShieldCheck, t: "سعر نهائي بعد المراجعة", d: "لا سعر تلقائي: يحدد فريقنا السعر ويؤكده معك." },
          ].map(({ icon: Icon, t, d }) => (
            <li key={t} className="flex gap-4">
              <Icon aria-hidden="true" strokeWidth={1.25} className="h-7 w-7 shrink-0 text-gold" />
              <span><span className="block font-medium">{t}</span><span className="text-sm text-muted-ink">{d}</span></span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
