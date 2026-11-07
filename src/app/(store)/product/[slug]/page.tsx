import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getProduct, getStoreSettings } from "@/lib/catalog";
import { AVAILABILITY_LABEL } from "@/lib/catalog-types";
import { ProductGrid } from "@/components/store/ProductCard";
import { Gallery } from "./Gallery";
import { BuyBox } from "./BuyBox";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://alassarnumber1.vercel.app";

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
    openGraph: { title: p.name, description, type: "website", images: image ? [{ url: image }] : undefined },
  };
}

async function ProductContent({ params }: { params: Promise<{ slug: string }> }) {
  const [p, settings] = await Promise.all([load(params), getStoreSettings()]);
  if (!p) notFound();
  const url = `${SITE}/product/${encodeURIComponent(p.slug)}`;

  // بيانات منظمة لمحركات البحث (بلا سعر لمنتجات القياس)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description ?? undefined,
    image: p.media.filter((m) => m.kind === "image").map((m) => m.url),
    category: p.category?.name,
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="مسار التصفح" className="mb-4 text-sm opacity-70">
        <ol className="flex flex-wrap gap-1">
          <li><Link href="/" className="hover:underline">الرئيسية</Link> /</li>
          {p.breadcrumbs.map((b) => (
            <li key={b.slug}><Link href={`/category/${encodeURIComponent(b.slug)}`} className="hover:underline">{b.name}</Link> /</li>
          ))}
          <li aria-current="page">{p.name}</li>
        </ol>
      </nav>
      <div className="grid gap-8 md:grid-cols-2">
        <Gallery media={p.media} name={p.name} />
        <div className="space-y-5">
          <h1 className="text-2xl font-bold md:text-3xl">{p.name}</h1>
          <BuyBox product={p} whatsapp={settings.whatsapp_number} url={url} />
          <dl className="grid grid-cols-2 gap-2 rounded-2xl border border-gold/20 bg-white p-4 text-sm">
            <dt className="opacity-60">الحالة</dt><dd>{AVAILABILITY_LABEL[p.availability]}</dd>
            {p.unit && <><dt className="opacity-60">الوحدة</dt><dd>{p.unit}</dd></>}
            {p.materials.length > 0 && <><dt className="opacity-60">الخامة</dt><dd>{p.materials.join("، ")}</dd></>}
            {p.prep_days_max !== null && (
              <><dt className="opacity-60">مدة التجهيز</dt>
                <dd>{p.prep_days_min && p.prep_days_min !== p.prep_days_max ? `${p.prep_days_min}–${p.prep_days_max}` : p.prep_days_max} يوم</dd></>
            )}
          </dl>
          {p.description && (
            <section>
              <h2 className="mb-2 font-bold">الوصف</h2>
              <p className="whitespace-pre-line leading-relaxed opacity-90">{p.description}</p>
            </section>
          )}
        </div>
      </div>
      {p.related.length > 0 && (
        <section className="mt-12" aria-labelledby="related">
          <h2 id="related" className="mb-4 text-xl font-bold">منتجات مشابهة</h2>
          <ProductGrid products={p.related.slice(0, 4)} />
        </section>
      )}
    </>
  );
}

export default function ProductPage({ params }: PageProps<"/product/[slug]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Suspense fallback={<div className="grid gap-8 md:grid-cols-2"><div className="aspect-square animate-pulse rounded-2xl bg-beige" /><div className="h-64 animate-pulse rounded-2xl bg-white" /></div>}>
        <ProductContent params={params} />
      </Suspense>
    </div>
  );
}
