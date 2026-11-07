import Link from "next/link";
import { getCategories, getFacets, searchProducts } from "@/lib/catalog";
import { parseSearchParams } from "@/lib/search-params";
import type { SearchParams } from "@/lib/catalog-types";
import { Filters } from "./Filters";
import { ProductGrid } from "./ProductCard";

type Raw = Record<string, string | string[] | undefined>;

// قائمة منتجات مع فلاتر وتقسيم صفحات (تُستخدم في كل المنتجات والتصنيف والبحث)
export async function ProductListing({ searchParams, base, overrides = {}, emptyText }: {
  searchParams: Promise<Raw>;
  base: string;
  overrides?: Partial<SearchParams>;
  emptyText: string;
}) {
  const raw = await searchParams;
  const params = parseSearchParams(raw, overrides);
  const [result, facets, categories] = await Promise.all([
    searchProducts(params),
    getFacets(params.category),
    getCategories(),
  ]);
  const pages = Math.max(1, Math.ceil(result.total / result.page_size));

  const pageHref = (page: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(raw)) if (typeof v === "string" && v && k !== "page") qs.set(k, v);
    if (page > 1) qs.set("page", String(page));
    const s = qs.toString();
    return s ? `${base}?${s}` : base;
  };

  return (
    <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
      <aside><Filters params={params} facets={facets} categories={categories} action={base} hideCategory={!!overrides.category} /></aside>
      <section aria-live="polite">
        <p className="mb-3 text-sm opacity-70">{result.total} منتج</p>
        {result.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gold/40 bg-white p-10 text-center">
            <p className="font-medium">{emptyText}</p>
            <Link href="/products" className="mt-3 inline-block text-sm text-gold-dark underline">تصفح كل المنتجات</Link>
          </div>
        ) : (
          <ProductGrid products={result.items} priorityCount={4} />
        )}
        {pages > 1 && (
          <nav aria-label="الصفحات" className="mt-8 flex flex-wrap justify-center gap-2">
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <Link key={n} href={pageHref(n)} aria-current={n === result.page ? "page" : undefined}
                className={`min-w-10 rounded-lg border px-3 py-2 text-center text-sm ${n === result.page ? "border-gold bg-gold text-white" : "border-gold/30 bg-white hover:bg-beige"}`}>
                {n}
              </Link>
            ))}
          </nav>
        )}
      </section>
    </div>
  );
}

export function ListingSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-[16rem_1fr]" aria-busy="true">
      <div className="h-96 animate-pulse rounded-2xl bg-white" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-white" />)}
      </div>
    </div>
  );
}
