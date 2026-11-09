import { Plus, TicketPercent } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { getDict, fmt, fill } from "@/lib/admin/i18n";
import { Card, EmptyState, PageHeader, StatCard } from "@/components/admin/ui";
import { CouponForm, ToggleCoupon } from "./Forms";

export const instant = false;

export default async function CouponsPage() {
  const staff = await requireStaff();
  const t = getDict(staff.locale), f = fmt(staff.locale), k = t.coupons;
  const supabase = await createClient();
  const { data } = await supabase.from("coupons")
    .select("*, coupon_usages(amount, orders(status))").order("created_at", { ascending: false });
  type Row = { id: string; code: string; kind: string; value: string; max_discount: string | null; min_order_amount: string;
    max_uses: number | null; max_uses_per_customer: number | null; vip_only: boolean; starts_at: string | null; ends_at: string | null;
    is_active: boolean; coupon_usages: { amount: string; orders: { status: string } | null }[] };
  const rows = (data ?? []) as Row[];
  const usedOf = (c: Row) => c.coupon_usages.filter((u) => u.orders?.status !== "cancelled");
  const ico = "h-[1.1rem] w-[1.1rem]";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title={k.title} subtitle={k.subtitle} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard t={t} f={f} label={k.activeCount} value={f.number(rows.filter((c) => c.is_active).length)} icon={<TicketPercent className={ico} />} />
        <StatCard t={t} f={f} label={k.usesCount} value={f.number(rows.reduce((a, c) => a + usedOf(c).length, 0))} icon={<TicketPercent className={ico} />} />
        <StatCard t={t} f={f} label={k.discountTotal} value={f.money(rows.reduce((a, c) => a + usedOf(c).reduce((s, u) => s + Number(u.amount), 0), 0))} icon={<TicketPercent className={ico} />} />
      </div>
      <details className="a-card">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 font-semibold [&::-webkit-details-marker]:hidden"><Plus aria-hidden="true" className="h-4 w-4 text-[var(--a-accent-ink)]" />{k.new}</summary>
        <div className="border-t border-[var(--a-line)] p-5"><p className="mb-4 text-sm text-[var(--a-muted-ink)]">{k.hint}</p><CouponForm /></div>
      </details>
      <Card title={k.list} bodyClass="">
        {rows.length === 0 ? <EmptyState icon={<TicketPercent className="h-5 w-5" />} title={k.empty} /> : (
          <ul className="divide-y divide-[var(--a-line)]">
            {rows.map((c) => {
              const used = usedOf(c);
              return (
                <li key={c.id}>
                  <details>
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                      <b dir="ltr" className="rounded-md bg-[#f5efe3] px-2 py-0.5 font-mono text-[var(--a-accent-ink)]">{c.code}</b>
                      <span className="text-sm font-semibold tabular-nums">{c.kind === "percent" ? `${Number(c.value)}%` : f.money(c.value)}{c.vip_only ? " · VIP" : ""}</span>
                      <span className="text-sm text-[var(--a-muted-ink)]">{fill(k.used, { n: f.number(used.length) })}{c.max_uses ? ` ${k.of} ${f.number(c.max_uses)}` : ""} · {k.totalDiscount} {f.money(used.reduce((s, u) => s + Number(u.amount), 0))}</span>
                      <span className="text-xs text-[var(--a-muted-ink)]">{c.starts_at || c.ends_at ? `${f.dateTime(c.starts_at)} ← ${f.dateTime(c.ends_at)}` : k.noExpiry}</span>
                      <span className="ms-auto"><ToggleCoupon id={c.id} active={c.is_active} /></span>
                    </summary>
                    <div className="border-t border-[var(--a-line)] bg-[#fcfbf8] p-5"><CouponForm c={{ ...c, value: String(c.value), max_discount: c.max_discount && String(c.max_discount), min_order_amount: String(c.min_order_amount) }} /></div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
