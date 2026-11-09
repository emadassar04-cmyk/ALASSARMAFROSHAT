import type { Metadata } from "next";
import { MyOrders } from "./MyOrders";
import { PageHeader } from "@/components/store/Breadcrumbs";

export const metadata: Metadata = { title: "طلباتي", robots: { index: false } };

export default function TrackPage() {
  return (
    <>
      <PageHeader title="طلباتي" intro="الطلبات التي أرسلتها من هذا الجهاز. اضغط على الطلب لمتابعة حالته." />
      <div className="shell max-w-3xl py-8 md:py-10"><MyOrders /></div>
    </>
  );
}
