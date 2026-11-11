import { Suspense } from "react";
import { PageSkeleton } from "@/components/admin/PageSkeleton";
import Link from "next/link";
import { redirect } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft, Boxes, ChartSpline, Coins, Hourglass, Package, PieChart, ShoppingBag, ShoppingCart, Store, TrendingUp, Trophy, Users,
} from "lucide-react";
import heroImage from "@/assets/home/hero-living-room.webp";
import { Donut, HeroKpi, KpiCard, MetricStrip } from "@/components/admin/DashboardParts";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, can } from "@/lib/staff";
import { getDict, fmt, fill } from "@/lib/admin/i18n";
import { parseRange, type Kpis } from "@/lib/admin/finance";
import { Card, EmptyState, PeriodPicker, StatusBadge, rangeLabel } from "@/components/admin/ui";
import { BarChart, TrendChart, type Point } from "@/components/admin/charts/Charts";
import { CHART } from "@/components/admin/charts/palette";

export const instant = false;

// صور التخزين الخاص بالمتجر تُحسَّن تلقائياً؛ أي رابط خارجي يُعرض كما هو
const optimizable = (u: string) => u.startsWith("https://puakwxubskwxostdtmzi.supabase.co/storage/v1/object/public/");

type Counts = { total: number; new: number; processing: number; completed: number; cancelled: number; new_customers: number };
type Overview = {
  from: string; to: string; days: number; unit: "hour" | "day" | "month"; prev_from: string; prev_to: string;
  visible: { orders: boolean; finance: boolean; stock: boolean; sales: boolean };
  orders: null | { current: Counts; previous: Counts; customers_total: number; status_now: Record<string, number> };
  finance: null | { current: Kpis; previous: Kpis };
  series: Point[] | null; series_prev: Point[] | null;
  weekdays: { dow: number; orders: number; revenue: number }[] | null;
  top_products: { product_id: string | null; name: string; qty: number; revenue: number; image: string | null }[] | null;
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

  const spark = (k: "revenue" | "net" | "created" | "customers") => (d?.series ?? []).map((pt) => Number(pt[k] ?? 0));
  const statusSeg = o ? [
    { key: "completed", label: t.dashboard.segCompleted, value: o.current.completed, color: "#2f6b4f", href: q({ status: "delivered" }) },
    { key: "processing", label: t.dashboard.segProcessing, value: o.current.processing, color: "#b49a68", href: q({ status: "preparing" }) },
    { key: "new", label: t.dashboard.segNew, value: o.current.new, color: "#5d6b7a", href: q({ status: "received" }) },
    { key: "cancelled", label: t.dashboard.segCancelled, value: o.current.cancelled, color: "#b4533f", href: q({ status: "cancelled" }) },
  ] : [];
  const kv = { vsLabel: t.common.vsPrevious, noChange: t.common.noChange };
  const firstName = (staff.full_name ?? "").replace(/\(.*?\)/g, "").trim().split(/\s+/)[0] ?? "";

  return (
    <div className="mx-auto max-w-[90rem]">
      {/* رأس داكن قوي: صورة من المتجر (Unsplash، انظر IMAGES_CREDITS.md) بتعتيم فحمي، وعنوان كبير بكلمة ذهبية */}
      <section className="relative mb-6 overflow-hidden rounded-[var(--a-radius)] bg-[var(--a-sidebar)] text-[#f7f6f2]">
        <div className="absolute inset-y-0 end-0 hidden w-[60%] sm:block">
          <Image src={heroImage} alt="" fill priority={false} sizes="(min-width: 1024px) 50vw, 60vw" className="object-cover opacity-80" placeholder="blur" />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-l from-[var(--a-sidebar)] via-[var(--a-sidebar)]/70 to-[var(--a-sidebar)]/10 ltr:bg-gradient-to-r" />
        </div>
        <span aria-hidden="true" className="pointer-events-none absolute -start-20 -bottom-24 h-64 w-64 rounded-full border border-[#b49a68]/20" />
        <div className="relative max-w-xl px-6 py-9 sm:px-10 sm:py-12">
          <p className="flex items-center gap-3 text-[0.8125rem] font-medium text-[var(--a-accent-2)]"><span aria-hidden="true" className="h-px w-8 bg-[var(--a-accent)]" />{t.dashboard.welcome} {firstName}</p>
          <h1 className="mt-4 text-[2.1rem] font-light leading-tight text-[#f7f6f2] sm:text-[2.9rem]">{t.dashboard.title}</h1>
          <p className="mt-3 text-sm text-[#c9c6bd]">{t.dashboard.heroSub} · <span className="text-[var(--a-accent-2)]">{rangeLabel(range, f)}</span></p>
          <Link href={fin ? `/admin/reports?from=${range.from}&to=${range.to}` : "/admin/orders"}
            className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--a-accent-2)] px-6 text-sm font-medium text-[var(--a-sidebar)] transition-[background-color,box-shadow] hover:bg-[#e6d9bd] hover:shadow-[0_12px_30px_-14px_rgb(216_198_162/0.7)]">
            {fin ? t.dashboard.heroCta : t.orders.title}<ArrowLeft aria-hidden="true" strokeWidth={1.5} className="h-4 w-4 ltr:rotate-180" />
          </Link>
        </div>
      </section>

      {error || !d ? <p role="alert" className="a-card p-4 text-[var(--a-danger-ink)]">{t.common.error}</p> : (
        <div className="space-y-6">
          {/* المؤشرات: مؤشر رئيسي بارز (المبيعات) + أربعة مؤشرات مدمجة — قيم فعلية + نسبة التغير + منحنى الفترة */}
          <section aria-label={t.dashboard.subtitle} className={`grid grid-cols-1 gap-4 ${fin ? "lg:grid-cols-12" : ""}`}>
            {fin && (
              <div className="lg:col-span-5">
                <HeroKpi {...kv} label={t.dashboard.kpi.sales} value={f.money(fin.current.revenue)} current={+fin.current.revenue} previous={+fin.previous.revenue}
                  spark={spark("revenue")} href={`/admin/reports?from=${range.from}&to=${range.to}`} caption={rangeLabel(range, f)} />
              </div>
            )}
            <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${fin ? "lg:col-span-7" : "md:grid-cols-4"}`}>
              {fin && <KpiCard {...kv} label={t.dashboard.kpi.net} value={f.money(fin.current.manager_net)} current={+fin.current.manager_net} previous={+fin.previous.manager_net}
                icon={<TrendingUp className={ico} />} spark={spark("net")} href={`/admin/profits?from=${range.from}&to=${range.to}`}
                hint={fin.current.items_missing_profit ? `${f.number(fin.current.items_missing_profit)} ${t.dashboard.kpi.missingProfit}` : undefined} />}
              {o && <KpiCard {...kv} label={t.dashboard.kpi.orders} value={f.number(o.current.total)} current={o.current.total} previous={o.previous.total}
                icon={<ShoppingBag className={ico} />} spark={spark("created")} href={q({})} />}
              {o && <KpiCard {...kv} label={t.dashboard.kpi.customers} value={f.number(o.customers_total)} current={o.current.new_customers} previous={o.previous.new_customers}
                icon={<Users className={ico} />} spark={spark("customers")} href="/admin/customers" />}
              {o && <KpiCard {...kv} label={t.dashboard.kpi.processing} value={f.number(o.current.processing)} current={o.current.processing} previous={o.previous.processing}
                icon={<Hourglass className={ico} />} href={q({ status: "preparing" })} />}
            </div>
          </section>

          {/* مؤشرات إضافية: شريط واحد مقسوم بخطوط رفيعة */}
          <MetricStrip label={t.dashboard.moreAnalytics} items={[
            ...(o ? [
              { ...kv, key: "new", label: t.dashboard.kpi.new, value: f.number(o.current.new), current: o.current.new, previous: o.previous.new, href: q({ status: "received" }) },
              { ...kv, key: "done", label: t.dashboard.kpi.completed, value: f.number(o.current.completed), current: o.current.completed, previous: o.previous.completed, href: q({ status: "delivered" }) },
              { ...kv, key: "cancel", label: t.dashboard.kpi.cancelled, value: f.number(o.current.cancelled), current: o.current.cancelled, previous: o.previous.cancelled, good: "down" as const, href: q({ status: "cancelled" }) },
            ] : []),
            ...(fin ? [{ ...kv, key: "aov", label: t.dashboard.kpi.aov, value: f.money(fin.current.avg_order), current: +fin.current.avg_order, previous: +fin.previous.avg_order, href: `/admin/reports?from=${range.from}&to=${range.to}` }] : []),
            ...(d.stock ? [{ ...kv, key: "stock", label: t.dashboard.kpi.lowStock, value: f.number(d.stock.low + d.stock.out), warn: d.stock.low + d.stock.out > 0,
              hint: d.stock.out ? `${f.number(d.stock.out)} ${t.dashboard.kpi.lowStockHint}` : undefined, href: "/admin/inventory?filter=low" }] : []),
          ]} />

          {/* توزيع الطلبات + تحليل المبيعات */}
          <div className={`grid grid-cols-1 gap-6 ${o && fin ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]" : ""}`}>
            {o && (
              <Card title={<span className="flex items-center gap-2"><PieChart aria-hidden="true" className="h-5 w-5 text-[var(--a-accent-ink)]" />{t.dashboard.distribution}</span>}>
                <Donut segments={statusSeg} total={o.current.total} unit={t.dashboard.ordersUnit} empty={t.dashboard.noOrders} />
              </Card>
            )}
            {fin && d.series && d.series_prev ? (
              <Card title={<span className="flex items-center gap-2"><ChartSpline aria-hidden="true" className="h-5 w-5 text-[var(--a-accent-ink)]" />{t.dashboard.analytics}</span>}
                action={<PeriodPicker base="/admin" range={range} t={t} />}>
                {d.series.every((p) => +p.revenue === 0) && d.series_prev.every((p) => +p.revenue === 0)
                  ? <EmptyState icon={<Coins className="h-5 w-5" />} title={t.dashboard.noSales} />
                  : <TrendChart series={d.series} previous={d.series_prev} unit={d.unit} label={t.dashboard.revenue} />}
              </Card>
            ) : (
              <div className="space-y-3">
                <div className="a-card p-4"><PeriodPicker base="/admin" range={range} t={t} /></div>
                {!fin && <p className="a-card p-4 text-sm text-[var(--a-muted-ink)]">{t.dashboard.financeHidden}</p>}
              </div>
            )}
          </div>

          {/* الأكثر مبيعاً + أحدث الطلبات */}
          <div className={`grid grid-cols-1 gap-6 ${o && fin ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]" : ""}`}>
            {fin && (
              <Card title={<span className="flex items-center gap-2"><Trophy aria-hidden="true" className="h-5 w-5 text-[var(--a-accent-ink)]" />{t.dashboard.topProducts}</span>}
                action={<Link href={`/admin/reports?type=products&from=${range.from}&to=${range.to}`} className="rounded-full bg-[#f5efe3] px-3 py-1 text-xs font-semibold text-[var(--a-accent-ink)] hover:bg-[#efe5d1]">{t.common.viewAll}</Link>}>
                {(d.top_products ?? []).length === 0 ? <p className="py-6 text-center text-sm text-[var(--a-muted-ink)]">{t.dashboard.noSales}</p> : (
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                    {(d.top_products ?? []).slice(0, 6).map((pr, i) => {
                      const inner = (
                        <>
                          <div className="relative aspect-[4/3] overflow-hidden rounded-[12px] bg-[#f3f0ea]">
                            {pr.image ? <Image src={pr.image} alt="" fill unoptimized={!optimizable(pr.image)} sizes="(min-width:1280px) 12vw, 30vw" className="object-cover" />
                              : <span className="absolute inset-0 grid place-items-center text-[var(--a-muted)]"><Package aria-hidden="true" className="h-6 w-6" /></span>}
                            <span className="absolute start-2 top-2 grid h-6 min-w-6 place-items-center rounded-full bg-white/95 px-1.5 text-[0.6875rem] font-medium tabular-nums tracking-wider text-[var(--a-accent-ink)] shadow-sm">{String(i + 1).padStart(2, "0")}</span>
                          </div>
                          <p className="mt-2 truncate text-sm font-semibold">{pr.name}</p>
                          <p className="text-xs"><b className="tabular-nums text-[var(--a-accent-ink)]">{f.money(pr.revenue)}</b> <span className="text-[var(--a-muted-ink)]">· {f.number(pr.qty)} {t.dashboard.soldUnits}</span></p>
                        </>
                      );
                      return <li key={pr.product_id ?? pr.name}>{pr.product_id ? <Link href={`/admin/products/${pr.product_id}`} className="block rounded-[14px] p-1 hover:bg-[#faf8f4]">{inner}</Link> : <div className="p-1">{inner}</div>}</li>;
                    })}
                  </ul>
                )}
              </Card>
            )}
            {o && (
              <Card title={<span className="flex items-center gap-2"><ShoppingCart aria-hidden="true" className="h-5 w-5 text-[var(--a-accent-ink)]" />{t.dashboard.recentOrders}</span>} bodyClass=""
                action={<Link href="/admin/orders" className="rounded-full bg-[#f5efe3] px-3 py-1 text-xs font-semibold text-[var(--a-accent-ink)] hover:bg-[#efe5d1]">{t.common.viewAll}</Link>}>
                {rows.length === 0 ? <EmptyState icon={<ShoppingBag className="h-5 w-5" />} title={t.orders.empty} /> : <RecentOrders rows={rows} t={t} f={f} />}
              </Card>
            )}
          </div>

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

          {fin && d.series && (
            <section aria-label={t.dashboard.moreAnalytics} className="space-y-6">
              <h2 className="text-lg">{t.dashboard.moreAnalytics}</h2>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card title={t.dashboard.ordersChart}><BarChart series={d.series} unit={d.unit} metric="orders" label={t.dashboard.ordersChart} /></Card>
                <Card title={t.dashboard.profitChart}><BarChart series={d.series} unit={d.unit} metric="profit" label={t.dashboard.profitChart} color={CHART.current} /></Card>
              </div>
              <Card title={t.dashboard.bestDays}><Ranked rows={(d.weekdays ?? []).map((w) => ({ key: String(w.dow), name: t.days[w.dow], value: +w.revenue, sub: `${f.number(w.orders)} ${t.common.orders}` }))} f={f} sort /></Card>
            </section>
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
        <table className="a-table a-table-compact">
          <thead><tr>
            <th scope="col">{t.orders.number}</th><th scope="col">{t.orders.customer}</th><th scope="col" className="hidden 2xl:table-cell">{t.orders.product}</th>
            <th scope="col">{t.orders.date}</th><th scope="col">{t.orders.amount}</th><th scope="col">{t.orders.payment}</th>
            <th scope="col">{t.orders.status}</th><th scope="col"><span className="sr-only">{t.common.actions}</span></th>
          </tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td dir="ltr" className="text-end font-semibold rtl:text-start">{r.order_number}</td>
              <td>{r.customer_name}</td>
              <td className="hidden max-w-[10rem] truncate text-[var(--a-muted-ink)] 2xl:table-cell">{r.first_item ?? "—"}{r.lines > 1 ? ` ${fill(t.orders.moreItems, { n: r.lines - 1 })}` : ""}</td>
              <td className="text-[var(--a-muted-ink)]">{f.dateTime(r.created_at)}</td>
              <td className="font-semibold tabular-nums">{f.money(r.total)}</td>
              <td className="text-[var(--a-muted-ink)]">{t.payment[r.payment_method as keyof typeof t.payment] ?? r.payment_method}</td>
              <td><StatusBadge status={r.status} label={t.status[r.status as keyof typeof t.status] ?? r.status} /></td>
              <td className="text-end"><Link href={`/admin/orders/${r.id}`} aria-label={`${t.orders.view} ${r.order_number}`} className="inline-flex h-7 items-center rounded-full border border-[#e3d6bd] px-3 text-xs font-semibold text-[var(--a-accent-ink)] hover:bg-[#f5efe3]">{t.common.view}</Link></td>
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
