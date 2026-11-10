// أجزاء لوحة المعلومات (تُعرض على الخادم، بلا JavaScript في المتصفح): بطاقة ملونة بمنحنى صغير، وحلقة توزيع الطلبات
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { change } from "@/lib/admin/finance";

export type Tone = "blue" | "pink" | "green" | "purple" | "orange";
// ألوان هادئة لكل بطاقة: خلفية فاتحة + لون الأيقونة والمنحنى (بتباين كافٍ للخط 2px على الأبيض)
const TONES: Record<Tone, { bg: string; icon: string; line: string }> = {
  blue: { bg: "from-[#f2f6fe] to-white", icon: "bg-[#e3ecfc] text-[#2f5fb3]", line: "#3d6fd1" },
  pink: { bg: "from-[#fdf2f4] to-white", icon: "bg-[#fbe2e7] text-[#b8344f]", line: "#d14763" },
  green: { bg: "from-[#eff8f3] to-white", icon: "bg-[#dcf1e5] text-[#16865b]", line: "#16865b" },
  purple: { bg: "from-[#f5f2fd] to-white", icon: "bg-[#e9e3fb] text-[#6142c2]", line: "#7254d6" },
  orange: { bg: "from-[#fdf6ec] to-white", icon: "bg-[#fbe9cf] text-[#a8691b]", line: "#c47f22" },
};

// منحنى صغير: شكل الاتجاه فقط (القيمة الكاملة مكتوبة في البطاقة)
export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const W = 120, H = 34;
  if (values.length < 2 || values.every((v) => v === 0)) return <div className="h-[34px]" aria-hidden="true" />;
  const max = Math.max(...values), min = Math.min(0, ...values);
  const x = (i: number) => (i * W) / (values.length - 1);
  const y = (v: number) => H - 3 - ((v - min) / (max - min || 1)) * (H - 6);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const id = `sp${color.slice(1)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[34px] w-full" aria-hidden="true">
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.22} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
      <path d={`${d}L${W},${H}L0,${H}Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function KpiCard({ label, value, current, previous, good = "up", icon, tone, spark, href, hint, vsLabel, noChange }: {
  label: string; value: string; current?: number; previous?: number; good?: "up" | "down"; icon: React.ReactNode; tone: Tone;
  spark?: number[]; href?: string; hint?: React.ReactNode; vsLabel: string; noChange: string;
}) {
  const c = TONES[tone];
  const pct = current === undefined || previous === undefined ? null : change(current, previous);
  const dir = pct === null ? null : pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  const positive = dir === null || dir === "flat" ? null : dir === good;
  const Arrow = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p data-kpi-value className="text-[1.65rem] font-bold leading-tight tabular-nums tracking-tight">{value}</p>
          <p className="mt-0.5 text-[0.8125rem] font-medium text-[var(--a-muted-ink)]">{label}</p>
        </div>
        <span aria-hidden="true" className={`grid h-11 w-11 shrink-0 place-items-center rounded-[12px] ${c.icon}`}>{icon}</span>
      </div>
      <div className="mt-3 flex items-end gap-3">
        <span title={dir && dir !== "flat" ? vsLabel : undefined}
          className={`inline-flex shrink-0 items-center gap-0.5 text-xs font-bold tabular-nums ${positive === null ? "text-[var(--a-muted-ink)]" : positive ? "text-[var(--a-success)]" : "text-[var(--a-danger-ink)]"}`}>
          {dir !== null && <Arrow aria-hidden="true" className="h-3.5 w-3.5 rtl:-scale-x-100" />}
          {dir === null ? "—" : dir === "flat" ? noChange : `${Math.abs(pct!)}%`}
          {dir && dir !== "flat" && <span className="sr-only"> {vsLabel}</span>}
        </span>
        <div className="min-w-0 flex-1">{spark && <Sparkline values={spark} color={c.line} />}</div>
      </div>
      {hint && <p className="mt-1.5 text-xs text-[var(--a-warning)]">{hint}</p>}
    </>
  );
  const cls = `block rounded-[16px] border border-[var(--a-line)] bg-gradient-to-b ${c.bg} p-4 shadow-[var(--a-shadow)] transition-[box-shadow,transform] duration-200`;
  return href ? <Link href={href} className={`${cls} hover:-translate-y-0.5 hover:shadow-[var(--a-shadow-lg)]`}>{body}</Link> : <div className={cls}>{body}</div>;
}

// حلقة توزيع الطلبات: كل قسم بلونه + النسبة مكتوبة بجانب كل اسم (اللون ليس الوسيلة الوحيدة)
export function Donut({ segments, total, unit, empty }: {
  segments: { key: string; label: string; value: number; color: string; href?: string }[]; total: number; unit: string; empty: string;
}) {
  const R = 52, C = 2 * Math.PI * R, GAP = segments.filter((s) => s.value > 0).length > 1 ? 3 : 0;
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
      <div className="relative h-44 w-44 shrink-0">
        <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" role="img" aria-label={`${total} ${unit}`}>
          <circle cx="64" cy="64" r={R} fill="none" stroke="#f1eee8" strokeWidth="16" />
          {total > 0 && segments.filter((s) => s.value > 0).map((s) => {
            const len = (s.value / total) * C;
            const el = <circle key={s.key} cx="64" cy="64" r={R} fill="none" stroke={s.color} strokeWidth="16"
              strokeDasharray={`${Math.max(0, len - GAP)} ${C}`} strokeDashoffset={-offset} />;
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div><p className="text-[1.75rem] font-bold leading-none tabular-nums">{total}</p><p className="mt-1 text-xs text-[var(--a-muted-ink)]">{unit}</p></div>
        </div>
      </div>
      {total === 0 ? <p className="text-sm text-[var(--a-muted-ink)]">{empty}</p> : (
        <ul className="w-full max-w-[13rem] space-y-3 text-sm">
          {segments.map((s) => {
            const row = (
              <>
                <span className="flex items-center gap-2"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.label}</span>
                <span className="tabular-nums"><b>{Math.round((s.value / total) * 100)}%</b> <span className="text-xs text-[var(--a-muted-ink)]">({s.value})</span></span>
              </>
            );
            return <li key={s.key}>{s.href ? <Link href={s.href} className="flex justify-between gap-3 hover:text-[var(--a-accent-ink)]">{row}</Link> : <div className="flex justify-between gap-3">{row}</div>}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
