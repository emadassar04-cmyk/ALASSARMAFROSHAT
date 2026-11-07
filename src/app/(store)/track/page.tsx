import type { Metadata } from "next";
import { MyOrders } from "./MyOrders";

export const metadata: Metadata = { title: "طلباتي", robots: { index: false } };

export default function TrackPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">طلباتي</h1>
      <MyOrders />
    </div>
  );
}
