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
      {/* رأس سينمائي للقسم: صورة القسم بعرض الشاشة مع تعتيم متدرج */}
      <section className="relative isolate overflow-hidden bg-charcoal">
        <Image src={categoryImage(c.name, c.image_url)} alt="" fill preload sizes="100vw" className="hero-zoom object-cover" />
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-l from-charcoal/85 via-charcoal/50 to-charcoal/15" />
        <div className="shell relative flex min-h-[18rem] flex-col justify-end py-10 md:min-h-[24rem] md:py-14">
          <Breadcrumbs tone="dark" items={[{ name: "الرئيسية", href: "/" }, { name: "كل المنتجات", href: "/products" }, { name: c.name }]} />
          <h1 className="mt-6 text-[clamp(2.2rem,1.6rem+2.6vw,3.9rem)] font-light leading-[1.15] text-ivory">{c.name}</h1>
          <p className="mt-4 max-w-xl leading-8 text-ivory/80">
            {c.description ?? `تسوّق ${c.name} من مفروشات العصار في دير البلح والنصيرات.`}
          </p>
        </div>
      </section>
      <div className="shell py-10 md:py-14">
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
