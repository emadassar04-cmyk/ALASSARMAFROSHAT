import Link from "next/link";
import type { ProductCard as Card } from "@/lib/catalog-types";
import { AvailabilityBadge } from "./AvailabilityBadge";
import { Price } from "./Price";
import { ProductImage } from "./ProductImage";
import { SaveButtons } from "./SaveButtons";

// نسبة الخصم محسوبة من السعرين الفعليين فقط
function discountPercent(p: Card) {
  if (p.requires_measurement || !p.price || !p.compare_at_price) return null;
  const pct = Math.round((1 - Number(p.price) / Number(p.compare_at_price)) * 100);
  return pct > 0 ? pct : null;
}

export function ProductCard({ product, priority = false }: { product: Card; priority?: boolean }) {
  const href = `/product/${encodeURIComponent(product.slug)}`;
  const off = discountPercent(product);
  return (
    <article className="reveal group relative flex flex-col">
      <div className="relative overflow-hidden rounded-[var(--radius-card)]">
        <ProductImage
          src={product.image?.url}
          alt={product.image?.alt ?? product.name}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px"
          priority={priority}
          className="aspect-[4/5] w-full"
          imgClassName="transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:scale-[1.04]"
        />
        {off && <span className="absolute top-3 right-3 rounded-full bg-charcoal px-2.5 py-1 text-[0.72rem] font-semibold text-warm-white">خصم {off}%</span>}
        <div className="absolute top-3 left-3">
          <SaveButtons product={{ id: product.id, slug: product.slug }} name={product.name} compact />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-0.5 pt-3.5">
        {product.category && <span className="text-[0.75rem] text-muted-ink">{product.category.name}</span>}
        <h3 className="line-clamp-2 font-sans text-[0.95rem] font-medium leading-snug text-charcoal">
          <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus:outline-none">{product.name}</Link>
        </h3>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-1">
          <Price price={product.price} compareAt={product.compare_at_price} requiresMeasurement={product.requires_measurement} />
          <AvailabilityBadge value={product.availability} />
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products, priorityCount = 0 }: { products: Card[]; priorityCount?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p, i) => <ProductCard key={p.id} product={p} priority={i < priorityCount} />)}
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4" aria-busy="true" aria-label="جارٍ التحميل">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <div className="skeleton aspect-[4/5] rounded-[var(--radius-card)]" />
          <div className="mt-3.5 space-y-2"><div className="skeleton h-3 w-1/3 rounded" /><div className="skeleton h-4 w-3/4 rounded" /><div className="skeleton h-4 w-1/4 rounded" /></div>
        </div>
      ))}
    </div>
  );
}
