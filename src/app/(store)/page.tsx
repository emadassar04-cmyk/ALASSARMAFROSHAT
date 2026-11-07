import Link from "next/link";
import { Suspense } from "react";
import { getBestSellers, getCategories, searchProducts } from "@/lib/catalog";
import { ProductGrid, ProductGridSkeleton } from "@/components/store/ProductCard";
import type { SearchParams } from "@/lib/catalog-types";

async function CategoriesGrid() {
  const categories = (await getCategories()).filter((c) => !c.parent_id);
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {categories.map((c) => (
        <li key={c.id}>
          <Link href={`/category/${encodeURIComponent(c.slug)}`}
            className="flex h-full flex-col items-center justify-center gap-1 rounded-2xl border border-gold/20 bg-white p-4 text-center transition hover:border-gold hover:shadow-sm">
            <span className="font-medium">{c.name}</span>
            <span className="text-xs opacity-60">{c.product_count} منتج</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// قسم منتجات لا يظهر إن كان فارغاً (لا أقسام فارغة في الصفحة الرئيسية)
async function ProductSection({ title, params, href }: { title: string; params: SearchParams; href: string }) {
  const { items } = await searchProducts({ page_size: 8, ...params });
  if (!items.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 py-8" aria-labelledby={`s-${title}`}>
      <div className="mb-4 flex items-end justify-between">
        <h2 id={`s-${title}`} className="text-xl font-bold">{title}</h2>
        <Link href={href} className="text-sm text-gold-dark hover:underline">عرض الكل</Link>
      </div>
      <ProductGrid products={items} />
    </section>
  );
}

// يظهر فقط بعد وجود مبيعات مؤكدة فعلية
async function BestSellers() {
  const items = await getBestSellers(8);
  if (!items.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 py-8" aria-labelledby="s-best">
      <div className="mb-4 flex items-end justify-between">
        <h2 id="s-best" className="text-xl font-bold">الأكثر مبيعاً</h2>
        <Link href="/products?sort=best_selling" className="text-sm text-gold-dark hover:underline">عرض الكل</Link>
      </div>
      <ProductGrid products={items} />
    </section>
  );
}

async function EmptyCatalogNotice() {
  const { total } = await searchProducts({ page_size: 1 });
  if (total > 0) return null;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="rounded-2xl border border-dashed border-gold/40 bg-white p-8 text-center">
        نعمل على إضافة منتجاتنا إلى المتجر. تابعونا قريباً.
      </p>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <section className="bg-gradient-to-b from-beige to-background">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-14 text-center md:py-20">
          <p className="text-sm tracking-wide text-gold-dark">دير البلح – النصيرات</p>
          <h1 className="text-3xl font-bold leading-tight md:text-5xl">فخامة تليق ببيتك</h1>
          <p className="max-w-xl opacity-80">سجاد وموكيت، ستائر، مراتب، بطانيات، شراشف ومخدات بجودة عالية وأسعار مناسبة.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/products" className="rounded-full bg-gold px-6 py-3 font-medium text-white hover:bg-gold-dark">تسوّق الآن</Link>
            <Link href="/products?sort=best_selling" className="rounded-full border border-gold px-6 py-3 font-medium text-gold-dark hover:bg-white">الأكثر مبيعاً</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8" aria-labelledby="cats">
        <h2 id="cats" className="mb-4 text-xl font-bold">التصنيفات</h2>
        <Suspense fallback={<div className="h-24 animate-pulse rounded-2xl bg-white" />}><CategoriesGrid /></Suspense>
      </section>

      <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-8"><ProductGridSkeleton count={4} /></div>}>
        <EmptyCatalogNotice />
        <ProductSection title="منتجات مميزة" params={{ featured: true }} href="/products" />
        <ProductSection title="وصل حديثاً" params={{ sort: "newest" }} href="/products?sort=newest" />
        <BestSellers />
      </Suspense>
    </>
  );
}
