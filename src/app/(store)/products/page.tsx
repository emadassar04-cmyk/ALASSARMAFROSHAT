import type { Metadata } from "next";
import { Suspense } from "react";
import { ListingSkeleton, ProductListing } from "@/components/store/ProductListing";

export const metadata: Metadata = {
  title: "كل المنتجات",
  description: "تصفح كل منتجات مفروشات العصار: سجاد، ستائر، مراتب، بطانيات، شراشف ومخدات.",
  alternates: { canonical: "/products" },
};

export default function ProductsPage({ searchParams }: PageProps<"/products">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">كل المنتجات</h1>
      <Suspense fallback={<ListingSkeleton />}>
        <ProductListing searchParams={searchParams} base="/products" emptyText="لا توجد منتجات مطابقة حالياً." />
      </Suspense>
    </div>
  );
}
