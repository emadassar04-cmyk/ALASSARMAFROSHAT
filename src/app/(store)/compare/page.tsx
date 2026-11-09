import type { Metadata } from "next";
import { CompareTable } from "./CompareTable";
import { PageHeader } from "@/components/store/Breadcrumbs";

export const metadata: Metadata = { title: "مقارنة المنتجات", robots: { index: false } };

export default function ComparePage() {
  return (
    <>
      <PageHeader title="مقارنة المنتجات" intro="قارن حتى 3 منتجات جنباً إلى جنب: السعر والتوفر والخامة والمقاسات." />
      <div className="shell py-8 md:py-10"><CompareTable /></div>
    </>
  );
}
