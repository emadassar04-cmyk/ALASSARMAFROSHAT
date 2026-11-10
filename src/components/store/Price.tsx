import { formatPrice } from "@/lib/format";

// السعر: وزن متوسط بأرقام متناسقة، والسعر قبل الخصم أخف وأصغر
export function Price({ price, compareAt, requiresMeasurement, className = "", size = "md", tone = "light" }: {
  price: number | null;
  compareAt?: number | null;
  requiresMeasurement?: boolean;
  className?: string;
  size?: "md" | "lg";
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  if (requiresMeasurement) return <span className={`text-sm font-medium ${dark ? "text-gold-light" : "text-gold-ink"} ${className}`}>السعر حسب المقاس</span>;
  if (price === null) return null;
  const big = size === "lg";
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2.5 ${className}`}>
      <span className={`font-medium tabular-nums ${dark ? "text-ivory" : "text-charcoal"} ${big ? "text-[1.875rem] font-normal tracking-tight" : "text-[1rem]"}`}>{formatPrice(price)}</span>
      {compareAt && Number(compareAt) > Number(price) && (
        <s className={`tabular-nums decoration-1 ${dark ? "text-on-dark-muted" : "text-muted-ink"} ${big ? "text-base" : "text-[0.8rem]"}`} aria-label={`السعر قبل الخصم ${formatPrice(compareAt)}`}>{formatPrice(compareAt)}</s>
      )}
    </span>
  );
}
