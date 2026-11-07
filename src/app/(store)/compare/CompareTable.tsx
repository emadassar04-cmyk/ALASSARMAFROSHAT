"use client";
import Link from "next/link";
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
      <div className="rounded-2xl border border-dashed border-gold/40 bg-white p-10 text-center">
        <p>أضف حتى {MAX_COMPARE} منتجات للمقارنة بالضغط على زر «قارن».</p>
        <Link href="/products" className="mt-4 inline-block text-gold-dark underline">تصفح المنتجات</Link>
      </div>
    );
  }
  if (!products) return <div className="h-40 animate-pulse rounded-2xl bg-white" aria-busy="true" />;

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
      <table className="w-full min-w-[36rem] border-separate border-spacing-2 text-sm">
        <thead>
          <tr>
            <th scope="col" className="w-28" />
            {products.map((p) => (
              <th key={p.id} scope="col" className="align-top font-normal">
                <Link href={`/product/${encodeURIComponent(p.slug)}`} className="block space-y-2">
                  <ProductImage src={p.image?.url} alt={p.name} sizes="200px" className="aspect-square w-full rounded-xl" />
                  <span className="block font-medium">{p.name}</span>
                </Link>
                <button type="button" onClick={() => compare.toggle({ id: p.id, slug: p.slug })} className="mt-1 text-xs text-red-700 hover:underline">إزالة</button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, render]) => (
            <tr key={label}>
              <th scope="row" className="rounded-lg bg-beige p-2 text-start font-medium">{label}</th>
              {products.map((p) => <td key={p.id} className="rounded-lg bg-white p-2">{render(p)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={() => compare.clear()} className="mt-4 text-sm underline">مسح المقارنة</button>
    </div>
  );
}
