import { Suspense } from "react";
import { PageSkeleton } from "@/components/admin/PageSkeleton";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Ban, Boxes, CircleCheck, Coins, Hourglass, PackageX, Receipt, ShoppingBag, Sparkles, Store, TrendingUp, Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, can } from "@/lib/staff";
import { getDict, fmt, fill } from "@/lib/admin/i18n";
import { parseRange, type Kpis } from "@/lib/admin/finance";
import { Card, EmptyState, PageHeader, PeriodPicker, StatCard, StatusBadge, rangeLabel } from "@/components/admin/ui";
import { BarChart, TrendChart, type Point } from "@/components/admin/charts/Charts";
import { CHART } from "@/components/admin/charts/palette";

export const instant = false;

type Counts = { total: number; new: number; processing: number; completed: number; cancelled: number; new_customers: number };
type Overview = {
  from: string; to: string; days: number; unit: "hour" | "day" | "month"; prev_from: string; prev_to: string;
  visible: { orders: boolean; finance: boolean; stock: boolean; sales: boolean };
  orders: null | { current: Counts; previous: Counts; customers_total: number; status_now: Record<string, number> };
  finance: null | { current: Kpis; previous: Kpis };
  series: Point[] | null; series_prev: Point[] | null;
  weekdays: { dow: number; orders: number; revenue: number }[] | null;
  top_products: { product_id: string | null; name: string; qty: number; revenue: number }[] | null;
  stock: null | { low: number; out: number };
  store_sales: null | { approved_count: number; approved_amount: number; pending_count: number };
};
type OrderRow = {
  id: string; order_number: string; customer_name: string; status: string; payment_method: string; total: number;
  created_at: string; first_item: string | null; lines: number;
};

