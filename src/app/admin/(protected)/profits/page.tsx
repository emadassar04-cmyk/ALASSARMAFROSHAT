import { Suspense } from "react";
import { PageSkeleton } from "@/components/admin/PageSkeleton";
import Link from "next/link";
import { TriangleAlert, CircleCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { getDict, fmt, fill, type Fmt } from "@/lib/admin/i18n";
import { EXPENSE_LABEL, parseRange, type Report } from "@/lib/admin/finance";
import { Card, PageHeader, PeriodPicker, rangeLabel } from "@/components/admin/ui";

export const instant = false;

const EXPENSE_EN: Record<string, string> = {
  delivery: "Delivery (courier fees)", packaging: "Packaging", marketing: "Advertising & marketing",
  payment_fees: "Payment & transfer fees", discounts: "Discounts outside orders", refunds: "Refunds", other: "Other",
};

// قائمة الأرباح والخسائر: كل رقم من finance_report (نفس تعريفات التقارير)، والبيانات الناقصة معلنة بوضوح
// سطر في القائمة المالية (خارج الصفحة حتى لا يُنشأ مكوّن جديد في كل عرض)
function Row({ label, value, sign, strong, muted, note, f }: { label: string; value: number; sign?: "-" | "+"; strong?: boolean; muted?: boolean; note?: React.ReactNode; f: Fmt }) {
  return (
  <div className={`flex items-baseline justify-between gap-4 py-2.5 ${strong ? "border-t border-[var(--a-line)] pt-3 font-bold" : ""}`}>
    <span className={muted ? "text-[var(--a-muted-ink)]" : ""}>{label}{note && <span className="mt-0.5 block text-xs font-normal text-[var(--a-warning)]">{note}</span>}</span>
    <span className={`shrink-0 tabular-nums ${sign === "-" && value ? "text-[var(--a-danger-ink)]" : ""}`}>{sign === "-" && value ? "− " : ""}{f.money(Math.abs(value))}</span>
  </div>
  );
}

async function ProfitsPageContent({ searchParams }: PageProps<"/admin/profits">) {
  const staff = await requireStaff();
  const t = getDict(staff.locale), f = fmt(staff.locale);
  const range = parseRange(await searchParams);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finance_report", { p_from: range.from, p_to: range.to });
  const r = data as Report | null;
  const expLabel = (c: string) => (staff.locale === "en" ? EXPENSE_EN[c] : EXPENSE_LABEL[c]) ?? c;

  if (error || !r) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title={t.profits.title} actions={<PeriodPicker base="/admin/profits" range={range} t={t} />} />
        <p role="alert" className="a-card p-4 text-[var(--a-danger-ink)]">{error?.message.includes("forbidden") ? t.errors.forbidden : t.common.error}</p>
      </div>
    );
  }
  const k = r.kpis;
  const n = (v: number | string) => Number(v);
  const exp = Object.fromEntries(r.expenses.map((e) => [e.category, n(e.amount)]));
  const shipping = exp.delivery ?? 0, refunds = exp.refunds ?? 0;
  const operating = n(k.expenses) - shipping - refunds;
  const grossSales = n(k.products_net) + n(k.discounts);
  const totalRevenue = n(k.products_net) + n(k.delivery_fees);
  const grossProfit = n(k.products_net) - n(k.cogs);
  const netByCost = grossProfit + n(k.delivery_fees) - n(k.expenses);
  const complete = !k.items_missing_cost && !k.items_missing_profit;


  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t.profits.title} subtitle={`${t.profits.subtitle} · ${rangeLabel(range, f)}`} actions={<PeriodPicker base="/admin/profits" range={range} t={t} />} />

      <div className={`a-card mb-6 flex items-start gap-3 p-4 text-sm ${complete ? "" : "border-[#ecd9b8] bg-[#fffaf1]"}`}>
        {complete ? <CircleCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[var(--a-success)]" /> : <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[var(--a-warning)]" />}
        <div className="space-y-1">
          <p className="font-semibold">{complete ? t.profits.complete : t.common.missingData}</p>
          {k.items_missing_profit > 0 && <p>{fill(t.profits.profitMissing, { n: f.number(k.items_missing_profit), amount: f.money(k.store_due_pending) })}</p>}
          {k.items_missing_cost > 0 && <p>{fill(t.profits.cogsMissing, { n: f.number(k.items_missing_cost) })}</p>}
          <p className="text-[var(--a-muted-ink)]">{t.profits.notRevenue}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t.profits.revenue}>
          <div className="text-sm">
            <Row f={f} label={t.profits.grossSales} value={grossSales} />
            <Row f={f} label={t.profits.discounts} value={n(k.discounts)} sign="-" muted />
            <Row f={f} label={t.profits.netSales} value={n(k.products_net)} />
            <Row f={f} label={t.profits.deliveryFees} value={n(k.delivery_fees)} sign="+" muted />
            <Row f={f} label={t.profits.totalRevenue} value={totalRevenue} strong />
          </div>
        </Card>
        <Card title={t.profits.costs}>
          <div className="text-sm">
            <Row f={f} label={t.profits.cogs} value={n(k.cogs)} sign="-" note={k.items_missing_cost ? t.profits.grossIncomplete : undefined} />
            <Row f={f} label={t.profits.shipping} value={shipping} sign="-" />
            <Row f={f} label={t.profits.refunds} value={refunds} sign="-" />
            <Row f={f} label={t.profits.expenses} value={operating} sign="-" />
            <Row f={f} label={t.common.total} value={n(k.cogs) + n(k.expenses)} sign="-" strong />
          </div>
        </Card>

        <Card title={t.profits.model} className="border-[#e3d6bd]">
          <div className="text-sm">
            <Row f={f} label={t.profits.managerProfit} value={n(k.manager_profit)} />
            <Row f={f} label={t.profits.deliveryFees} value={n(k.delivery_fees)} sign="+" muted />
            <Row f={f} label={t.profits.expenses} value={n(k.expenses)} sign="-" muted />
            <Row f={f} label={t.profits.managerNet} value={n(k.manager_net)} strong
              note={k.items_missing_profit ? fill(t.profits.profitMissing, { n: f.number(k.items_missing_profit), amount: f.money(k.store_due_pending) }) : undefined} />
            <Row f={f} label={t.profits.storeDue} value={n(k.store_due)} muted />
            <p className="mt-2 rounded-[10px] bg-[#faf8f4] p-3 text-xs text-[var(--a-muted-ink)]">{t.profits.formula}: {t.dashboard.kpi.netHint}</p>
          </div>
        </Card>
        <Card title={t.profits.costModel}>
          <div className="text-sm">
            <Row f={f} label={t.profits.netSales} value={n(k.products_net)} />
            <Row f={f} label={t.profits.cogs} value={n(k.cogs)} sign="-" muted />
            <Row f={f} label={t.profits.grossProfit} value={grossProfit} strong note={k.items_missing_cost ? t.profits.grossIncomplete : undefined} />
            <Row f={f} label={t.profits.netByCost} value={netByCost} strong note={k.items_missing_cost ? t.profits.grossIncomplete : undefined} />
          </div>
        </Card>
      </div>

      {r.expenses.length > 0 && (
        <Card title={t.profits.byCategory} className="mt-6" action={<Link href={`/admin/expenses?from=${range.from}&to=${range.to}`} className="text-xs font-semibold text-[var(--a-accent-ink)] hover:underline">{t.common.viewAll}</Link>}>
          <ul className="space-y-2 text-sm">
            {r.expenses.map((e) => (
              <li key={e.category} className="flex justify-between gap-4"><span>{expLabel(e.category)} <span className="text-xs text-[var(--a-muted-ink)]">({f.number(e.n)})</span></span><b className="tabular-nums">{f.money(e.amount)}</b></li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

// الصفحة تُعرض فوراً بهيكل تحميل، ثم يتدفق المحتوى (تنقل سلس دون انتظار الخادم)
export default function ProfitsPage(props: PageProps<"/admin/profits">) {
  return <Suspense fallback={<PageSkeleton variant="form" />}><ProfitsPageContent {...props} /></Suspense>;
}
