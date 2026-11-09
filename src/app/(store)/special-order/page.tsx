import type { Metadata } from "next";
import { Suspense } from "react";
import { getStoreSettings } from "@/lib/catalog";
import { SpecialOrderForm } from "./SpecialOrderForm";
import { PageHeader } from "@/components/store/Breadcrumbs";

export const metadata: Metadata = {
  title: "طلب منتج حسب المقاس",
  description: "أرسل مقاسات الستائر أو الموكيت أو أي منتج مفصّل، ونرد عليك بالسعر النهائي عبر WhatsApp.",
  alternates: { canonical: "/special-order" },
};

async function Form({ searchParams }: { searchParams: PageProps<"/special-order">["searchParams"] }) {
  const [{ product }, s] = await Promise.all([searchParams, getStoreSettings()]);
  return <SpecialOrderForm whatsapp={s.whatsapp_number} product={typeof product === "string" ? product : undefined} />;
}

export default function SpecialOrderPage({ searchParams }: PageProps<"/special-order">) {
  return (
    <>
      <PageHeader title="طلب منتج حسب المقاس" crumbs={[{ name: "الرئيسية", href: "/" }, { name: "طلب حسب المقاس" }]}
        intro="للستائر والموكيت والمنتجات المفصّلة: أرسل لنا المقاسات والمواصفات، ونحدد لك السعر النهائي عبر WhatsApp." />
      <div className="shell grid gap-10 py-10 lg:grid-cols-[1fr_20rem]">
        <Suspense fallback={<div className="skeleton h-80 rounded-[var(--radius-card)]" />}><Form searchParams={searchParams} /></Suspense>
        <ol className="h-fit space-y-5 text-sm leading-6 lg:sticky lg:top-28">
          {[
            ["أرسل المقاسات", "العرض والارتفاع أو الطول، والعدد واللون والخامة إن عرفتها."],
            ["نراجع طلبك", "يحدد فريقنا السعر النهائي حسب المقاسات والخامة المطلوبة."],
            ["نؤكد معك", "نرسل لك السعر عبر WhatsApp، ونبدأ التجهيز بعد موافقتك."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/50 font-semibold tabular-nums text-gold-ink">{i + 1}</span>
              <span><span className="block font-semibold text-charcoal">{t}</span><span className="text-muted-ink">{d}</span></span>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
