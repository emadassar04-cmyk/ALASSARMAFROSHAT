// مكونات واجهة الإدارة المشتركة (تعمل على الخادم): رأس الصفحة، البطاقات، الشارات، الترقيم، الفترات
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Minus } from "lucide-react";
import type { Dict } from "@/lib/admin/dict/ar";
import { fill, type Fmt } from "@/lib/admin/i18n";
import { change, type Preset } from "@/lib/admin/finance";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0 max-w-full">
        <h1 className="text-[1.7rem] font-light leading-tight sm:text-[2rem]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-[var(--a-muted-ink)]">{subtitle}</p>}
      </div>
      {actions && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, action, children, className = "", bodyClass = "p-5" }: {
  title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; bodyClass?: string;
}) {
  return (
    <section className={`a-card ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--a-line)] px-5 py-4">
          {title && <h2 className="shrink-0 whitespace-nowrap text-[0.95rem] font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

// بطاقة مؤشر: القيمة الفعلية + نسبة التغير (سهم + نص، لا لون فقط) + رابط التفاصيل
export function StatCard({ label, value, current, previous, good = "up", icon, href, hint, t, f, tone }: {
  label: string; value: string; current?: number; previous?: number; good?: "up" | "down"; icon: React.ReactNode;
  href?: string; hint?: React.ReactNode; t: Dict; f: Fmt; tone?: "warn";
}) {
  const pct = current === undefined || previous === undefined ? null : change(current, previous);
  const dir = pct === null ? null : pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  const positive = dir === "flat" || dir === null ? null : dir === good;
  const Arrow = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.8125rem] font-medium text-[var(--a-muted-ink)]">{label}</p>
        <span aria-hidden="true" className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border ${tone === "warn" ? "border-[#ecd9b8] text-[var(--a-warning)]" : "border-[var(--a-line)] text-[var(--a-accent-ink)]"}`}>{icon}</span>
      </div>
      <p data-kpi-value className="mt-1 text-[1.6rem] font-medium leading-tight tabular-nums tracking-tight">{value}</p>
      <div className="mt-2 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {dir !== null ? (
          <span className={`inline-flex items-center gap-0.5 font-medium tabular-nums ${positive === null ? "text-[var(--a-muted-ink)]" : positive ? "text-[var(--a-success)]" : "text-[var(--a-danger-ink)]"}`}>
            <Arrow aria-hidden="true" strokeWidth={1.75} className="h-3.5 w-3.5 rtl:-scale-x-100" />
            {dir === "flat" ? t.common.noChange : `${f.number(Math.abs(pct!))}%`}
          </span>
        ) : previous !== undefined ? <span className="text-[var(--a-muted-ink)]">{t.common.none}</span> : null}
        {dir !== null && dir !== "flat" && <span className="text-[var(--a-muted-ink)]">{t.common.vsPrevious}</span>}
        {hint && <span className={`w-full ${tone === "warn" ? "text-[var(--a-warning)]" : "text-[var(--a-muted-ink)]"}`}>{hint}</span>}
      </div>
    </>
  );
  const cls = `a-card block p-5 transition-[box-shadow,border-color,transform] duration-300 ${tone === "warn" ? "border-[#ecd9b8]" : ""}`;
  return href ? <Link href={href} className={`${cls} hover:-translate-y-0.5 hover:shadow-[var(--a-shadow-lg)]`}>{body}</Link> : <div className={cls}>{body}</div>;
}

// ألوان الحالات: درجات هادئة متقاربة مع الهوية (كل نص ≥ 4.5:1 على خلفيته)
const SLATE = "border-[#dfe3e8] bg-[#f4f6f8] text-[#46566a]", GOLD = "border-[#e8dcc4] bg-[#f7f2e8] text-[#6f5a33]",
  AMBER = "border-[#ecdcbf] bg-[#faf4e8] text-[#7a5418]", PLUM = "border-[#e3dde8] bg-[#f6f3f8] text-[#5a4a6e]",
  GREEN = "border-[#d5e5db] bg-[#f0f6f2] text-[#2a5e44]", RED = "border-[#efd5cf] bg-[#fbf2f0] text-[#8f3626]",
  GRAY = "border-[#e5e3dd] bg-[#f5f4f1] text-[#5e5b54]";
const STATUS_TONE: Record<string, string> = {
  received: SLATE, awaiting_confirmation: SLATE, confirmed: GOLD, preparing: AMBER, ready_for_pickup: PLUM,
  out_for_delivery: PLUM, delivered: GREEN, cancelled: GRAY, paid: GREEN, unpaid: GRAY, awaiting_review: AMBER,
  rejected: RED, refunded: GRAY, submitted: AMBER, approved: GREEN, voided: GRAY,
};
// شارة حالة: نص + نقطة (اللون ليس الوسيلة الوحيدة)
export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-[0.2rem] text-xs font-medium ${STATUS_TONE[status] ?? GRAY}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />{label}
    </span>
  );
}

export function EmptyState({ icon, title, children }: { icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon && <span aria-hidden="true" className="mb-2 grid h-12 w-12 place-items-center rounded-full border border-[var(--a-line)] text-[var(--a-accent-ink)]">{icon}</span>}
      <p className="font-medium">{title}</p>
      {children && <div className="max-w-sm text-sm text-[var(--a-muted-ink)]">{children}</div>}
    </div>
  );
}

