"use client";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { readMyOrders } from "@/lib/store/my-orders";

const subscribe = () => () => {};
let snapshot: ReturnType<typeof readMyOrders> | null = null;
const read = () => (snapshot ??= readMyOrders());

export function MyOrders() {
  const orders = useSyncExternalStore(subscribe, read, () => []);
  if (!orders.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gold/40 bg-white p-8 text-center text-sm">
        <p>لا توجد طلبات محفوظة على هذا الجهاز.</p>
        <p className="mt-2 opacity-70">إن أرسلت طلباً من جهاز آخر، افتح رابط الطلب الذي ظهر لك بعد الإرسال، أو تواصل معنا عبر WhatsApp برقم الطلب.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {orders.map((o) => (
        <li key={o.number}>
          <Link href={`/order/${encodeURIComponent(o.number)}?t=${o.token}`}
            className="flex justify-between rounded-xl border border-gold/20 bg-white p-4 hover:border-gold">
            <span dir="ltr" className="font-medium">{o.number}</span>
            <span className="text-sm opacity-70">{new Date(o.at).toLocaleDateString("ar", { numberingSystem: "latn" })}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
