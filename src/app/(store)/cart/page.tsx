import type { Metadata } from "next";
import { Suspense } from "react";
import { getStoreSettings } from "@/lib/catalog";
import { CartView } from "./CartView";

export const metadata: Metadata = { title: "السلة", robots: { index: false } };

async function Cart() {
  const s = await getStoreSettings();
  return <CartView whatsapp={s.whatsapp_number} />;
}

export default function CartPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">سلة التسوق</h1>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-white" />}><Cart /></Suspense>
    </div>
  );
}
