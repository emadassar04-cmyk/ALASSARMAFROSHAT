import type { Metadata } from "next";
import { Suspense } from "react";
import { ListingSkeleton, ProductListing } from "@/components/store/ProductListing";
import { PageHeader } from "@/components/store/Breadcrumbs";

export const metadata: Metadata = {
  title: "كل المنتجات",
  description: "تصفح كل منتجات مفروشات العصار: سجاد، ستائر، مراتب، بطانيات، شراشف ومخدات.",
  alternates: { canonical: "/products" },
};

export default function ProductsPage({ searchParams }: PageProps<"/products">) {
  return (
    <>
      <PageHeader title="كل المنتجات" crumbs={[{ name: "الرئيسية", href: "/" }, { name: "كل المنتجات" }]}
        intro="السجاد والموكيت، الستائر، المراتب، البطانيات واللحف، الشراشف والمخدات — كل منتجات المتجر في مكان واحد." />
      <div className="shell py-8 md:py-10">
        <Suspense fallback={<ListingSkeleton />}>
          <ProductListing searchParams={searchParams} base="/products" emptyText="لا توجد منتجات مطابقة حالياً." />
        </Suspense>
      </div>
    </>
  );
}
