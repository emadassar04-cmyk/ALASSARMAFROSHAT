"use client";
import Link from "next/link";
import { GitCompareArrows } from "lucide-react";
import { compare, MAX_COMPARE, useStore } from "@/lib/store/local-store";
import { useProducts } from "@/lib/store/use-catalog";
import { AVAILABILITY_LABEL, type ProductDetail } from "@/lib/catalog-types";
import { formatPrice } from "@/lib/format";
import { ProductImage } from "@/components/store/ProductImage";

export function CompareTable() {
  const { compare: list } = useStore();
  const products = useProducts(list.map((p) => p.slug));
  if (!list.length) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cream text-gold-ink"><GitCompareArrows aria-hidden="true" strokeWidth={1.4} className="h-7 w-7" /></span>
        <p className="mt-5 font-display text-xl">لا توجد منتجات للمقارنة</p>
        <p className="mt-2 text-sm text-muted-ink">أضف حتى {MAX_COMPARE} منتجات بالضغط على أيقونة المقارنة في بطاقة المنتج.</p>
        <Link href="/products" className="btn btn-primary mt-6">تصفح المنتجات</Link>
      </div>
    );
  }
  if (!products) return <div className="skeleton h-40 rounded-[var(--radius-card)]" aria-busy="true" />;

  const rows: [string, (p: ProductDetail) => React.ReactNode][] = [
    ["السعر", (p) => (p.requires_measurement ? "حسب المقاس" : formatPrice(p.price))],
    ["التوفر", (p) => AVAILABILITY_LABEL[p.availability]],
    ["التصنيف", (p) => p.category?.name ?? "—"],
    ["الخامة", (p) => p.materials.join("، ") || "—"],
    ["الخيارات", (p) => p.variants.map((v) => [v.color, v.size].filter(Boolean).join(" ")).filter(Boolean).join("، ") || "—"],
    ["مدة التجهيز", (p) => (p.prep_days_max !== null ? `${p.prep_days_max} يوم` : "—")],
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <thead>
          <tr>
            <th scope="col" className="w-32" />
            {products.map((p) => (
              <th key={p.id} scope="col" className="px-3 pb-5 align-top font-normal">
                <Link href={`/product/${encodeURIComponent(p.slug)}`} className="block space-y-3">
                  <ProductImage src={p.image?.url} alt={p.name} sizes="240px" className="aspect-[4/5] w-full rounded-[var(--radius-card)]" />
                  <span className="block font-medium text-charcoal">{p.name}</span>
                </Link>
                <button type="button" onClick={() => compare.toggle({ id: p.id, slug: p.slug })} className="mt-2 text-xs text-muted-ink underline-offset-4 hover:text-danger hover:underline">إزالة</button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, render]) => (
            <tr key={label}>
              <th scope="row" className="border-t border-border p-3 text-start font-medium text-muted-ink">{label}</th>
              {products.map((p) => <td key={p.id} className="border-t border-border p-3">{render(p)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={() => compare.clear()} className="btn btn-outline mt-6">مسح المقارنة</button>
    </div>
  );
}
