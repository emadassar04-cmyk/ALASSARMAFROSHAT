// أجزاء لوحة المعلومات (تُعرض على الخادم، بلا JavaScript في المتصفح): مؤشر رئيسي، مؤشرات مدمجة، شريط مؤشرات، وحلقة توزيع الطلبات
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { change } from "@/lib/admin/finance";

// ألوان مقيدة: الذهب للمنحنى والإشارة فقط، والأسطح محايدة
const GOLD = "#b49a68", GOLD_LIGHT = "#d8c6a2";

// منحنى صغير: شكل الاتجاه فقط (القيمة الكاملة مكتوبة في البطاقة)
export function Sparkline({ values, color = GOLD, height = 34 }: { values: number[]; color?: string; height?: number }) {
  const W = 120, H = height;
  if (values.length < 2 || values.every((v) => v === 0)) return <div style={{ height }} aria-hidden="true" />;
  const max = Math.max(...values), min = Math.min(0, ...values);
  const x = (i: number) => (i * W) / (values.length - 1);
  const y = (v: number) => H - 3 - ((v - min) / (max - min || 1)) * (H - 6);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const id = `sp${color.slice(1)}${H}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height }} aria-hidden="true">
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.2} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
      <path d={`${d}L${W},${H}L0,${H}Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

type Change = { current?: number; previous?: number; good?: "up" | "down"; vsLabel: string; noChange: string };

// نسبة التغير مقارنة بالفترة السابقة: سهم + نسبة (اللون ليس الوسيلة الوحيدة: السهم والنص يحملان المعنى)
export function Delta({ current, previous, good = "up", vsLabel, noChange, dark = false }: Change & { dark?: boolean }) {
  const pct = current === undefined || previous === undefined ? null : change(current, previous);
  const dir = pct === null ? null : pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  const positive = dir === null || dir === "flat" ? null : dir === good;
  const Arrow = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  const tone = positive === null ? (dark ? "text-[#a9a497]" : "text-[var(--a-muted-ink)]")
    : positive ? (dark ? "text-[#9fd1b5]" : "text-[var(--a-success)]") : (dark ? "text-[#f0a594]" : "text-[var(--a-danger-ink)]");
  return (
    <span title={dir && dir !== "flat" ? vsLabel : undefined} className={`inline-flex shrink-0 items-center gap-0.5 text-xs font-medium tabular-nums ${tone}`}>
      {dir !== null && <Arrow aria-hidden="true" strokeWidth={1.75} className="h-3.5 w-3.5 rtl:-scale-x-100" />}
      {dir === null ? "—" : dir === "flat" ? noChange : `${Math.abs(pct!)}%`}
      {dir && dir !== "flat" && <span className="sr-only"> {vsLabel}</span>}
    </span>
  );
}

const lift = "transition-[box-shadow,transform,border-color] duration-300 hover:-translate-y-0.5 hover:shadow-[var(--a-shadow-lg)]";

// المؤشر الرئيسي: سطح فحمي هادئ، رقم كبير بوزن خفيف، ومنحنى ذهبي عريض
export function HeroKpi({ label, value, spark, href, caption, ...ch }: Change & { label: string; value: string; spark?: number[]; href: string; caption?: string }) {
  return (
    <Link href={href} className={`group relative flex h-full flex-col overflow-hidden rounded-[var(--a-radius)] bg-[var(--a-sidebar)] p-6 text-[#f7f6f2] shadow-[var(--a-shadow)] sm:p-7 ${lift}`}>
      <span aria-hidden="true" className="pointer-events-none absolute -end-16 -top-16 h-48 w-48 rounded-full border border-[#b49a68]/20" />
      <span aria-hidden="true" className="pointer-events-none absolute -end-6 -top-6 h-28 w-28 rounded-full border border-[#b49a68]/15" />
      <p className="text-[0.8125rem] font-medium tracking-[0.02em] text-[var(--a-accent-2)]">{label}</p>
      <p data-kpi-value className="mt-3 text-[clamp(2.1rem,1.6rem+1.6vw,2.9rem)] font-light leading-none tabular-nums tracking-tight">{value}</p>
      <div className="mt-3 flex items-center gap-2 text-xs text-[#a9a497]"><Delta {...ch} dark />{caption && <span>{caption}</span>}</div>
      <div className="mt-auto pt-6">{spark && <Sparkline values={spark} color={GOLD_LIGHT} height={72} />}</div>
    </Link>
  );
}

// مؤشر مدمج: سطح أبيض، أيقونة رفيعة، رقم واضح، ونسبة تغير ومنحنى صغير
export function KpiCard({ label, value, icon, spark, href, hint, ...ch }: Change & {
  label: string; value: string; icon: React.ReactNode; spark?: number[]; href?: string; hint?: React.ReactNode;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.8125rem] font-medium text-[var(--a-muted-ink)]">{label}</p>
        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--a-line)] text-[var(--a-accent-ink)]">{icon}</span>
      </div>
      <p data-kpi-value className="mt-2 text-[1.65rem] font-medium leading-tight tabular-nums tracking-tight">{value}</p>
      <div className="mt-3 flex items-end gap-3">
        <Delta {...ch} />
        <div className="min-w-0 flex-1">{spark && <Sparkline values={spark} />}</div>
      </div>
      {hint && <p className="mt-1.5 text-xs text-[var(--a-warning)]">{hint}</p>}
    </>
  );
  const cls = "a-card block p-5";
  return href ? <Link href={href} className={`${cls} ${lift}`}>{body}</Link> : <div className={cls}>{body}</div>;
}

