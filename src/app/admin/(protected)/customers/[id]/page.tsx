import { Suspense } from "react";
import { PageSkeleton } from "@/components/admin/PageSkeleton";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Coins, Mail, MessageCircle, Phone, ShoppingBag, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, can } from "@/lib/staff";
import { getDict, fmt } from "@/lib/admin/i18n";
import { whatsappLink } from "@/lib/format";
import { Card, EmptyState, StatCard, StatusBadge } from "@/components/admin/ui";
import { TierSelect } from "../TierSelect";

export const instant = false;

type Customer = {
  id: string; name: string; phone: string; tier: string; marketing_consent: boolean; created_at: string; deletion_requested_at: string | null;
  email: string | null; addresses: string[];
  stats: { orders_count: number; delivered_count: number; online_spent: number; store_count: number; store_spent: number; last_purchase_at: string | null } | null;
  orders: { id: string; order_number: string; status: string; total: number; created_at: string; payment_method: string }[];
  store_purchases: { id: string; amount: number; status: string; created_at: string; branch: string }[] | null;
};

async function CustomerPageContent({ params }: PageProps<"/admin/customers/[id]">) {
  const staff = await requireStaff();
  const t = getDict(staff.locale), f = fmt(staff.locale);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_customer", { p_id: id });
  if (error?.code === "P0002" || (!data && !error)) notFound();
  if (error || !data) return <p role="alert" className="a-card p-4 text-[var(--a-danger-ink)]">{t.common.error}</p>;
  const c = data as Customer;
  const st = c.stats;
  const total = Number(st?.online_spent ?? 0) + Number(st?.store_spent ?? 0);
  const wa = whatsappLink(c.phone, "");
  const ico = "h-[1.1rem] w-[1.1rem]";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/admin/customers" className="inline-flex items-center gap-1.5 text-sm text-[var(--a-muted-ink)] hover:text-[var(--a-text)]">
        <ArrowRight aria-hidden="true" className="h-4 w-4 ltr:rotate-180" />{t.customers.back}
      </Link>

      <section className="a-card flex flex-wrap items-start gap-5 p-5">
        <span aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[var(--a-sidebar)] text-lg font-bold text-[var(--a-accent-2)]">{c.name.trim()[0]}</span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl">{c.name}</h1>
            <StatusBadge status={c.tier === "vip" ? "confirmed" : "unpaid"} label={t.customers.tiers[c.tier as keyof typeof t.customers.tiers]} />
            {c.deletion_requested_at && <StatusBadge status="rejected" label={t.customers.deletion} />}
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-[var(--a-muted-ink)]">
            <li className="flex items-center gap-1.5"><Phone aria-hidden="true" className="h-4 w-4" /><span dir="ltr" className="tabular-nums">{c.phone}</span></li>
            <li className="flex items-center gap-1.5"><Mail aria-hidden="true" className="h-4 w-4" />{c.email ? <span dir="ltr">{c.email}</span> : t.customers.noEmail}</li>
            <li>{t.customers.joined}: {f.date(c.created_at)}</li>
            <li>{t.customers.consent}: {c.marketing_consent ? t.common.yes : t.common.no}</li>
          </ul>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {can(staff, "orders.manage") && <TierSelect id={c.id} tier={c.tier} />}
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="a-btn a-btn-ghost"><MessageCircle aria-hidden="true" className="h-4 w-4" />{t.customers.whatsapp}</a>}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard t={t} f={f} label={t.customers.spent} value={f.money(total)} icon={<Coins className={ico} />} />
        <StatCard t={t} f={f} label={t.customers.online} value={f.money(st?.online_spent ?? 0)} icon={<ShoppingBag className={ico} />}
          hint={`${f.number(st?.orders_count ?? 0)} ${t.common.orders} · ${f.number(st?.delivered_count ?? 0)} ${t.customers.delivered}`} />
        <StatCard t={t} f={f} label={t.customers.store} value={f.money(st?.store_spent ?? 0)} icon={<Store className={ico} />} hint={`${f.number(st?.store_count ?? 0)} ${t.common.orders}`} />
        <StatCard t={t} f={f} label={t.customers.lastPurchase} value={f.date(st?.last_purchase_at)} icon={<ShoppingBag className={ico} />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title={t.customers.ordersHistory} bodyClass="">
          {c.orders.length === 0 ? <EmptyState title={t.orders.empty} /> : (
            <div className="overflow-x-auto">
              <table className="a-table min-w-[34rem]">
                <thead><tr><th scope="col">{t.orders.number}</th><th scope="col">{t.orders.date}</th><th scope="col">{t.orders.payment}</th><th scope="col">{t.orders.amount}</th><th scope="col">{t.orders.status}</th></tr></thead>
                <tbody>{c.orders.map((o) => (
                  <tr key={o.id}>
                    <td><Link dir="ltr" href={`/admin/orders/${o.id}`} className="font-semibold hover:text-[var(--a-accent-ink)]">{o.order_number}</Link></td>
                    <td className="text-[var(--a-muted-ink)]">{f.dateTime(o.created_at)}</td>
                    <td className="text-[var(--a-muted-ink)]">{t.payment[o.payment_method as keyof typeof t.payment]}</td>
                    <td className="font-semibold tabular-nums">{f.money(o.total)}</td>
                    <td><StatusBadge status={o.status} label={t.status[o.status as keyof typeof t.status]} /></td>
                  </tr>))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <div className="space-y-6">
          {c.store_purchases && (
            <Card title={t.customers.storeHistory}>
              {c.store_purchases.length === 0 ? <p className="text-sm text-[var(--a-muted-ink)]">{t.common.none}</p> : (
                <ul className="space-y-3 text-sm">
                  {c.store_purchases.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3">
                      <span><b className="tabular-nums">{f.money(s.amount)}</b><span className="block text-xs text-[var(--a-muted-ink)]">{s.branch} · {f.date(s.created_at)}</span></span>
                      <StatusBadge status={s.status} label={t.customers.storeStatus[s.status as keyof typeof t.customers.storeStatus]} />
                    </li>))}
                </ul>
              )}
            </Card>
          )}
          <Card title={t.customers.addresses}>
            {c.addresses.length === 0 ? <p className="text-sm text-[var(--a-muted-ink)]">{t.common.none}</p>
              : <ul className="space-y-2 text-sm">{c.addresses.map((a) => <li key={a} className="rounded-[10px] bg-[#faf8f4] p-3">{a}</li>)}</ul>}
          </Card>
        </div>
      </div>
    </div>
  );
}

// الصفحة تُعرض فوراً بهيكل تحميل، ثم يتدفق المحتوى (تنقل سلس دون انتظار الخادم)
export default function CustomerPage(props: PageProps<"/admin/customers/[id]">) {
  return <Suspense fallback={<PageSkeleton variant="form" />}><CustomerPageContent {...props} /></Suspense>;
}
