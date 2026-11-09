import type { Metadata } from "next";
import { SavedList } from "./SavedList";
import { PageHeader } from "@/components/store/Breadcrumbs";

export const metadata: Metadata = { title: "المفضلة", robots: { index: false } };

export default function WishlistPage() {
  return (
    <>
      <PageHeader title="المفضلة" intro="المنتجات التي حفظتها على هذا الجهاز." />
      <div className="shell py-8 md:py-10"><SavedList /></div>
    </>
  );
}