// يبني رابطاً بنفس معاملات البحث مع تعديل بعضها
export function withParams(base: string, sp: Record<string, string | string[] | undefined>, patch: Record<string, string | number | null | undefined>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v) u.set(k, v);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined || v === "") u.delete(k); else u.set(k, String(v));
  }
  const q = u.toString();
  return q ? `${base}?${q}` : base;
}

export function Pagination({ base, sp, page, pageSize, total, t, f }: {
  base: string; sp: Record<string, string | string[] | undefined>; page: number; pageSize: number; total: number; t: Dict; f: Fmt;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1, to = Math.min(total, page * pageSize);
  const link = "a-btn a-btn-ghost h-9 min-h-0 px-3";
  return (
    <nav aria-label={t.common.page} className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--a-line)] px-5 py-3 text-sm">
      <p className="text-[var(--a-muted-ink)] tabular-nums">{f.number(from)}–{f.number(to)} {t.common.of} {f.number(total)} {t.common.results}</p>
      <div className="flex items-center gap-2">
        {page > 1 ? <Link className={link} href={withParams(base, sp, { page: page - 1 })} rel="prev"><ChevronRight aria-hidden="true" className="h-4 w-4 ltr:rotate-180" />{t.common.previous}</Link>
          : <span className={`${link} opacity-40`} aria-disabled="true"><ChevronRight aria-hidden="true" className="h-4 w-4 ltr:rotate-180" />{t.common.previous}</span>}
        <span className="tabular-nums text-[var(--a-muted-ink)]">{f.number(page)} / {f.number(pages)}</span>
        {page < pages ? <Link className={link} href={withParams(base, sp, { page: page + 1 })} rel="next">{t.common.next}<ChevronLeft aria-hidden="true" className="h-4 w-4 ltr:rotate-180" /></Link>
          : <span className={`${link} opacity-40`} aria-disabled="true">{t.common.next}<ChevronLeft aria-hidden="true" className="h-4 w-4 ltr:rotate-180" /></span>}
      </div>
    </nav>
  );
}

// عنوان عمود قابل للفرز (رابط، يعمل دون JavaScript)
export function SortTh({ label, field, sort, dir, base, sp, t }: {
  label: string; field: string; sort: string; dir: "asc" | "desc"; base: string; sp: Record<string, string | string[] | undefined>; t: Dict;
}) {
  const active = sort === field;
  const next = active && dir === "desc" ? "asc" : "desc";
  return (
    <th scope="col" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link href={withParams(base, sp, { sort: field, dir: next, page: null })} className="inline-flex items-center gap-1 hover:text-[var(--a-text)]"
        title={next === "asc" ? t.common.sortAsc : t.common.sortDesc}>
        {label}<span aria-hidden="true" className={active ? "text-[var(--a-accent-ink)]" : "opacity-30"}>{active && dir === "asc" ? "↑" : "↓"}</span>
      </Link>
    </th>
  );
}

export const PRESETS: Preset[] = ["today", "yesterday", "7d", "30d", "month", "last_month", "year"];

// منتقي الفترة: روابط للفترات الجاهزة + نموذج لفترة مخصصة
export function PeriodPicker({ base, range, t, extra = {} }: {
  base: string; range: { from: string; to: string; preset?: Preset }; t: Dict; extra?: Record<string, string>;
}) {
  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
      <div role="group" aria-label={t.period.label} className="no-scrollbar -mx-1 flex min-w-0 max-w-full gap-1.5 overflow-x-auto px-1 py-0.5">
        {PRESETS.map((p) => (
          <Link key={p} href={withParams(base, extra, { preset: p })} aria-current={range.preset === p ? "true" : undefined} className="a-chip">{t.period[p]}</Link>
        ))}
      </div>
      <details className="relative" open={!range.preset || undefined}>
        <summary aria-current={!range.preset ? "true" : undefined} className="a-chip cursor-pointer list-none [&::-webkit-details-marker]:hidden">{t.period.custom}</summary>
        <form className="absolute end-0 top-[calc(100%+0.4rem)] z-20 flex w-[min(20rem,calc(100vw-2rem))] flex-col max-sm:fixed max-sm:inset-x-4 max-sm:top-24 max-sm:w-auto gap-3 rounded-[14px] border border-[var(--a-line)] bg-white p-4 shadow-[var(--a-shadow-lg)]">
          {Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <label className="block"><span className="a-label">{t.common.from}</span><input type="date" name="from" defaultValue={range.from} required className="a-input" /></label>
          <label className="block"><span className="a-label">{t.common.to}</span><input type="date" name="to" defaultValue={range.to} required className="a-input" /></label>
          <button className="a-btn a-btn-primary">{t.common.apply}</button>
        </form>
      </details>
    </div>
  );
}

export function rangeLabel(range: { from: string; to: string }, f: Fmt) {
  return range.from === range.to ? f.date(`${range.from}T12:00:00Z`) : `${f.date(`${range.from}T12:00:00Z`)} – ${f.date(`${range.to}T12:00:00Z`)}`;
}
export { fill };