async function AdminHomeContent({ searchParams }: PageProps<"/admin">) {
  const staff = await requireStaff();
  // موظف الفرع (تسجيل المبيعات فقط) يذهب مباشرة إلى صفحة التسجيل
  const sees = ["orders.read", "finance.read", "inventory.manage", "catalog.manage", "sales.review"].some((p) => can(staff, p));
  if (!sees && can(staff, "sales.record")) redirect("/admin/sales");
  const t = getDict(staff.locale), f = fmt(staff.locale);
  const sp = await searchParams;
  const range = parseRange(sp, "30d");
  const supabase = await createClient();
  const [{ data, error }, recent] = await Promise.all([
    supabase.rpc("admin_overview", { p_from: range.from, p_to: range.to }),
    can(staff, "orders.read") ? supabase.rpc("admin_orders", { p: { page_size: 8 } }) : Promise.resolve({ data: null }),
  ]);
  const d = data as Overview | null;
  const rows = ((recent.data as { rows: OrderRow[] } | null)?.rows ?? []);
  const o = d?.orders, fin = d?.finance;
  const ico = "h-[1.1rem] w-[1.1rem]";
  const q = (p: Record<string, string>) => `/admin/orders?${new URLSearchParams({ from: range.from, to: range.to, ...p })}`;

  return (
    <div className="mx-auto max-w-[90rem]">
      <PageHeader title={t.dashboard.title} subtitle={`${t.dashboard.welcome} ${staff.full_name ?? ""} · ${rangeLabel(range, f)}`}
        actions={<PeriodPicker base="/admin" range={range} t={t} />} />

      {error || !d ? <p role="alert" className="a-card p-4 text-[var(--a-danger-ink)]">{t.common.error}</p> : (
        <div className="space-y-6">
          <section aria-label={t.dashboard.subtitle} className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
            {fin && (
              <>
                <StatCard t={t} f={f} label={t.dashboard.kpi.sales} value={f.money(fin.current.revenue)} current={+fin.current.revenue} previous={+fin.previous.revenue}
                  icon={<Coins className={ico} />} href={`/admin/reports?from=${range.from}&to=${range.to}`} />
                <StatCard t={t} f={f} label={t.dashboard.kpi.net} value={f.money(fin.current.manager_net)} current={+fin.current.manager_net} previous={+fin.previous.manager_net}
                  icon={<TrendingUp className={ico} />} href={`/admin/profits?from=${range.from}&to=${range.to}`}
                  tone={fin.current.items_missing_profit ? "warn" : undefined}
                  hint={fin.current.items_missing_profit ? `${f.number(fin.current.items_missing_profit)} ${t.dashboard.kpi.missingProfit}` : undefined} />
              </>
            )}
            {o && (
              <>
                <StatCard t={t} f={f} label={t.dashboard.kpi.orders} value={f.number(o.current.total)} current={o.current.total} previous={o.previous.total}
                  icon={<ShoppingBag className={ico} />} href={q({})} />
                <StatCard t={t} f={f} label={t.dashboard.kpi.new} value={f.number(o.current.new)} current={o.current.new} previous={o.previous.new}
                  icon={<Sparkles className={ico} />} href={q({ status: "received" })} />
                <StatCard t={t} f={f} label={t.dashboard.kpi.processing} value={f.number(o.current.processing)} current={o.current.processing} previous={o.previous.processing}
                  icon={<Hourglass className={ico} />} href={q({ status: "preparing" })} />
                <StatCard t={t} f={f} label={t.dashboard.kpi.completed} value={f.number(o.current.completed)} current={o.current.completed} previous={o.previous.completed}
                  icon={<CircleCheck className={ico} />} href={q({ status: "delivered" })} />
                <StatCard t={t} f={f} label={t.dashboard.kpi.cancelled} value={f.number(o.current.cancelled)} current={o.current.cancelled} previous={o.previous.cancelled}
                  good="down" icon={<Ban className={ico} />} href={q({ status: "cancelled" })} />
                <StatCard t={t} f={f} label={t.dashboard.kpi.customers} value={f.number(o.customers_total)} current={o.current.new_customers} previous={o.previous.new_customers}
                  icon={<Users className={ico} />} href="/admin/customers" hint={`+${f.number(o.current.new_customers)} ${t.dashboard.kpi.customersHint}`} />
              </>
            )}
            {fin && (
              <StatCard t={t} f={f} label={t.dashboard.kpi.aov} value={f.money(fin.current.avg_order)} current={+fin.current.avg_order} previous={+fin.previous.avg_order}
                icon={<Receipt className={ico} />} href={`/admin/reports?from=${range.from}&to=${range.to}`} />
            )}
            {d.stock && (
              <StatCard t={t} f={f} label={t.dashboard.kpi.lowStock} value={f.number(d.stock.low + d.stock.out)} icon={<PackageX className={ico} />}
                tone={d.stock.low + d.stock.out > 0 ? "warn" : undefined} href="/admin/inventory?filter=low"
                hint={d.stock.out ? `${f.number(d.stock.out)} ${t.dashboard.kpi.lowStockHint}` : undefined} />
            )}
          </section>

          {d.store_sales && (
            <Link href="/admin/purchases?source=store" className="a-card flex flex-wrap items-center gap-4 p-4 hover:border-[#d9d2c4]">
              <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-[10px] bg-[#f5efe3] text-[var(--a-accent-ink)]"><Store className={ico} /></span>
              <div className="min-w-0 flex-1 basis-[11rem]">
                <p className="text-sm font-semibold">{t.dashboard.storeSales}</p>
                <p className="text-xs text-[var(--a-muted-ink)]">{t.dashboard.storeSalesHint}</p>
              </div>
              <p className="text-lg font-bold tabular-nums">{f.money(d.store_sales.approved_amount)} <span className="text-sm font-medium text-[var(--a-muted-ink)]">· {f.number(d.store_sales.approved_count)} {t.common.orders}</span></p>
              {d.store_sales.pending_count > 0 && <StatusBadge status="submitted" label={`${f.number(d.store_sales.pending_count)} ${t.dashboard.pendingStoreSales}`} />}
            </Link>
          )}

          {d.series && d.series_prev ? (
            <>
              <Card title={t.dashboard.revenue} action={<span className="text-xs text-[var(--a-muted-ink)]">{t.period.compared} {rangeLabel({ from: d.prev_from, to: d.prev_to }, f)}</span>}>
                {d.series.every((p) => +p.revenue === 0) && d.series_prev.every((p) => +p.revenue === 0)
                  ? <EmptyState icon={<Coins className="h-5 w-5" />} title={t.dashboard.noSales} />
                  : <TrendChart series={d.series} previous={d.series_prev} unit={d.unit} label={t.dashboard.revenue} />}
              </Card>
              <div className="grid gap-6 lg:grid-cols-2">
                <Card title={t.dashboard.ordersChart}><BarChart series={d.series} unit={d.unit} metric="orders" label={t.dashboard.ordersChart} /></Card>
                <Card title={t.dashboard.profitChart}><BarChart series={d.series} unit={d.unit} metric="profit" label={t.dashboard.profitChart} color={CHART.current} /></Card>
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <Card title={t.dashboard.bestDays}><Ranked rows={(d.weekdays ?? []).map((w) => ({ key: String(w.dow), name: t.days[w.dow], value: +w.revenue, sub: `${f.number(w.orders)} ${t.common.orders}` }))} f={f} sort /></Card>
                <Card title={t.dashboard.topProducts} action={<Link href={`/admin/reports?from=${range.from}&to=${range.to}`} className="text-xs font-semibold text-[var(--a-accent-ink)] hover:underline">{t.common.viewAll}</Link>}>
                  {(d.top_products ?? []).length === 0 ? <p className="py-6 text-center text-sm text-[var(--a-muted-ink)]">{t.dashboard.noSales}</p>
                    : <Ranked rows={(d.top_products ?? []).map((p) => ({ key: p.product_id ?? p.name, name: p.name, value: +p.revenue, sub: `${f.number(p.qty)} ${t.common.items}`, href: p.product_id ? `/admin/products/${p.product_id}` : undefined }))} f={f} />}
                </Card>
              </div>
            </>
          ) : <p className="a-card p-4 text-sm text-[var(--a-muted-ink)]">{t.dashboard.financeHidden}</p>}

          {o && (
            <Card title={t.dashboard.recentOrders} bodyClass=""
              action={<form action="/admin/orders" className="flex items-center gap-2"><input name="q" placeholder={t.orders.searchPlaceholder} aria-label={t.common.search} className="a-input hidden h-9 min-h-0 w-56 sm:block" /><Link href="/admin/orders" className="text-xs font-semibold text-[var(--a-accent-ink)] hover:underline">{t.common.viewAll}</Link></form>}>
              {rows.length === 0 ? <EmptyState icon={<ShoppingBag className="h-5 w-5" />} title={t.orders.empty} /> : <RecentOrders rows={rows} t={t} f={f} />}
            </Card>
          )}
          {!o && !fin && !d.stock && <EmptyState icon={<Boxes className="h-5 w-5" />} title={t.dashboard.financeHidden} />}
        </div>
      )}
    </div>
  );
}

// قائمة مرتبة بأشرطة أفقية (أفضل الأيام / الأكثر مبيعاً): الرقم مكتوب بجانب كل شريط
function Ranked({ rows, f, sort = false }: { rows: { key: string; name: string; value: number; sub: string; href?: string }[]; f: ReturnType<typeof fmt>; sort?: boolean }) {
  const list = sort ? [...rows].sort((a, b) => b.value - a.value) : rows;
  const max = Math.max(1, ...list.map((r) => r.value));
  return (
    <ol className="space-y-3">
      {list.map((r, i) => {
        const name = r.href ? <Link href={r.href} className="hover:underline">{r.name}</Link> : r.name;
        return (
          <li key={r.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate"><span className="me-2 text-xs tabular-nums text-[var(--a-muted-ink)]">{i + 1}</span>{name}</span>
              <span className="shrink-0 tabular-nums"><b>{f.money(r.value)}</b> <span className="text-xs text-[var(--a-muted-ink)]">· {r.sub}</span></span>
            </div>
            <div className="h-2 rounded-full bg-[#f3f0ea]"><div className="h-2 rounded-full" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: i === 0 ? CHART.current : "#c8b48c" }} /></div>
          </li>
        );
      })}
    </ol>
  );
}

