import { formatPrice } from "@/lib/format";

export function Price({ price, compareAt, requiresMeasurement, className = "" }: {
  price: number | null;
  compareAt?: number | null;
  requiresMeasurement?: boolean;
  className?: string;
}) {
  if (requiresMeasurement) return <span className={`text-sm text-gold-dark ${className}`}>السعر حسب المقاس</span>;
  if (price === null) return null;
  return (
    <span className={`inline-flex items-baseline gap-2 ${className}`}>
      <span className="font-bold">{formatPrice(price)}</span>
      {compareAt && Number(compareAt) > Number(price) && (
        <s className="text-sm opacity-50" aria-label={`السعر قبل الخصم ${formatPrice(compareAt)}`}>{formatPrice(compareAt)}</s>
      )}
    </span>
  );
}
