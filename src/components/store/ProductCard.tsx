import Link from "next/link";
import type { ProductCard as Card } from "@/lib/catalog-types";
import { AvailabilityBadge } from "./AvailabilityBadge";
import { Price } from "./Price";
import { ProductImage } from "./ProductImage";
import { SaveButtons } from "./SaveButtons";

export function ProductCard({ product, priority = false }: { product: Card; priority?: boolean }) {
  const href = `/product/${encodeURIComponent(product.slug)}`;
  const onSale = product.compare_at_price && product.price && Number(product.compare_at_price) > Number(product.price);
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-gold/20 bg-white transition hover:shadow-md">
      <Link href={href} className="block">
        <ProductImage
          src={product.image?.url}
          alt={product.image?.alt ?? product.name}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          priority={priority}
          className="aspect-square w-full"
        />
      </Link>
      {onSale && <span className="absolute top-3 right-3 rounded-full bg-gold px-2 py-0.5 text-xs text-white">خصم</span>}
      <div className="absolute top-2 left-2">
        <SaveButtons product={{ id: product.id, slug: product.slug }} name={product.name} compact />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        {product.category && <span className="text-xs opacity-60">{product.category.name}</span>}
        <h3 className="line-clamp-2 font-medium leading-snug">
          <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus:outline-none">{product.name}</Link>
        </h3>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          <Price price={product.price} compareAt={product.compare_at_price} requiresMeasurement={product.requires_measurement} />
          <AvailabilityBadge value={product.availability} />
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products, priorityCount = 0 }: { products: Card[]; priorityCount?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p, i) => <ProductCard key={p.id} product={p} priority={i < priorityCount} />)}
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4" aria-busy="true" aria-label="جارٍ التحميل">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-gold/10 bg-white">
          <div className="aspect-square bg-beige" />
          <div className="space-y-2 p-3"><div className="h-4 w-3/4 rounded bg-beige" /><div className="h-4 w-1/3 rounded bg-beige" /></div>
        </div>
      ))}
    </div>
  );
}
