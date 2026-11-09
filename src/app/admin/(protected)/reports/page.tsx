import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { formatPrice } from "@/lib/format";
import { EXPENSE_LABEL, PRESET_LABEL, parseRange, sourceLabel, type Preset, type Report } from "@/lib/admin/finance";
import { Kpi } from "@/components/admin/Kpi";
import { DailyBars } from "@/components/admin/DailyBars";
import { PrintButton } from "./PrintButton";

export const instant = false;

const th = "p-2 text-start font-medium";
const td = "p-2";

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const staff = await requireStaff();
  if (!staff.permissions.includes("finance.read")) {
    return <p className="rounded-lg bg-amber-50 p-4">التقارير المالية تحتاج صلاحية المالية.</p>;
  }
  const range = parseRange(await searchParams);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finance_report", { p_from: range.from, p_to: range.to });
  const r = data as Report | null;
  const qs = `from=${range.from}&to=${range.to}`;
  const k = r?.kpis, p = r?.previous;
  const rate = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

  return (
    <div className="mx-auto max-w-6xl space-y-6 print:max-w-none">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">التقارير</h1>
          <p className="text-sm opacity-70">من {range.from} إلى {range.to} (بتوقيت فلسطين). البيع يُحتسب عند تأكيد الطلب.</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <a href={`/admin/reports/export?${qs}&format=xlsx`} className="rounded-lg bg-charcoal px-3 py-2 text-sm text-white hover:bg-[#3d372e]">تصدير Excel</a>
          <a href={`/admin/reports/export?${qs}&format=csv`} className="rounded-lg border border-gold/40 bg-white px-3 py-2 text-sm hover:bg-beige">CSV</a>
          <PrintButton />
        </div>
      </div>

      <nav aria-label="الفترة" className="flex flex-wrap items-end gap-2 print:hidden">
        {(Object.keys(PRESET_LABEL) as Preset[]).map((pr) => (
          <Link key={pr} href={`/admin/reports?preset=${pr}`} aria-current={range.preset === pr ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm ${range.preset === pr ? "bg-charcoal text-white" : "border border-gold/30 bg-white hover:bg-beige"}`}>{PRESET_LABEL[pr]}</Link>
        ))}
        <form className="flex items-end gap-2 text-sm">
          <label className="space-y-1"><span className="block text-xs opacity-70">من</span><input type="date" name="from" defaultValue={range.from} className="rounded-lg border border-gold/30 px-2 py-1.5" /></label>
          <label className="space-y-1"><span className="block text-xs opacity-70">إلى</span><input type="date" name="to" defaultValue={range.to} className="rounded-lg border border-gold/30 px-2 py-1.5" /></label>
          <button className="rounded-lg border border-gold/40 bg-white px-3 py-1.5 hover:bg-beige">عرض</button>
        </form>
      </nav>

      {error || !r || !k || !p ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">تعذر تحميل التقرير. تأكد أن الفترة لا تتجاوز سنة.</p> : (
        <>
          {k.items_missing_profit > 0 && (
            <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              ⚠️ {k.items_missing_profit} بند مبيع بلا ربح مسجل (قيمتها {formatPrice(k.store_due_pending)}): الربح ومستحقات المحل غير مكتملة لهذه الفترة.
              سجّل الربح من صفحة كل طلب.
            </p>
          )}
          <section aria-labelledby="kpis" className="space-y-2">
            <h2 id="kpis" className="font-bold">الملخص <span className="text-xs font-normal opacity-60">(مقارنة بـ {r.days} يوماً قبلها)</span></h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label="المبيعات المؤكدة (الإجمالي)" value={k.revenue} previous={p.revenue} />
              <Kpi label="عدد الطلبات المؤكدة" value={k.orders} previous={p.orders} money={false} />
              <Kpi label="ربحك من المنتجات" value={k.manager_profit} previous={p.manager_profit} />
              <Kpi label="مستحقات المحل" value={k.store_due} previous={p.store_due} />
              <Kpi label="رسوم التوصيل المحصّلة" value={k.delivery_fees} previous={p.delivery_fees} />
              <Kpi label="المصروفات" value={k.expenses} previous={p.expenses} />
              <Kpi label="صافي ربحك" value={k.manager_net} previous={p.manager_net} />
              <Kpi label="متوسط قيمة الطلب" value={k.avg_order} previous={p.avg_order} />
            </div>
            <p className="text-xs opacity-70">
              صافي ربحك = ربحك من المنتجات + رسوم التوصيل − المصروفات. خصومات الكوبونات ({formatPrice(k.discounts)}) مخصومة من المبيعات أصلاً.
              تكلفة البضاعة المباعة: {formatPrice(k.cogs)}{k.items_missing_cost ? ` (${k.items_missing_cost} بند بلا تكلفة مسجلة)` : ""}.
            </p>
            <p className="text-sm">
              طلبات أُنشئت في الفترة: {k.created_orders} · نسبة الإتمام: {rate(k.created_delivered, k.created_orders)} · نسبة الإلغاء: {rate(k.created_cancelled, k.created_orders)}
            </p>
          </section>

          {r.days > 1 && (
            <section aria-labelledby="daily" className="rounded-2xl border border-gold/20 bg-white p-4">
              <h2 id="daily" className="mb-2 font-bold">المبيعات اليومية</h2>
              <DailyBars data={r.daily} />
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-gold-dark">جدول الأيام</summary>
                <table className="mt-2 w-full"><thead className="bg-beige/60"><tr><th className={th}>اليوم</th><th className={th}>الطلبات</th><th className={th}>المبيعات</th><th className={th}>ربحك</th></tr></thead>
                  <tbody>{r.daily.map((d) => <tr key={d.day} className="border-t border-gold/10"><td className={td}>{d.day}</td><td className={td}>{d.orders}</td><td className={td}>{formatPrice(d.revenue)}</td><td className={td}>{formatPrice(d.profit)}</td></tr>)}</tbody>
                </table>
              </details>
            </section>
          )}

          <section aria-labelledby="products" className="overflow-x-auto rounded-2xl border border-gold/20 bg-white p-4">
            <h2 id="products" className="mb-2 font-bold">المنتجات المباعة (الأكثر ← الأقل)</h2>
            {r.products.length === 0 ? <p className="text-sm opacity-70">لا مبيعات مؤكدة في هذه الفترة.</p> : (
              <table className="w-full min-w-[36rem] text-sm">
                <thead className="bg-beige/60"><tr><th className={th}>المنتج</th><th className={th}>الكمية</th><th className={th}>المبيعات</th><th className={th}>التكلفة</th><th className={th}>ربحك</th><th className={th}>مستحق المحل</th></tr></thead>
                <tbody>{r.products.map((x) => (
                  <tr key={`${x.product_id}-${x.name}`} className="border-t border-gold/10"><td className={td}>{x.name}</td><td className={td}>{x.qty}</td>
                    <td className={td}>{formatPrice(x.revenue)}</td><td className={td}>{x.cogs === null ? "—" : formatPrice(x.cogs)}</td>
                    <td className={td}>{x.profit === null ? "—" : formatPrice(x.profit)}</td><td className={td}>{x.store_due === null ? "—" : formatPrice(x.store_due)}</td></tr>))}
                </tbody>
              </table>
            )}
          </section>

          <div className="grid gap-5 md:grid-cols-2">
            <section className="rounded-2xl border border-gold/20 bg-white p-4 text-sm">
              <h2 className="mb-2 font-bold">أفضل التصنيفات</h2>
              {r.categories.length === 0 ? <p className="opacity-70">—</p> : <ul className="space-y-1">{r.categories.map((c) =>
                <li key={c.name} className="flex justify-between"><span>{c.name}</span><span>{c.qty} قطعة · {formatPrice(c.revenue)}</span></li>)}</ul>}
            </section>
            <section className="rounded-2xl border border-gold/20 bg-white p-4 text-sm">
              <h2 className="mb-2 font-bold">مصادر الطلبات</h2>
              {r.sources.length === 0 ? <p className="opacity-70">—</p> : <ul className="space-y-1">{r.sources.map((s) =>
                <li key={s.source} className="flex justify-between"><span>{sourceLabel(s.source)}</span><span>{s.orders} طلب · {formatPrice(s.revenue)}</span></li>)}</ul>}
            </section>
            <section className="rounded-2xl border border-gold/20 bg-white p-4 text-sm">
              <div className="mb-2 flex justify-between"><h2 className="font-bold">المصروفات حسب النوع</h2><Link href={`/admin/expenses?${qs}`} className="text-gold-dark hover:underline print:hidden">التفاصيل</Link></div>
              {r.expenses.length === 0 ? <p className="opacity-70">لا مصروفات مسجلة.</p> : <ul className="space-y-1">{r.expenses.map((e) =>
                <li key={e.category} className="flex justify-between"><span>{EXPENSE_LABEL[e.category]}</span><span>{formatPrice(e.amount)} ({e.n})</span></li>)}</ul>}
            </section>
            <section className="rounded-2xl border border-gold/20 bg-white p-4 text-sm">
              <h2 className="mb-2 font-bold">منتجات منشورة لم تُبع في الفترة</h2>
              {r.unsold.length === 0 ? <p className="opacity-70">كل المنتجات المنشورة بيع منها شيء.</p> : <ul className="space-y-1">{r.unsold.map((u) =>
                <li key={u.id}><Link href={`/admin/products/${u.id}`} className="hover:text-gold-dark">{u.name}</Link></li>)}</ul>}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
