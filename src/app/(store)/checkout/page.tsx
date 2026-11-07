import type { Metadata } from "next";
import { Suspense } from "react";
import { getCheckoutOptions, getStoreSettings } from "@/lib/catalog";
import { CheckoutForm } from "./CheckoutForm";

export const metadata: Metadata = { title: "إتمام الطلب", robots: { index: false } };

async function Checkout() {
  const [{ zones, methods }, settings] = await Promise.all([getCheckoutOptions(), getStoreSettings()]);
  return <CheckoutForm zones={zones} methods={methods} whatsapp={settings.whatsapp_number} />;
}

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">إتمام الطلب</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" />}><Checkout /></Suspense>
    </div>
  );
}
