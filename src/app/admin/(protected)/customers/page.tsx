import { Suspense } from "react";
import { PageSkeleton } from "@/components/admin/PageSkeleton";
import Link from "next/link";
import { Coins, Search, ShoppingBag, UserPlus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, can } from "@/lib/staff";
import { getDict, fmt } from "@/lib/admin/i18n";
import { Card, EmptyState, PageHeader, Pagination, StatCard, withParams } from "@/components/admin/ui";
import { TierSelect } from "./TierSelect";

export const instant = false;

const SEGMENTS = ["all", "top", "new", "buyers", "inactive"] as const;
const SORTS = ["last_purchase", "spent", "orders", "created", "name"] as const;
type Row = {
  id: string; name: string; phone: string; tier: string; marketing_consent: boolean; created_at: string; has_account: boolean;
  orders_count: number; delivered_count: number; store_count: number; online_spent: number; store_spent: number; total_spent: number;
  last_purchase_at: string | null;
};
type Res = { total: number; page: number; page_size: number; summary: { customers: number; buyers: number; new_30d: number; total_spent: number }; rows: Row[] };

async function CustomersPageContent({ searchParams }: PageProps<"/admin/customers">) {
  const staff = await requireStaff();
  const t = getDict(staff.locale), f = fmt(staff.locale);
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const segment = (SEGMENTS as readonly string[]).includes(s("segment")) ? s("segment") : "all";
  const sort = (SORTS as readonly string[]).includes(s("sort")) ? s("sort") : "last_purchase";
  const tier = ["regular", "loyal", "vip"].includes(s("tier")) ? s("tier") : "";
  const q = s("q").trim().slice(0, 60);
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_customers", { p: { q, segment, sort, tier, page, page_size: 20 } });
  const res = data as Res | null;
  const rows = res?.rows ?? [];
  const canManage = can(staff, "orders.manage");
  const ico = "h-[1.1rem] w-[1.1rem]";

  return (
    <div className="mx-auto max-w-[90rem]">
      <PageHeader title={t.customers.title} subtitle={t.customers.subtitle} />
      {res && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard t={t} f={f} label={t.customers.totalCustomers} value={f.number(res.summary.customers)} icon={<Users className={ico} />} href="/admin/customers" />
          <StatCard t={t} f={f} label={t.customers.buyers} value={f.number(res.summary.buyers)} icon={<ShoppingBag className={ico} />} href="/admin/customers?segment=buyers" />
          <StatCard t={t} f={f} label={t.customers.new30} value={f.number(res.summary.new_30d)} icon={<UserPlus className={ico} />} href="/admin/customers?segment=new" />
          <StatCard t={t} f={f} label={t.customers.lifetime} value={f.money(res.summary.total_spent)} icon={<Coins className={ico} />} href="/admin/customers?segment=top" />
        </div>
      )}

      <Card bodyClass="">
        <div className="flex flex-col gap-3 border-b border-[var(--a-line)] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div role="tablist" className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {SEGMENTS.map((g) => (
              <Link key={g} role="tab" aria-selected={segment === g} aria-current={segment === g ? "true" : undefined}
                href={withParams("/admin/customers", sp, { segment: g === "all" ? null : g, page: null })} className="a-chip">{t.customers.segments[g]}</Link>
            ))}
          </div>
          <form className="flex flex-wrap gap-2">
            {segment !== "all" && <input type="hidden" name="segment" value={segment} />}
            <label className="relative block min-w-0 flex-1 sm:w-64 sm:flex-none">
              <span className="sr-only">{t.common.search}</span>
              <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--a-muted)]" />
              <input name="q" defaultValue={q} placeholder={t.customers.searchPlaceholder} className="a-input ps-9" maxLength={60} />
            </label>
            <select name="tier" defaultValue={tier} aria-label={t.customers.tier} className="a-input w-auto">
              <option value="">{t.customers.tier}: {t.common.all}</option>
              {(["vip", "loyal", "regular"] as const).map((k) => <option key={k} value={k}>{t.customers.tiers[k]}</option>)}
            </select>
            <select name="sort" defaultValue={sort} aria-label={t.common.filters} className="a-input w-auto">
              {SORTS.map((k) => <option key={k} value={k}>{t.customers.sort[k]}</option>)}
            </select>
            <button className="a-btn a-btn-primary">{t.common.apply}</button>
          </form>
        </div>

        {error ? <p role="alert" className="p-4 text-[var(--a-danger-ink)]">{t.common.error}</p>
          : rows.length === 0 ? <EmptyState icon={<Users className="h-5 w-5" />} title={t.customers.empty} /> : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="a-table min-w-[58rem]">
                <thead><tr>
                  <th scope="col">{t.customers.name}</th><th scope="col">{t.customers.phone}</th><th scope="col">{t.customers.orders}</th>
                  <th scope="col">{t.customers.spent}</th><th scope="col">{t.customers.lastPurchase}</th><th scope="col">{t.customers.consent}</th>
                  <th scope="col">{t.customers.tier}</th>
                </tr></thead>
                <tbody>{rows.map((c) => (
                  <tr key={c.id}>
                    <td><Link href={`/admin/customers/${c.id}`} className="font-semibold hover:text-[var(--a-accent-ink)]">{c.name}</Link>
                      <span className="block text-xs text-[var(--a-muted-ink)]">{t.customers.joined}: {f.date(c.created_at)}</span></td>
                    <td dir="ltr" className="text-end tabular-nums rtl:text-start">{c.phone}</td>
                    <td className="tabular-nums">{f.number(c.orders_count)}<span className="text-xs text-[var(--a-muted-ink)]"> · {f.number(c.delivered_count)} {t.customers.delivered}</span>
                      {c.store_count > 0 && <span className="block text-xs text-[var(--a-muted-ink)]">+{f.number(c.store_count)} {t.customers.store}</span>}</td>
                    <td className="font-semibold tabular-nums">{f.money(c.total_spent)}</td>
                    <td className="whitespace-nowrap text-[var(--a-muted-ink)]">{f.date(c.last_purchase_at)}</td>
                    <td>{c.marketing_consent ? t.common.yes : t.common.no}</td>
                    <td>{canManage ? <TierSelect id={c.id} tier={c.tier} /> : t.customers.tiers[c.tier as keyof typeof t.customers.tiers]}</td>
                  </tr>))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-[var(--a-line)] md:hidden">
              {rows.map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/customers/${c.id}`} className="flex items-center justify-between gap-3 px-4 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{c.name}</p>
                      <p dir="ltr" className="text-end text-xs tabular-nums text-[var(--a-muted-ink)] rtl:text-start">{c.phone}</p>
                      <p className="text-xs text-[var(--a-muted-ink)]">{t.customers.lastPurchase}: {f.date(c.last_purchase_at)}</p>
                    </div>
                    <div className="text-end">
                      <p className="font-semibold tabular-nums">{f.money(c.total_spent)}</p>
                      <p className="text-xs text-[var(--a-muted-ink)]">{f.number(c.orders_count + c.store_count)} {t.common.orders}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination base="/admin/customers" sp={sp} page={res!.page} pageSize={res!.page_size} total={res!.total} t={t} f={f} />
          </>
        )}
      </Card>
    </div>
  );
}

// الصفحة تُعرض فوراً بهيكل تحميل، ثم يتدفق المحتوى (تنقل سلس دون انتظار الخادم)
export default function CustomersPage(props: PageProps<"/admin/customers">) {
  return <Suspense fallback={<PageSkeleton variant="list" />}><CustomersPageContent {...props} /></Suspense>;
}
