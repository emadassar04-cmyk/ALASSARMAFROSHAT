import Link from "next/link";
import type { ProductCard as Card } from "@/lib/catalog-types";
import { AvailabilityBadge } from "./AvailabilityBadge";
import { Price } from "./Price";
import { ProductImage } from "./ProductImage";
import { SaveButtons } from "./SaveButtons";
import { QuickAdd } from "./QuickAdd";
import { QuickViewButton } from "./QuickView";
import { isPurchasable } from "@/lib/catalog-types";

// نسبة الخصم محسوبة من السعرين الفعليين فقط
function discountPercent(p: Card) {
  if (p.requires_measurement || !p.price || !p.compare_at_price) return null;
  const pct = Math.round((1 - Number(p.price) / Number(p.compare_at_price)) * 100);
  return pct > 0 ? pct : null;
}

// بطاقة كتالوج: صورة كبيرة بنسبة ثابتة 4:5، ومعلومات قليلة، وأزرار تظهر بهدوء عند المرور
// (في الأجهزة اللمسية تبقى ظاهرة دائماً، ومع لوحة المفاتيح تظهر عند التركيز).
// tone="dark": للأقسام الداكنة. rank: رقم ترتيب تحريري (الأكثر مبيعاً).
export function ProductCard({ product, priority = false, tone = "light", rank, sizes }: {
  product: Card; priority?: boolean; tone?: "light" | "dark"; rank?: number; sizes?: string;
}) {
  const href = `/product/${encodeURIComponent(product.slug)}`;
  const off = discountPercent(product);
  const dark = tone === "dark";
  const canAdd = product.quick_variant_id && product.price !== null && isPurchasable(product.availability);
  return (
    <article className="reveal group relative flex flex-col">
      <div className={`relative overflow-hidden rounded-[var(--radius-card)] ${dark ? "bg-white/5" : "bg-surface-soft"}`}>
        <ProductImage
          src={product.image?.url}
          alt={product.image?.alt ?? product.name}
          sizes={sizes ?? "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 320px"}
          priority={priority}
          className="aspect-[4/5] w-full"
          imgClassName="img-zoom"
        />
        {/* لمسة ظل خفيفة أسفل الصورة تُبرز الأزرار عند ظهورها */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-charcoal/25 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <div className="absolute top-3 start-3 flex flex-col items-start gap-1.5">
          {rank !== undefined && <span className="index-num rounded-full bg-ivory/95 px-2.5 py-1 backdrop-blur">{String(rank).padStart(2, "0")}</span>}
          {off && <span className="rounded-full bg-ivory/95 px-2.5 py-1 text-[0.72rem] font-medium tabular-nums text-gold-ink backdrop-blur">خصم {off}%</span>}
        </div>
        <div className="absolute top-3 end-3">
          <SaveButtons product={{ id: product.id, slug: product.slug }} name={product.name} compact />
        </div>
        <div className="absolute inset-x-3 bottom-3 z-10 flex items-center justify-center gap-2 transition-[opacity,transform] duration-500 ease-[var(--ease-luxe)] [@media(hover:hover)]:translate-y-3 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:translate-y-0 [@media(hover:hover)]:group-focus-within:opacity-100">
          <QuickViewButton product={product} />
          {canAdd && <QuickAdd variantId={product.quick_variant_id!} productId={product.id} name={product.name} price={product.price} />}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 px-0.5 pt-4">
        {product.category && <span className={`text-[0.75rem] tracking-[0.02em] ${dark ? "text-on-dark-muted" : "text-muted-ink"}`}>{product.category.name}</span>}
        <h3 className={`line-clamp-2 text-[0.98rem] font-normal leading-snug ${dark ? "text-ivory" : "text-charcoal"}`}>
          <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus:outline-none">{product.name}</Link>
        </h3>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-2">
          <Price price={product.price} compareAt={product.compare_at_price} requiresMeasurement={product.requires_measurement} tone={tone} />
          {!dark && <AvailabilityBadge value={product.availability} />}
        </div>
      </div>
    </article>
  );
}

const GRID = "grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-8";

export function ProductGrid({ products, priorityCount = 0, cols }: { products: Card[]; priorityCount?: number; cols?: string }) {
  return (
    <div className={cols ?? GRID}>
      {products.map((p, i) => <ProductCard key={p.id} product={p} priority={i < priorityCount} />)}
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className={GRID} aria-busy="true" aria-label="جارٍ التحميل">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <div className="skeleton aspect-[4/5] rounded-[var(--radius-card)]" />
          <div className="mt-4 space-y-2.5"><div className="skeleton h-3 w-1/3 rounded-full" /><div className="skeleton h-4 w-3/4 rounded-full" /><div className="skeleton h-4 w-1/4 rounded-full" /></div>
        </div>
      ))}
    </div>
  );
}
