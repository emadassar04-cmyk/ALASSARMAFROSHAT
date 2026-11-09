import { formatPrice } from "@/lib/format";

export function Price({ price, compareAt, requiresMeasurement, className = "", size = "md" }: {
  price: number | null;
  compareAt?: number | null;
  requiresMeasurement?: boolean;
  className?: string;
  size?: "md" | "lg";
}) {
  if (requiresMeasurement) return <span className={`text-sm font-medium text-gold-ink ${className}`}>السعر حسب المقاس</span>;
  if (price === null) return null;
  const big = size === "lg";
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 ${className}`}>
      <span className={`font-semibold tabular-nums text-charcoal ${big ? "text-[1.75rem]" : "text-[1.02rem]"}`}>{formatPrice(price)}</span>
      {compareAt && Number(compareAt) > Number(price) && (
        <s className={`tabular-nums text-muted-ink ${big ? "text-base" : "text-[0.8rem]"}`} aria-label={`السعر قبل الخصم ${formatPrice(compareAt)}`}>{formatPrice(compareAt)}</s>
      )}
    </span>
  );
}
