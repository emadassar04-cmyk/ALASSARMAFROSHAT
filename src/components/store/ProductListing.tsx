import Link from "next/link";
import { SlidersHorizontal, X } from "lucide-react";
import { getCategories, getFacets, searchProducts } from "@/lib/catalog";
import { parseSearchParams } from "@/lib/search-params";
import type { SearchParams } from "@/lib/catalog-types";
import { Filters } from "./Filters";
import { ProductGrid, ProductGridSkeleton } from "./ProductCard";

type Raw = Record<string, string | string[] | undefined>;

const SORT_LABEL: Record<string, string> = { newest: "الأحدث", price_asc: "السعر: من الأقل", price_desc: "السعر: من الأعلى", best_selling: "الأكثر مبيعاً" };

function countLabel(n: number) {
  if (n === 0) return "لا توجد منتجات";
  if (n === 1) return "منتج واحد";
  if (n === 2) return "منتجان";
  if (n <= 10) return `${n} منتجات`;
  return `${n} منتجاً`;
}

// قائمة منتجات مع فلاتر وتقسيم صفحات (كل المنتجات، التصنيف، البحث)
// الفلاتر نموذج GET عادي: تعمل دون JavaScript وتنتج روابط قابلة للمشاركة
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

  const href = (change: Record<string, string | null>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(raw)) if (typeof v === "string" && v && k !== "page") qs.set(k, v);
    for (const [k, v] of Object.entries(change)) { if (v === null) qs.delete(k); else qs.set(k, v); }
    const s = qs.toString();
    return s ? `${base}?${s}` : base;
  };

  // الفلاتر المطبقة كشارات قابلة للإزالة
  const catName = categories.find((c) => c.slug === params.category)?.name;
  const chips = [
    !overrides.category && catName && { label: catName, key: "category" },
    params.min_price !== undefined && { label: `من ${params.min_price} ₪`, key: "min" },
    params.max_price !== undefined && { label: `إلى ${params.max_price} ₪`, key: "max" },
    params.color && { label: `اللون: ${params.color}`, key: "color" },
    params.size && { label: `المقاس: ${params.size}`, key: "size" },
    params.material && { label: `الخامة: ${params.material}`, key: "material" },
    params.availability && { label: "المتوفر فقط", key: "available" },
    params.sort && SORT_LABEL[params.sort] && { label: SORT_LABEL[params.sort], key: "sort" },
  ].filter(Boolean) as { label: string; key: string }[];

  const filters = <Filters params={params} facets={facets} categories={categories} action={base} hideCategory={!!overrides.category} />;

  return (
    <div className="grid gap-8 lg:grid-cols-[15.5rem_1fr] lg:gap-14">
      <aside className="hidden lg:block">
        <div className="sticky top-40">{filters}</div>
      </aside>
      <section aria-live="polite" aria-labelledby="results-title" className="min-w-0">
        <h2 id="results-title" className="sr-only">المنتجات</h2>
        <details className="group mb-6 rounded-[var(--radius-card)] border border-border bg-white lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2"><SlidersHorizontal aria-hidden="true" strokeWidth={1.6} className="h-4 w-4" />تصفية وترتيب</span>
            <span className="text-muted-ink group-open:hidden">{chips.length ? `${chips.length} مفعّل` : "عرض"}</span>
            <span className="hidden text-muted-ink group-open:inline">إخفاء</span>
          </summary>
          <div className="border-t border-border p-4">{filters}</div>
        </details>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <p className="me-2 text-sm text-muted-ink">{countLabel(result.total)}</p>
          {chips.map((c) => (
            <Link key={c.key} href={href({ [c.key]: null })} aria-label={`إزالة الفلتر: ${c.label}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3.5 py-1.5 text-xs text-charcoal transition-colors hover:border-charcoal">
              {c.label}<X aria-hidden="true" strokeWidth={1.8} className="h-3 w-3" />
            </Link>
          ))}
        </div>

        {result.items.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-border bg-surface px-6 py-20 text-center">
            <p className="text-lg font-light text-charcoal">{emptyText}</p>
            <Link href="/products" className="btn btn-outline mt-5">تصفح كل المنتجات</Link>
          </div>
        ) : (
          <ProductGrid products={result.items} priorityCount={2} cols="grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 md:grid-cols-3 lg:gap-x-8" />
        )}
        {pages > 1 && (
          <nav aria-label="الصفحات" className="mt-12 flex flex-wrap justify-center gap-2">
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <Link key={n} href={href({ page: n > 1 ? String(n) : null })} aria-current={n === result.page ? "page" : undefined}
                className={`flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm tabular-nums transition-colors ${n === result.page ? "bg-charcoal text-ivory" : "border border-border bg-white hover:border-charcoal"}`}>
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
    <div className="grid gap-8 lg:grid-cols-[15.5rem_1fr] lg:gap-12" aria-busy="true">
      <div className="skeleton hidden h-96 rounded-[var(--radius-card)] lg:block" />
      <ProductGridSkeleton count={8} />
    </div>
  );
}
