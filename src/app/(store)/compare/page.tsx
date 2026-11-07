import type { Metadata } from "next";
import { CompareTable } from "./CompareTable";

export const metadata: Metadata = { title: "مقارنة المنتجات", robots: { index: false } };

export default function ComparePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">مقارنة المنتجات</h1>
      <CompareTable />
    </div>
  );
}
