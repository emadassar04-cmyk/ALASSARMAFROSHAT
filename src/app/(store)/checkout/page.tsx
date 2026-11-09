import type { Metadata } from "next";
import { Suspense } from "react";
import { getCheckoutOptions, getStoreSettings } from "@/lib/catalog";
import { CheckoutForm } from "./CheckoutForm";
import { PageHeader } from "@/components/store/Breadcrumbs";

export const metadata: Metadata = { title: "إتمام الطلب", robots: { index: false } };

async function Checkout() {
  const [{ zones, methods }, settings] = await Promise.all([getCheckoutOptions(), getStoreSettings()]);
  return <CheckoutForm zones={zones} methods={methods} whatsapp={settings.whatsapp_number} />;
}

export default function CheckoutPage() {
  return (
    <>
      <PageHeader title="إتمام الطلب" crumbs={[{ name: "السلة", href: "/cart" }, { name: "إتمام الطلب" }]} />
      <div className="shell py-8 md:py-10">
        <Suspense fallback={<div className="skeleton h-96 rounded-[var(--radius-card)]" />}><Checkout /></Suspense>
      </div>
    </>
  );
}
