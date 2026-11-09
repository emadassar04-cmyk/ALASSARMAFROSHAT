import { AVAILABILITY_LABEL, type Availability } from "@/lib/catalog-types";

// نقطة ملونة + نص (اللون ليس الوسيلة الوحيدة للمعنى)
const DOT: Record<Availability, string> = {
  in_stock: "bg-success",
  limited: "bg-warning",
  out_of_stock: "bg-muted",
  made_to_order: "bg-gold",
  coming_soon: "bg-gold",
  unavailable: "bg-muted",
};

export function AvailabilityBadge({ value }: { value: Availability }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.78rem] font-medium text-muted-ink">
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${DOT[value]}`} />
      {AVAILABILITY_LABEL[value]}
    </span>
  );
}
