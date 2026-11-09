import type { Metadata } from "next";
import { Suspense } from "react";
import { getStoreSettings } from "@/lib/catalog";
import { CartView } from "./CartView";
import { PageHeader } from "@/components/store/Breadcrumbs";

export const metadata: Metadata = { title: "السلة", robots: { index: false } };

async function Cart() {
  const s = await getStoreSettings();
  return <CartView whatsapp={s.whatsapp_number} />;
}

export default function CartPage() {
  return (
    <>
      <PageHeader title="سلة التسوق" />
      <div className="shell py-8 md:py-10">
        <Suspense fallback={<div className="skeleton h-40 rounded-[var(--radius-card)]" />}><Cart /></Suspense>
      </div>
    </>
  );
}
