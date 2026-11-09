import { Suspense } from "react";
import { PageSkeleton } from "@/components/admin/PageSkeleton";
import Link from "next/link";
import { Download, LayoutGrid, List, Search, ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { getDict, fmt, fill } from "@/lib/admin/i18n";
import { orderFilters, ORDER_STATUSES as STATUSES, PAYMENTS, type OrderListRow } from "@/lib/admin/orders";
import { Card, EmptyState, PageHeader, Pagination, SortTh, StatusBadge, withParams } from "@/components/admin/ui";

export const instant = false;

const KANBAN = STATUSES.filter((s) => s !== "cancelled" && s !== "delivered");

type ListResult = { total: number; page: number; page_size: number; status_counts: Record<string, number>; rows: OrderListRow[] };

async function requestTime() { return Date.now(); }

async function OrdersPageContent({ searchParams }: PageProps<"/admin/orders">) {
  const staff = await requireStaff();
  const t = getDict(staff.locale), f = fmt(staff.locale);
  const sp = await searchParams;
  const view = sp.view === "kanban" ? "kanban" : "table";
  const flt = orderFilters(sp);
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  const [{ data, error }, now] = await Promise.all([
    supabase.rpc("admin_orders", {
      p: view === "kanban"
        ? { q: flt.q, payment_method: flt.payment_method, from: flt.from, to: flt.to, open: true, page_size: 100 }
        : { ...flt, page, page_size: 20 },
    }),
    requestTime(),
  ]);
  const res = data as ListResult | null;
  const rows = res?.rows ?? [];
  const counts = res?.status_counts ?? {};
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const label = (s: string) => t.status[s as keyof typeof t.status] ?? s;
  const pay = (m: string) => t.payment[m as keyof typeof t.payment] ?? m;
  const exportHref = withParams("/admin/orders/export", sp, { page: null, view: null });

  const expiry = (o: OrderListRow) => {
    if (!o.reservation_expires_at || !["received", "awaiting_confirmation"].includes(o.status)) return null;
    const mins = Math.round((new Date(o.reservation_expires_at).getTime() - now) / 60000);
    return <span className={`block text-xs ${mins < 30 ? "font-semibold text-[var(--a-danger-ink)]" : "text-[var(--a-muted-ink)]"}`}>{mins > 0 ? fill(t.orders.expiresIn, { n: mins }) : t.orders.expired}</span>;
  };

  return (
    <div className="mx-auto max-w-[90rem]">
      <PageHeader title={t.orders.title} subtitle={t.orders.subtitle} actions={
        <>
          <div role="group" className="flex rounded-[10px] border border-[var(--a-line)] bg-white p-0.5">
            <Link href={withParams("/admin/orders", sp, { view: null })} aria-current={view === "table" ? "true" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${view === "table" ? "bg-[var(--a-sidebar)] text-white" : ""}`}><List aria-hidden="true" className="h-4 w-4" />{t.orders.table}</Link>
            <Link href={withParams("/admin/orders", sp, { view: "kanban", page: null, status: null })} aria-current={view === "kanban" ? "true" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${view === "kanban" ? "bg-[var(--a-sidebar)] text-white" : ""}`}><LayoutGrid aria-hidden="true" className="h-4 w-4" />{t.orders.kanban}</Link>
          </div>
          <a href={exportHref} className="a-btn a-btn-ghost" title={t.orders.exportHint}><Download aria-hidden="true" className="h-4 w-4" />{t.common.exportCsv}</a>
        </>
      } />

      <form className="a-card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]">
        {view === "kanban" && <input type="hidden" name="view" value="kanban" />}
        {flt.status && <input type="hidden" name="status" value={flt.status} />}
        <label className="relative block sm:col-span-2 lg:col-span-1">
          <span className="sr-only">{t.common.search}</span>
          <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--a-muted)]" />
          <input name="q" defaultValue={flt.q} placeholder={t.orders.searchPlaceholder} className="a-input ps-9" maxLength={60} />
        </label>
        <label className="block"><span className="sr-only">{t.orders.payment}</span>
          <select name="payment" defaultValue={flt.payment_method} className="a-input">
            <option value="">{t.orders.allPayments}</option>
            {PAYMENTS.map((p) => <option key={p} value={p}>{pay(p)}</option>)}
          </select>
        </label>
        <label className="block"><span className="sr-only">{t.common.from}</span><input type="date" name="from" defaultValue={flt.from} aria-label={t.common.from} className="a-input" /></label>
        <label className="block"><span className="sr-only">{t.common.to}</span><input type="date" name="to" defaultValue={flt.to} aria-label={t.common.to} className="a-input" /></label>
        <div className="flex gap-2">
          <button className="a-btn a-btn-primary flex-1">{t.common.apply}</button>
          {(flt.q || flt.payment_method || flt.from || flt.to) && <Link href={view === "kanban" ? "/admin/orders?view=kanban" : "/admin/orders"} className="a-btn a-btn-ghost">{t.common.reset}</Link>}
        </div>
      </form>

      {error && <p role="alert" className="a-card mb-4 p-4 text-[var(--a-danger-ink)]">{t.common.error}</p>}

      {view === "table" ? (
        <Card bodyClass="">
          <div role="tablist" aria-label={t.common.status} className="no-scrollbar flex gap-1 overflow-x-auto border-b border-[var(--a-line)] px-3 pt-2">
            {[["", t.common.all, allCount] as const, ...STATUSES.map((s) => [s, label(s), counts[s] ?? 0] as const)].map(([s, l, n]) => {
              const current = flt.status === s;
              return (
                <Link key={s || "all"} role="tab" aria-selected={current} href={withParams("/admin/orders", sp, { status: s || null, page: null })}
                  className={`relative whitespace-nowrap px-3 pb-2.5 pt-1.5 text-sm ${current ? "font-semibold text-[var(--a-text)]" : "text-[var(--a-muted-ink)] hover:text-[var(--a-text)]"}`}>
                  {l} <span className="ms-1 rounded-full bg-[#f1eee8] px-1.5 text-xs tabular-nums">{f.number(n)}</span>
                  {current && <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--a-accent)]" />}
                </Link>
              );
            })}
          </div>
          {rows.length === 0 ? <EmptyState icon={<ShoppingBag className="h-5 w-5" />} title={t.orders.empty} /> : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="a-table min-w-[60rem]">
                  <thead><tr>
                    <SortTh label={t.orders.number} field="order_number" sort={flt.sort} dir={flt.dir} base="/admin/orders" sp={sp} t={t} />
                    <SortTh label={t.orders.customer} field="customer_name" sort={flt.sort} dir={flt.dir} base="/admin/orders" sp={sp} t={t} />
                    <th scope="col">{t.orders.product}</th>
                    <SortTh label={t.orders.date} field="created_at" sort={flt.sort} dir={flt.dir} base="/admin/orders" sp={sp} t={t} />
                    <SortTh label={t.orders.amount} field="total" sort={flt.sort} dir={flt.dir} base="/admin/orders" sp={sp} t={t} />
                    <th scope="col">{t.orders.payment}</th><th scope="col">{t.orders.status}</th>
                    <th scope="col"><span className="sr-only">{t.common.actions}</span></th>
                  </tr></thead>
                  <tbody>{rows.map((o) => (
                    <tr key={o.id}>
                      <td><Link href={`/admin/orders/${o.id}`} dir="ltr" className="font-semibold hover:text-[var(--a-accent-ink)]">{o.order_number}</Link></td>
                      <td>{o.customer_name}<span dir="ltr" className="block text-end text-xs text-[var(--a-muted-ink)] rtl:text-start">{o.customer_phone}</span></td>
                      <td className="max-w-[15rem]"><span className="block truncate">{o.first_item ?? "—"}</span>
                        <span className="text-xs text-[var(--a-muted-ink)]">{f.number(o.items_count)} {t.common.items}{o.lines > 1 ? ` · ${fill(t.orders.moreItems, { n: o.lines - 1 })}` : ""}</span></td>
                      <td className="whitespace-nowrap text-[var(--a-muted-ink)]">{f.dateTime(o.created_at)}{expiry(o)}</td>
                      <td className="font-semibold tabular-nums">{f.money(o.total)}</td>
                      <td><span className="block">{pay(o.payment_method)}</span>
                        <span className={`text-xs ${o.payment_status === "awaiting_review" ? "font-semibold text-[var(--a-warning)]" : "text-[var(--a-muted-ink)]"}`}>{t.paymentStatus[o.payment_status as keyof typeof t.paymentStatus]}</span></td>
                      <td><StatusBadge status={o.status} label={label(o.status)} /></td>
                      <td className="text-end"><Link href={`/admin/orders/${o.id}`} className="a-btn a-btn-ghost h-8 min-h-0 px-3 text-xs">{t.orders.view}</Link></td>
                    </tr>))}
                  </tbody>
                </table>
              </div>
              {/* الجوال: بطاقات بدل الجدول */}
              <ul className="divide-y divide-[var(--a-line)] md:hidden">
                {rows.map((o) => (
                  <li key={o.id}>
                    <Link href={`/admin/orders/${o.id}`} className="block px-4 py-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <b dir="ltr" className="text-sm">{o.order_number}</b>
                        <StatusBadge status={o.status} label={label(o.status)} />
                      </div>
                      <div className="mt-1.5 flex items-end justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <p className="truncate">{o.customer_name}</p>
                          <p className="truncate text-xs text-[var(--a-muted-ink)]">{o.first_item} · {pay(o.payment_method)}</p>
                          <p className="text-xs text-[var(--a-muted-ink)]">{f.dateTime(o.created_at)}</p>
                          {expiry(o)}
                        </div>
                        <p className="shrink-0 font-semibold tabular-nums">{f.money(o.total)}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <Pagination base="/admin/orders" sp={sp} page={res?.page ?? 1} pageSize={res?.page_size ?? 20} total={res?.total ?? 0} t={t} f={f} />
            </>
          )}
        </Card>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {KANBAN.map((s) => {
            const col = rows.filter((o) => o.status === s);
            return (
              <section key={s} className="w-72 shrink-0 rounded-[14px] bg-[#efece5] p-2" aria-label={label(s)}>
                <h2 className="mb-2 flex items-center justify-between px-2 pt-1 text-sm">
                  <StatusBadge status={s} label={label(s)} /><span className="tabular-nums text-[var(--a-muted-ink)]">{f.number(counts[s] ?? 0)}</span>
                </h2>
                <ul className="space-y-2">
                  {col.map((o) => (
                    <li key={o.id}>
                      <Link href={`/admin/orders/${o.id}`} className="a-card block space-y-1 p-3 text-sm hover:border-[var(--a-accent)]">
                        <span className="flex justify-between"><b dir="ltr">{o.order_number}</b><span className="tabular-nums">{f.money(o.total)}</span></span>
                        <span className="block">{o.customer_name}</span>
                        <span className="block text-xs text-[var(--a-muted-ink)]">{t.fulfillment[o.fulfillment as keyof typeof t.fulfillment]} · {t.paymentStatus[o.payment_status as keyof typeof t.paymentStatus]}</span>
                        {expiry(o)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

// الصفحة تُعرض فوراً بهيكل تحميل، ثم يتدفق المحتوى (تنقل سلس دون انتظار الخادم)
export default function OrdersPage(props: PageProps<"/admin/orders">) {
  return <Suspense fallback={<PageSkeleton variant="list" />}><OrdersPageContent {...props} /></Suspense>;
}
