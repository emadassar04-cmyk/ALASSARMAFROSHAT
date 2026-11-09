import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListingSkeleton, ProductListing } from "@/components/store/ProductListing";
import { getCategories, getStoreSettings } from "@/lib/catalog";
import Image from "next/image";
import { JsonLd, breadcrumbLd } from "@/components/store/JsonLd";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { categoryImage } from "@/lib/category-images";

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
    openGraph: { title: c.name, url: `/category/${encodeURIComponent(c.slug)}`, images: [{ url: categoryImage(c.name, c.image_url), alt: c.name }] },
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
      <div className="border-b border-border bg-cream/60">
        <div className="shell grid items-center gap-6 py-8 md:grid-cols-[1fr_auto] md:py-10">
          <div>
            <Breadcrumbs items={[{ name: "الرئيسية", href: "/" }, { name: "كل المنتجات", href: "/products" }, { name: c.name }]} />
            <h1 className="mt-4 text-title text-charcoal">{c.name}</h1>
            <p className="mt-3 max-w-2xl leading-7 text-muted-ink">
              {c.description ?? `تسوّق ${c.name} من مفروشات العصار في دير البلح والنصيرات.`}
            </p>
          </div>
          <div className="relative hidden aspect-[16/10] w-72 overflow-hidden rounded-[var(--radius-card)] md:block lg:w-80">
            <Image src={categoryImage(c.name, c.image_url)} alt="" fill sizes="320px" className="object-cover" />
          </div>
        </div>
      </div>
      <div className="shell py-8 md:py-10">
        <ProductListing searchParams={searchParams} base={`/category/${encodeURIComponent(c.slug)}`}
          overrides={{ category: c.slug }} emptyText={`لا توجد منتجات في «${c.name}» حالياً.`} />
      </div>
    </>
  );
}

export default function CategoryPage(props: PageProps<"/category/[slug]">) {
  return (
    <div>
      <Suspense fallback={<div className="shell py-10"><ListingSkeleton /></div>}><CategoryContent {...props} /></Suspense>
    </div>
  );
}
