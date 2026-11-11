import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Ruler } from "lucide-react";
import { PageSkeleton } from "@/components/admin/PageSkeleton";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, can } from "@/lib/staff";
import { getDict, fmt } from "@/lib/admin/i18n";
import { formatPhone } from "@/lib/phone";
import { specLines, STATUSES } from "@/lib/custom-order/spec";
import { Card, EmptyState, PageHeader, Pagination, StatusBadge } from "@/components/admin/ui";
import { CO_TONE, type CustomOrderRow } from "./shared";

export const instant = false;

async function Content({ searchParams }: PageProps<"/admin/custom-orders">) {
  const staff = await requireStaff();
  if (!can(staff, "orders.read")) redirect("/admin");
  const t = getDict(staff.locale), f = fmt(staff.locale), C = t.co;
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const page = Math.max(1, Number(one("page")) || 1);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_custom_orders", {
    p: { q: one("q"), type: one("type"), status: one("status"), from: one("from"), to: one("to"), page, page_size: 25 },
  });
  const res = (data ?? { items: [], total: 0, counts: {} }) as { items: CustomOrderRow[]; total: number; counts: Record<string, number> };

  return (
    <div className="mx-auto max-w-[90rem] space-y-6">
      <PageHeader title={C.title} subtitle={C.subtitle} />

      {/* عدد الطلبات لكل حالة: روابط سريعة للتصفية */}
      <nav aria-label={C.status} className="flex flex-wrap gap-2">
        <Link href="/admin/custom-orders" aria-current={!one("status") ? "true" : undefined} className="a-chip">{t.common.all}</Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/admin/custom-orders?status=${s}`} aria-current={one("status") === s ? "true" : undefined} className="a-chip">
            {C.st[s]} <span className="tabular-nums opacity-70">{f.number(res.counts?.[s] ?? 0)}</span>
          </Link>
        ))}
      </nav>

      <form className="a-card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_repeat(4,minmax(0,1fr))_auto]">
        <label className="block"><span className="a-label">{C.search}</span><input name="q" defaultValue={one("q")} className="a-input" /></label>
        <label className="block"><span className="a-label">{C.type}</span>
          <select name="type" defaultValue={one("type")} className="a-input"><option value="">{t.common.all}</option>{(["curtains", "ceiling", "mattress", "other"] as const).map((k) => <option key={k} value={k}>{C.types[k]}</option>)}</select></label>
        <label className="block"><span className="a-label">{C.status}</span>
          <select name="status" defaultValue={one("status")} className="a-input"><option value="">{t.common.all}</option>{STATUSES.map((s) => <option key={s} value={s}>{C.st[s]}</option>)}</select></label>
        <label className="block"><span className="a-label">{t.common.from}</span><input type="date" name="from" defaultValue={one("from")} className="a-input" /></label>
        <label className="block"><span className="a-label">{t.common.to}</span><input type="date" name="to" defaultValue={one("to")} className="a-input" /></label>
        <div className="flex items-end gap-2"><button className="a-btn a-btn-primary">{t.common.apply}</button><Link href="/admin/custom-orders" className="a-btn a-btn-ghost">{t.common.reset}</Link></div>
      </form>

      {error && <p role="alert" className="a-card p-4 text-[var(--a-danger-ink)]">{t.common.error}</p>}
      <Card bodyClass="">
        {res.items.length === 0 ? <EmptyState icon={<Ruler className="h-5 w-5" />} title={C.empty} /> : (
          <>
            <div className="overflow-x-auto">
              <table className="a-table min-w-[62rem]">
                <thead><tr>{[C.number, C.date, C.type, C.specs, C.customer, C.status, C.price, ""].map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
                <tbody>
                  {res.items.map((o) => (
                    <tr key={o.id} className="align-top">
                      <td><Link href={`/admin/custom-orders/${o.id}`} dir="ltr" className="font-medium tabular-nums hover:text-[var(--a-accent-ink)]">{o.number}</Link></td>
                      <td className="whitespace-nowrap text-xs text-[var(--a-muted-ink)]">{f.dateTime(o.created_at)}</td>
                      <td>{C.types[o.product_type]}</td>
                      <td className="max-w-[22rem] text-xs leading-6 text-[var(--a-muted-ink)]">{specLines(o.product_type, o.specs).slice(0, 2).join(" · ")}</td>
                      <td><span className="block font-medium">{o.customer_name}</span><span dir="ltr" className="text-xs tabular-nums text-[var(--a-muted-ink)]">{formatPhone(o.phone)}</span><span className="block text-xs text-[var(--a-muted-ink)]">{o.area}</span></td>
                      <td><StatusBadge status={CO_TONE[o.status] ?? "received"} label={C.st[o.status as keyof typeof C.st] ?? o.status} /></td>
                      <td className="tabular-nums">{o.final_price !== null ? f.money(o.final_price) : <span className="text-xs text-[var(--a-muted-ink)]">{C.noPrice}</span>}</td>
                      <td><Link href={`/admin/custom-orders/${o.id}`} className="a-btn a-btn-ghost min-h-8 rounded-full px-3 text-xs">{C.view}</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination base="/admin/custom-orders" sp={sp} page={page} pageSize={25} total={res.total} t={t} f={f} />
          </>
        )}
      </Card>
    </div>
  );
}

export default function CustomOrdersPage(props: PageProps<"/admin/custom-orders">) {
  return <Suspense fallback={<PageSkeleton variant="list" />}><Content {...props} /></Suspense>;
}
