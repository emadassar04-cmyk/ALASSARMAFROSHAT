import type { Metadata } from "next";
import { Suspense } from "react";
import { ListingSkeleton, ProductListing } from "@/components/store/ProductListing";
import { PageHeader } from "@/components/store/Breadcrumbs";

export const metadata: Metadata = { title: "البحث", robots: { index: false, follow: true } };

async function Heading({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const { q } = await searchParams;
  const term = typeof q === "string" ? q.trim() : "";
  return <PageHeader title={term ? `نتائج البحث عن «${term}»` : "البحث"} intro={term ? undefined : "اكتب اسم المنتج أو القسم في مربع البحث أعلى الصفحة."} />;
}

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <>
      <Suspense fallback={<PageHeader title="البحث" />}><Heading searchParams={searchParams} /></Suspense>
      <div className="shell py-8 md:py-10">
        <Suspense fallback={<ListingSkeleton />}>
          <ProductListing searchParams={searchParams} base="/search" emptyText="لم نجد نتائج. جرّب كلمة أخرى مثل: سجاد، ستائر، مخدة." />
        </Suspense>
      </div>
    </>
  );
}
