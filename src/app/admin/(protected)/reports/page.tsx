import { Suspense } from "react";
import { PageSkeleton } from "@/components/admin/PageSkeleton";
import Link from "next/link";
import { Ban, CircleCheck, Coins, Download, FileSpreadsheet, Receipt, ShoppingBag, TrendingUp, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, can } from "@/lib/staff";
import { getDict, fmt, fill } from "@/lib/admin/i18n";
import { parseRange, sourceLabel, type Report } from "@/lib/admin/finance";
import { Card, EmptyState, PageHeader, PeriodPicker, StatCard, rangeLabel, withParams } from "@/components/admin/ui";
import { BarChart } from "@/components/admin/charts/Charts";
import { CHART } from "@/components/admin/charts/palette";
import { PrintButton } from "@/components/admin/PrintButton";

export const instant = false;

const TYPES = ["sales", "profits", "orders", "products", "customers", "inventory", "expenses"] as const;
type Type = (typeof TYPES)[number];

async function ReportsPageContent({ searchParams }: PageProps<"/admin/reports">) {
  const staff = await requireStaff();
  const t = getDict(staff.locale), f = fmt(staff.locale), R = t.rep;
  if (!can(staff, "finance.read")) return <p className="a-card p-4">{R.needFinance}</p>;
  const sp = await searchParams;
  const type: Type = (TYPES as readonly string[]).includes(String(sp.type)) ? (sp.type as Type) : "sales";
  const range = parseRange(sp);
  const qs = `from=${range.from}&to=${range.to}`;
  const supabase = await createClient();
  const needsReport = ["sales", "orders", "products", "expenses"].includes(type);
  const [{ data, error }, customers, inventory] = await Promise.all([
    needsReport ? supabase.rpc("finance_report", { p_from: range.from, p_to: range.to }) : Promise.resolve({ data: null, error: null }),
    type === "customers" ? supabase.rpc("admin_customers", { p: { segment: "top", page_size: 25 } }) : Promise.resolve({ data: null }),
    type === "inventory" ? supabase.from("product_variants").select("id, name, price_override, is_active, products!inner(name, price, status, availability_mode), inventory(on_hand, reserved), variant_costs(unit_cost)")
      .eq("products.availability_mode", "stock").neq("products.status", "archived").limit(2000) : Promise.resolve({ data: null }),
  ]);
  const r = data as Report | null;
  const k = r?.kpis, p = r?.previous;
  const rate = (a: number, b: number) => (b ? `${f.number(Math.round((a / b) * 100))}%` : "—");
  const ico = "h-[1.1rem] w-[1.1rem]";
  const expLabel = (c: string) => t.exp.cat[c] ?? c;
  const exportLinks = (
    <>
      {type === "sales" || type === "products" || type === "expenses" ? (
        <>
          <a href={`/admin/reports/export?${qs}&format=xlsx`} className="a-btn a-btn-ghost"><FileSpreadsheet aria-hidden="true" className="h-4 w-4" />{t.common.exportXlsx}</a>
          <a href={`/admin/reports/export?${qs}&format=csv`} className="a-btn a-btn-ghost"><Download aria-hidden="true" className="h-4 w-4" />CSV</a>
        </>
      ) : type === "orders" ? <a href={`/admin/orders/export?${qs}`} className="a-btn a-btn-ghost"><Download aria-hidden="true" className="h-4 w-4" />{R.ordersExport}</a>
        : type === "customers" ? /* تنزيل ملف من مسار خادم، لا صفحة */ // eslint-disable-next-line @next/next/no-html-link-for-pages
        <a href="/admin/customers/export" className="a-btn a-btn-ghost"><Download aria-hidden="true" className="h-4 w-4" />{R.customersExport}</a>
        : type === "inventory" ? <a href="/admin/inventory/export" className="a-btn a-btn-ghost"><Download aria-hidden="true" className="h-4 w-4" />{R.inventoryExport}</a> : null}
      <PrintButton label={R.printPdf} />
    </>
  );

  return (
    <div className="mx-auto max-w-[90rem] space-y-6 print:max-w-none">
      <PageHeader title={`${R.title} · ${R.types[type]}`} subtitle={`${R.subtitle} · ${rangeLabel(range, f)}`} actions={<div className="flex flex-wrap gap-2 print:hidden">{exportLinks}</div>} />
      <div className="flex flex-col gap-3 print:hidden lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label={R.title} className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {TYPES.map((x) => (
            <Link key={x} href={x === "profits" ? `/admin/profits?${qs}` : withParams("/admin/reports", sp, { type: x === "sales" ? null : x })}
              aria-current={type === x ? "true" : undefined} className="a-chip">{R.types[x]}</Link>
          ))}
        </nav>
        {!["customers", "inventory"].includes(type) && <PeriodPicker base="/admin/reports" range={range} t={t} extra={type === "sales" ? {} : { type }} />}
      </div>

      {needsReport && (error || !r || !k || !p) ? <p role="alert" className="a-card p-4 text-[var(--a-danger-ink)]">{R.loadError}</p> : null}

      {type === "sales" && r && k && p && (
        <>
          {k.items_missing_profit > 0 && <p className="a-card border-[#ecd9b8] bg-[#fffaf1] p-4 text-sm text-[var(--a-warning)]">{fill(R.missingWarn, { n: f.number(k.items_missing_profit) })}</p>}
          <section aria-label={R.summary} className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            <StatCard t={t} f={f} label={R.revenue} value={f.money(k.revenue)} current={+k.revenue} previous={+p.revenue} icon={<Coins className={ico} />} />
            <StatCard t={t} f={f} label={R.ordersN} value={f.number(k.orders)} current={+k.orders} previous={+p.orders} icon={<ShoppingBag className={ico} />} />
            <StatCard t={t} f={f} label={R.managerProfit} value={f.money(k.manager_profit)} current={+k.manager_profit} previous={+p.manager_profit} icon={<TrendingUp className={ico} />} />
            <StatCard t={t} f={f} label={R.storeDue} value={f.money(k.store_due)} current={+k.store_due} previous={+p.store_due} icon={<Receipt className={ico} />} />
            <StatCard t={t} f={f} label={R.deliveryFees} value={f.money(k.delivery_fees)} current={+k.delivery_fees} previous={+p.delivery_fees} icon={<Coins className={ico} />} />
            <StatCard t={t} f={f} label={R.expenses} value={f.money(k.expenses)} current={+k.expenses} previous={+p.expenses} good="down" icon={<Wallet className={ico} />} />
            <StatCard t={t} f={f} label={R.managerNet} value={f.money(k.manager_net)} current={+k.manager_net} previous={+p.manager_net} icon={<TrendingUp className={ico} />} />
            <StatCard t={t} f={f} label={R.aov} value={f.money(k.avg_order)} current={+k.avg_order} previous={+p.avg_order} icon={<Receipt className={ico} />} />
          </section>
          <p className="text-xs text-[var(--a-muted-ink)]">{fill(R.netNote, { n: f.money(k.discounts) })} {R.cogs}: {f.money(k.cogs)}.</p>
          <Card title={R.daily}>
            {r.daily.every((d) => +d.revenue === 0) ? <EmptyState title={R.noSales} />
              : <BarChart series={r.daily.map((d) => ({ t: String(d.day).slice(0, 10), orders: +d.orders, revenue: +d.revenue, profit: +d.profit }))} unit="day" metric="revenue" label={R.daily} color={CHART.current} />}
          </Card>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card title={R.categories}>
              {r.categories.length === 0 ? <p className="text-sm text-[var(--a-muted-ink)]">—</p> : <ul className="space-y-2 text-sm">{r.categories.map((c) =>
                <li key={c.name} className="flex justify-between gap-3"><span>{c.name}</span><span className="tabular-nums"><b>{f.money(c.revenue)}</b> <span className="text-[var(--a-muted-ink)]">· {f.number(c.qty)} {t.common.items}</span></span></li>)}</ul>}
            </Card>
            <Card title={R.sources}>
              {r.sources.length === 0 ? <p className="text-sm text-[var(--a-muted-ink)]">—</p> : <ul className="space-y-2 text-sm">{r.sources.map((s) =>
                <li key={s.source} className="flex justify-between gap-3"><span>{sourceLabel(s.source)}</span><span className="tabular-nums"><b>{f.money(s.revenue)}</b> <span className="text-[var(--a-muted-ink)]">· {f.number(s.orders)} {t.common.orders}</span></span></li>)}</ul>}
            </Card>
          </div>
        </>
      )}

      {type === "orders" && k && (
        <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          <StatCard t={t} f={f} label={R.created} value={f.number(k.created_orders)} current={+k.created_orders} previous={+p!.created_orders} icon={<ShoppingBag className={ico} />} href={`/admin/orders?${qs}`} />
          <StatCard t={t} f={f} label={R.delivered} value={f.number(k.created_delivered)} current={+k.created_delivered} previous={+p!.created_delivered} icon={<CircleCheck className={ico} />} href={`/admin/orders?${qs}&status=delivered`} hint={`${R.completion}: ${rate(k.created_delivered, k.created_orders)}`} />
          <StatCard t={t} f={f} label={R.cancelled} value={f.number(k.created_cancelled)} current={+k.created_cancelled} previous={+p!.created_cancelled} good="down" icon={<Ban className={ico} />} href={`/admin/orders?${qs}&status=cancelled`} hint={`${R.cancellation}: ${rate(k.created_cancelled, k.created_orders)}`} />
          <StatCard t={t} f={f} label={R.aov} value={f.money(k.avg_order)} current={+k.avg_order} previous={+p!.avg_order} icon={<Receipt className={ico} />} />
          {r && <Card title={t.dashboard.ordersChart} className="col-span-2 md:col-span-4"><BarChart series={r.daily.map((d) => ({ t: String(d.day).slice(0, 10), orders: +d.orders, revenue: +d.revenue, profit: +d.profit }))} unit="day" metric="orders" label={t.dashboard.ordersChart} /></Card>}
        </section>
      )}

      {type === "products" && r && (
        <>
          <Card title={R.sold} bodyClass="">
            {r.products.length === 0 ? <EmptyState title={R.noSales} /> : (
              <div className="overflow-x-auto">
                <table className="a-table min-w-[44rem]">
                  <thead><tr><th scope="col">{R.product}</th><th scope="col">{R.qty}</th><th scope="col">{R.sales}</th><th scope="col">{R.cost}</th><th scope="col">{R.profit}</th><th scope="col">{R.due}</th></tr></thead>
                  <tbody>{r.products.map((x) => (
                    <tr key={`${x.product_id}-${x.name}`}><td>{x.product_id ? <Link href={`/admin/products/${x.product_id}`} className="hover:text-[var(--a-accent-ink)]">{x.name}</Link> : x.name}</td>
                      <td className="tabular-nums">{f.number(x.qty)}</td><td className="font-semibold tabular-nums">{f.money(x.revenue)}</td>
                      <td className="tabular-nums">{x.cogs === null ? "—" : f.money(x.cogs)}</td><td className="tabular-nums">{x.profit === null ? "—" : f.money(x.profit)}</td>
                      <td className="tabular-nums">{x.store_due === null ? "—" : f.money(x.store_due)}</td></tr>))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card title={R.unsold}>
            {r.unsold.length === 0 ? <p className="text-sm text-[var(--a-muted-ink)]">{R.allSold}</p>
              : <ul className="flex flex-wrap gap-2">{r.unsold.map((u) => <li key={u.id}><Link href={`/admin/products/${u.id}`} className="a-chip">{u.name}</Link></li>)}</ul>}
          </Card>
        </>
      )}

      {type === "expenses" && r && k && (
        <Card title={R.byType} action={<Link href={`/admin/expenses?${qs}`} className="text-xs font-semibold text-[var(--a-accent-ink)] hover:underline print:hidden">{R.details}</Link>}>
          {r.expenses.length === 0 ? <p className="text-sm text-[var(--a-muted-ink)]">{R.noExpenses}</p> : (
            <table className="a-table">
              <thead><tr><th scope="col">{R.type}</th><th scope="col">{R.count}</th><th scope="col">{R.amount}</th></tr></thead>
              <tbody>{r.expenses.map((e) => <tr key={e.category}><td>{expLabel(e.category)}</td><td className="tabular-nums">{f.number(e.n)}</td><td className="font-semibold tabular-nums">{f.money(e.amount)}</td></tr>)}</tbody>
              <tfoot><tr className="font-bold"><td className="px-4 py-3">{t.common.total}</td><td /><td className="px-4 py-3 tabular-nums">{f.money(k.expenses)}</td></tr></tfoot>
            </table>
          )}
        </Card>
      )}

      {type === "customers" && (
        <Card title={R.topCustomers} bodyClass="">
          {(() => {
            const rows = ((customers.data as { rows?: { id: string; name: string; phone: string; orders_count: number; store_count: number; total_spent: number; last_purchase_at: string | null }[] } | null)?.rows ?? []);
            return rows.length === 0 ? <EmptyState title={t.customers.empty} /> : (
              <div className="overflow-x-auto">
                <table className="a-table min-w-[40rem]">
                  <thead><tr><th scope="col">#</th><th scope="col">{t.customers.name}</th><th scope="col">{t.customers.phone}</th><th scope="col">{t.customers.orders}</th><th scope="col">{t.customers.spent}</th><th scope="col">{t.customers.lastPurchase}</th></tr></thead>
                  <tbody>{rows.map((c, i) => (
                    <tr key={c.id}><td className="tabular-nums text-[var(--a-muted-ink)]">{i + 1}</td><td><Link href={`/admin/customers/${c.id}`} className="font-semibold hover:text-[var(--a-accent-ink)]">{c.name}</Link></td>
                      <td dir="ltr" className="text-end tabular-nums rtl:text-start">{c.phone}</td><td className="tabular-nums">{f.number(c.orders_count + c.store_count)}</td>
                      <td className="font-semibold tabular-nums">{f.money(c.total_spent)}</td><td className="text-[var(--a-muted-ink)]">{f.date(c.last_purchase_at)}</td></tr>))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </Card>
      )}

      {type === "inventory" && (() => {
        type V = { id: string; name: string; price_override: number | null; is_active: boolean; products: { name: string; price: number | null }; inventory: { on_hand: number; reserved: number }[]; variant_costs: { unit_cost: number } | { unit_cost: number }[] | null };
        const vs = ((inventory.data ?? []) as unknown as V[]).filter((v) => v.is_active);
        const cost = (v: V) => (Array.isArray(v.variant_costs) ? v.variant_costs[0]?.unit_cost : v.variant_costs?.unit_cost);
        const qty = (v: V) => v.inventory.reduce((a, i) => a + i.on_hand, 0);
        const sell = vs.reduce((a, v) => a + qty(v) * Number(v.price_override ?? v.products.price ?? 0), 0);
        const withCost = vs.filter((v) => cost(v) !== undefined && cost(v) !== null);
        const costVal = withCost.reduce((a, v) => a + qty(v) * Number(cost(v)), 0);
        const missing = vs.filter((v) => qty(v) > 0 && (cost(v) === undefined || cost(v) === null)).length;
        return (
          <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            <StatCard t={t} f={f} label={t.inv.skus} value={f.number(vs.length)} icon={<ShoppingBag className={ico} />} href="/admin/inventory" />
            <StatCard t={t} f={f} label={t.inv.onHand} value={f.number(vs.reduce((a, v) => a + qty(v), 0))} icon={<ShoppingBag className={ico} />} />
            <StatCard t={t} f={f} label={R.stockValue} value={f.money(sell)} icon={<Coins className={ico} />} />
            <StatCard t={t} f={f} label={R.stockCost} value={f.money(costVal)} icon={<Coins className={ico} />} tone={missing ? "warn" : undefined} hint={missing ? `${f.number(missing)} ${R.costMissing}` : undefined} />
          </section>
        );
      })()}
    </div>
  );
}

// الصفحة تُعرض فوراً بهيكل تحميل، ثم يتدفق المحتوى (تنقل سلس دون انتظار الخادم)
export default function ReportsPage(props: PageProps<"/admin/reports">) {
  return <Suspense fallback={<PageSkeleton variant="list" />}><ReportsPageContent {...props} /></Suspense>;
}
