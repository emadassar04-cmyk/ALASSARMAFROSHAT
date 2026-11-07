import { AVAILABILITY_LABEL, type Availability } from "@/lib/catalog-types";

const STYLE: Record<Availability, string> = {
  in_stock: "bg-emerald-50 text-emerald-800",
  limited: "bg-amber-50 text-amber-800",
  out_of_stock: "bg-stone-100 text-stone-600",
  made_to_order: "bg-beige text-gold-dark",
  coming_soon: "bg-sky-50 text-sky-800",
  unavailable: "bg-stone-100 text-stone-600",
};

export function AvailabilityBadge({ value }: { value: Availability }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLE[value]}`}>{AVAILABILITY_LABEL[value]}</span>;
}
