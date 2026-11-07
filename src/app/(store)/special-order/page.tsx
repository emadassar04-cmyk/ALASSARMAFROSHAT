import type { Metadata } from "next";
import { Suspense } from "react";
import { getStoreSettings } from "@/lib/catalog";
import { SpecialOrderForm } from "./SpecialOrderForm";

export const metadata: Metadata = {
  title: "طلب منتج حسب المقاس",
  description: "أرسل مقاسات الستائر أو الموكيت أو أي منتج مفصّل، ونرد عليك بالسعر النهائي عبر WhatsApp.",
};

async function Form({ searchParams }: { searchParams: PageProps<"/special-order">["searchParams"] }) {
  const [{ product }, s] = await Promise.all([searchParams, getStoreSettings()]);
  return <SpecialOrderForm whatsapp={s.whatsapp_number} product={typeof product === "string" ? product : undefined} />;
}

export default function SpecialOrderPage({ searchParams }: PageProps<"/special-order">) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">طلب منتج حسب المقاس</h1>
      <p className="mb-6 opacity-70">للستائر والموكيت والمنتجات المفصّلة: أرسل لنا المقاسات والمواصفات، ونحدد لك السعر النهائي عبر WhatsApp.</p>
      <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-white" />}><Form searchParams={searchParams} /></Suspense>
    </div>
  );
}
