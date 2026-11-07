import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListingSkeleton, ProductListing } from "@/components/store/ProductListing";
import { getCategories } from "@/lib/catalog";

async function findCategory(params: Promise<{ slug: string }>) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  return (await getCategories()).find((c) => c.slug === decoded) ?? null;
}

export async function generateMetadata({ params }: PageProps<"/category/[slug]">): Promise<Metadata> {
  const c = await findCategory(params);
  if (!c) return { title: "تصنيف غير موجود" };
  return {
    title: c.name,
    description: c.description ?? `تسوق ${c.name} من مفروشات العصار في دير البلح والنصيرات.`,
    alternates: { canonical: `/category/${encodeURIComponent(c.slug)}` },
  };
}

async function CategoryContent({ params, searchParams }: PageProps<"/category/[slug]">) {
  const c = await findCategory(params);
  if (!c) notFound();
  return (
    <>
      <h1 className="mb-2 text-2xl font-bold">{c.name}</h1>
      {c.description && <p className="mb-6 opacity-70">{c.description}</p>}
      <ProductListing searchParams={searchParams} base={`/category/${encodeURIComponent(c.slug)}`}
        overrides={{ category: c.slug }} emptyText={`لا توجد منتجات في «${c.name}» حالياً.`} />
    </>
  );
}

export default function CategoryPage(props: PageProps<"/category/[slug]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Suspense fallback={<ListingSkeleton />}><CategoryContent {...props} /></Suspense>
    </div>
  );
}
