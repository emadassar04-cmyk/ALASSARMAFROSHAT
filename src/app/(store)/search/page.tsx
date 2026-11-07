import type { Metadata } from "next";
import { Suspense } from "react";
import { ListingSkeleton, ProductListing } from "@/components/store/ProductListing";

export const metadata: Metadata = { title: "البحث", robots: { index: false, follow: true } };

async function Heading({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const { q } = await searchParams;
  const term = typeof q === "string" ? q.trim() : "";
  return <h1 className="mb-6 text-2xl font-bold">{term ? `نتائج البحث عن «${term}»` : "البحث"}</h1>;
}

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Suspense fallback={<h1 className="mb-6 text-2xl font-bold">البحث</h1>}><Heading searchParams={searchParams} /></Suspense>
      <Suspense fallback={<ListingSkeleton />}>
        <ProductListing searchParams={searchParams} base="/search" emptyText="لم نجد نتائج. جرّب كلمة أخرى مثل: سجاد، ستائر، مخدة." />
      </Suspense>
    </div>
  );
}
