import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getProduct, getStoreSettings } from "@/lib/catalog";
import { AVAILABILITY_LABEL } from "@/lib/catalog-types";
import { ProductGrid } from "@/components/store/ProductCard";
import { JsonLd, breadcrumbLd } from "@/components/store/JsonLd";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { Gallery } from "./Gallery";
import { BuyBox } from "./BuyBox";

async function load(params: Promise<{ slug: string }>) {
  const { slug } = await params;
  return getProduct(decodeURIComponent(slug));
}

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const p = await load(params);
  if (!p) return { title: "منتج غير موجود" };
  const description = p.seo_description ?? p.description?.slice(0, 160) ?? `${p.name} من مفروشات العصار.`;
  const image = p.media.find((m) => m.kind === "image")?.url;
  return {
    title: p.seo_title ?? p.name,
    description,
    alternates: { canonical: `/product/${encodeURIComponent(p.slug)}` },
    openGraph: { title: p.name, description, type: "website", url: `/product/${encodeURIComponent(p.slug)}`, images: [{ url: image ?? "/opengraph-image.jpg", alt: p.name }] },
  };
}

async function ProductContent({ params }: { params: Promise<{ slug: string }> }) {
  const [p, settings] = await Promise.all([load(params), getStoreSettings()]);
  if (!p) notFound();
  const site = settings.site_url;
  const path = `/product/${encodeURIComponent(p.slug)}`;
  const url = `${site}${path}`;

  // بيانات منظمة لمحركات البحث (بلا سعر لمنتجات القياس)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description ?? undefined,
    image: p.media.filter((m) => m.kind === "image").map((m) => m.url),
    category: p.category?.name,
    url,
    brand: { "@type": "Brand", name: "مفروشات العصار" },
    ...(p.price !== null && !p.requires_measurement && {
      offers: {
        "@type": "Offer",
        priceCurrency: "ILS",
        price: p.price,
        url,
        availability: ["in_stock", "limited"].includes(p.availability) ? "https://schema.org/InStock"
          : p.availability === "made_to_order" ? "https://schema.org/PreOrder" : "https://schema.org/OutOfStock",
      },
    }),
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <JsonLd data={breadcrumbLd(site, [
        { name: "الرئيسية", path: "/" },
        ...p.breadcrumbs.map((b) => ({ name: b.name, path: `/category/${encodeURIComponent(b.slug)}` })),
        { name: p.name, path },
      ])} />
      <Breadcrumbs items={[
        { name: "الرئيسية", href: "/" },
        ...p.breadcrumbs.map((b) => ({ name: b.name, href: `/category/${encodeURIComponent(b.slug)}` })),
        { name: p.name },
      ]} />
      <div className="mt-6 grid gap-10 lg:mt-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16 xl:gap-20">
        <div className="lg:sticky lg:top-40 lg:self-start"><Gallery media={p.media} name={p.name} /></div>
        <div className="space-y-10">
          <div>
            {p.category && <Link href={`/category/${encodeURIComponent(p.category.slug)}`} className="kicker hover:text-charcoal">{p.category.name}</Link>}
            <h1 className="mt-4 text-[clamp(1.9rem,1.4rem+1.9vw,3rem)] font-light leading-[1.25]">{p.name}</h1>
          </div>
          <BuyBox product={p} whatsapp={settings.whatsapp_number} url={url} />
          {p.description && (
            <section aria-labelledby="desc" className="border-t border-border pt-8">
              <h2 id="desc" className="kicker mb-4">الوصف</h2>
              <p className="whitespace-pre-line text-[0.98rem] leading-8 text-muted-ink">{p.description}</p>
            </section>
          )}
          <section aria-labelledby="specs" className="border-t border-border pt-8">
            <h2 id="specs" className="kicker mb-4">المواصفات</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-8 text-sm">
              <dt className="border-b border-border py-3.5 text-muted-ink">الحالة</dt><dd className="border-b border-border py-3.5 text-end">{AVAILABILITY_LABEL[p.availability]}</dd>
              {p.category && <><dt className="border-b border-border py-3.5 text-muted-ink">القسم</dt><dd className="border-b border-border py-3.5 text-end">{p.category.name}</dd></>}
              {p.unit && <><dt className="border-b border-border py-3.5 text-muted-ink">الوحدة</dt><dd className="border-b border-border py-3.5 text-end">{p.unit}</dd></>}
              {p.materials.length > 0 && <><dt className="border-b border-border py-3.5 text-muted-ink">الخامة</dt><dd className="border-b border-border py-3.5 text-end">{p.materials.join("، ")}</dd></>}
              {p.prep_days_max !== null && (
                <><dt className="border-b border-border py-3.5 text-muted-ink">مدة التجهيز</dt>
                  <dd className="border-b border-border py-3.5 text-end">{p.prep_days_min && p.prep_days_min !== p.prep_days_max ? `${p.prep_days_min}–${p.prep_days_max}` : p.prep_days_max} يوم</dd></>
              )}
            </dl>
          </section>
        </div>
      </div>
      {p.related.length > 0 && (
        <section className="mt-28 border-t border-border pt-20" aria-labelledby="related">
          <p className="kicker">قد يعجبك أيضاً</p>
          <h2 id="related" className="mb-12 mt-4 text-title font-normal">منتجات مشابهة</h2>
          <ProductGrid products={p.related.slice(0, 4)} />
        </section>
      )}
    </>
  );
}

export default function ProductPage({ params }: PageProps<"/product/[slug]">) {
  return (
    <div className="shell py-6 md:py-10">
      <Suspense fallback={<div className="grid gap-10 lg:grid-cols-[7fr_5fr]"><div className="skeleton aspect-[4/5] rounded-[var(--radius-card)]" /><div className="space-y-4"><div className="skeleton h-10 w-2/3 rounded" /><div className="skeleton h-8 w-1/3 rounded" /><div className="skeleton h-40 rounded" /></div></div>}>
        <ProductContent params={params} />
      </Suspense>
    </div>
  );
}
