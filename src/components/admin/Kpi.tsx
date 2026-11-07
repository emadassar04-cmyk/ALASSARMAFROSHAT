import { formatPrice } from "@/lib/format";
import { change } from "@/lib/admin/finance";

// بطاقة مؤشر: القيمة + التغير عن الفترة السابقة (نص ورمز، لا لون فقط)
export function Kpi({ label, value, previous, money = true, hint, tone }: {
  label: string; value: number; previous?: number; money?: boolean; hint?: string; tone?: "warn";
}) {
  const pct = previous === undefined ? null : change(Number(value), Number(previous));
  return (
    <div className={`rounded-2xl border bg-white p-4 ${tone === "warn" ? "border-amber-300" : "border-gold/20"}`}>
      <p className="text-sm opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold">{money ? formatPrice(value) : Number(value).toLocaleString("ar", { numberingSystem: "latn" })}</p>
      {pct !== null && (
        <p className="mt-1 text-xs opacity-70">
          {pct > 0 ? "▲" : pct < 0 ? "▼" : "■"} {Math.abs(pct)}% عن الفترة السابقة
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-amber-800">{hint}</p>}
    </div>
  );
}