function RecentOrders({ rows, t, f }: { rows: OrderRow[]; t: ReturnType<typeof getDict>; f: ReturnType<typeof fmt> }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="a-table min-w-[52rem]">
          <thead><tr>
            <th scope="col">{t.orders.number}</th><th scope="col">{t.orders.customer}</th><th scope="col">{t.orders.product}</th>
            <th scope="col">{t.orders.date}</th><th scope="col">{t.orders.amount}</th><th scope="col">{t.orders.payment}</th>
            <th scope="col">{t.orders.status}</th><th scope="col"><span className="sr-only">{t.common.actions}</span></th>
          </tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td dir="ltr" className="text-end font-semibold rtl:text-start">{r.order_number}</td>
              <td>{r.customer_name}</td>
              <td className="max-w-[14rem] truncate text-[var(--a-muted-ink)]">{r.first_item ?? "—"}{r.lines > 1 ? ` ${fill(t.orders.moreItems, { n: r.lines - 1 })}` : ""}</td>
              <td className="whitespace-nowrap text-[var(--a-muted-ink)]">{f.dateTime(r.created_at)}</td>
              <td className="font-semibold tabular-nums">{f.money(r.total)}</td>
              <td className="text-[var(--a-muted-ink)]">{t.payment[r.payment_method as keyof typeof t.payment] ?? r.payment_method}</td>
              <td><StatusBadge status={r.status} label={t.status[r.status as keyof typeof t.status] ?? r.status} /></td>
              <td className="text-end"><Link href={`/admin/orders/${r.id}`} className="a-btn a-btn-ghost h-8 min-h-0 px-3 text-xs">{t.orders.view}</Link></td>
            </tr>))}</tbody>
        </table>
      </div>
      <ul className="divide-y divide-[var(--a-line)] md:hidden">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/admin/orders/${r.id}`} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm"><b dir="ltr">{r.order_number}</b><span className="truncate">{r.customer_name}</span></p>
                <p className="mt-0.5 text-xs text-[var(--a-muted-ink)]">{f.dateTime(r.created_at)}</p>
              </div>
              <div className="text-end">
                <p className="text-sm font-semibold tabular-nums">{f.money(r.total)}</p>
                <StatusBadge status={r.status} label={t.status[r.status as keyof typeof t.status] ?? r.status} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

// الصفحة تُعرض فوراً بهيكل تحميل، ثم يتدفق المحتوى (تنقل سلس دون انتظار الخادم)
export default function AdminHome(props: PageProps<"/admin">) {
  return <Suspense fallback={<PageSkeleton variant="dashboard" />}><AdminHomeContent {...props} /></Suspense>;
}
