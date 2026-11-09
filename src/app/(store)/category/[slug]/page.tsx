import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListingSkeleton, ProductListing } from "@/components/store/ProductListing";
import { getCategories, getStoreSettings } from "@/lib/catalog";
import { JsonLd, breadcrumbLd } from "@/components/store/JsonLd";

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
    openGraph: { title: c.name, url: `/category/${encodeURIComponent(c.slug)}`, images: c.image_url ? [{ url: c.image_url, alt: c.name }] : undefined },
  };
}

async function CategoryContent({ params, searchParams }: PageProps<"/category/[slug]">) {
  const [c, settings] = await Promise.all([findCategory(params), getStoreSettings()]);
  if (!c) notFound();
  return (
    <>
      <JsonLd data={breadcrumbLd(settings.site_url, [
        { name: "الرئيسية", path: "/" },
        { name: c.name, path: `/category/${encodeURIComponent(c.slug)}` },
      ])} />
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