// شريط مؤشرات ثانوية: بطاقة واحدة مقسومة بخطوط رفيعة بدل بطاقات متكررة
export function MetricStrip({ items, label }: { label: string; items: (Change & { key: string; label: string; value: string; href?: string; hint?: string; warn?: boolean })[] }) {
  return (
    <section aria-label={label} className="a-card grid grid-cols-2 overflow-hidden sm:grid-cols-3 xl:grid-cols-5">
      {items.map(({ key, label: l, value, href, hint, warn, ...ch }) => {
        const inner = (
          <>
            <p className="text-xs font-medium text-[var(--a-muted-ink)]">{l}</p>
            <p data-kpi-value className={`mt-1.5 text-[1.3rem] font-medium tabular-nums ${warn ? "text-[var(--a-warning)]" : ""}`}>{value}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2"><Delta {...ch} />{hint && <span className="text-xs text-[var(--a-warning)]">{hint}</span>}</div>
          </>
        );
        const cls = "block border-[var(--a-line)] p-5 [&:not(:last-child)]:border-e max-sm:[&:nth-child(2n)]:border-e-0 max-xl:sm:[&:nth-child(3n)]:border-e-0 max-xl:border-b";
        return href
          ? <Link key={key} href={href} className={`${cls} transition-colors hover:bg-[#faf9f5]`}>{inner}</Link>
          : <div key={key} className={cls}>{inner}</div>;
      })}
    </section>
  );
}

// حلقة توزيع الطلبات: كل قسم بلونه + النسبة مكتوبة بجانب كل اسم (اللون ليس الوسيلة الوحيدة)
export function Donut({ segments, total, unit, empty }: {
  segments: { key: string; label: string; value: number; color: string; href?: string }[]; total: number; unit: string; empty: string;
}) {
  const R = 52, C = 2 * Math.PI * R, GAP = segments.filter((s) => s.value > 0).length > 1 ? 2.5 : 0;
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
      <div className="relative h-44 w-44 shrink-0">
        <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" role="img" aria-label={`${total} ${unit}`}>
          <circle cx="64" cy="64" r={R} fill="none" stroke="#f1efe9" strokeWidth="12" />
          {total > 0 && segments.filter((s) => s.value > 0).map((s) => {
            const len = (s.value / total) * C;
            const el = <circle key={s.key} cx="64" cy="64" r={R} fill="none" stroke={s.color} strokeWidth="12"
              strokeDasharray={`${Math.max(0, len - GAP)} ${C}`} strokeDashoffset={-offset} />;
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div><p className="text-[2rem] font-light leading-none tabular-nums">{total}</p><p className="mt-1 text-xs text-[var(--a-muted-ink)]">{unit}</p></div>
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
