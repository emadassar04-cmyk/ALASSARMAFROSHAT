import { Suspense } from "react";
import { PageSkeleton } from "@/components/admin/PageSkeleton";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, can } from "@/lib/staff";
import { getDict, fmt } from "@/lib/admin/i18n";
import { formatPhone } from "@/lib/phone";
import { Card, EmptyState, PageHeader, Pagination, StatusBadge } from "@/components/admin/ui";
import { ApproveAll, RowActions } from "./RowActions";

export const instant = false;

type Item = { id: string; source: "online" | "store"; ref: string | null; phone: string; customer_name: string; amount: number;
  status: string; status_group: string; created_at: string; review_reason: string | null; branch: string | null; created_by_name: string | null };
type Money = { count: number; amount: number };
type Summary = { online_completed: Money; online_open: Money; store_approved: Money; store_pending: Money; by_branch: { branch: string; count: number; amount: number }[] };
const GROUP_TONE: Record<string, string> = { pending: "submitted", completed: "approved", cancelled: "voided" };

const gazaToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Gaza" }).format(new Date());

async function PurchasesPageContent({ searchParams }: PageProps<"/admin/purchases">) {
  const staff = await requireStaff();
  if (!can(staff, "sales.review")) redirect("/admin");
  const t = getDict(staff.locale), f = fmt(staff.locale), P = t.pur;
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const today = gazaToday();
  const from = one("from") || `${today.slice(0, 8)}01`;
  const to = one("to") || today;
  const page = Math.max(1, Number(one("page")) || 1);

  const supabase = await createClient();
  const [{ data: list }, { data: summary }, { data: branches }] = await Promise.all([
    supabase.rpc("admin_purchases", { p: { source: one("source"), branch_id: one("branch"), phone: one("phone"), status_group: one("status"), from, to, page, page_size: 25 } }),
    supabase.rpc("purchases_summary", { p_from: from, p_to: to }),
    supabase.from("branches").select("id, name").eq("is_active", true).order("is_default", { ascending: false }).order("sort_order"),
  ]);
  const res = (list ?? { items: [], total: 0 }) as { items: Item[]; total: number; invalid_phone?: boolean };
  const s = summary as Summary | null;
  const branchIdByName = new Map((branches ?? []).map((b) => [b.name, b.id]));
  const pendingIds = res.items.filter((i) => i.source === "store" && i.status === "submitted").map((i) => i.id);
  const statusLabel = (i: Item) => (i.source === "store" ? P.st[i.status] : t.status[i.status as keyof typeof t.status]) ?? i.status;

  return (
    <div className="mx-auto max-w-[90rem] space-y-6">
      <PageHeader title={P.title} subtitle={P.subtitle} actions={can(staff, "sales.record") && <Link href="/admin/sales" className="a-btn a-btn-primary"><Plus aria-hidden="true" className="h-4 w-4" />{P.record}</Link>} />

      {s && (
        <section aria-label={t.rep.summary} className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {([[P.onlineDone, s.online_completed], [P.onlineOpen, s.online_open], [P.storeApproved, s.store_approved], [P.storePending, s.store_pending]] as const).map(([label, m]) => (
            <div key={label} className="a-card p-4">
              <p className="text-[0.8125rem] font-medium text-[var(--a-muted-ink)]">{label}</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{f.money(m.amount)}</p>
              <p className="text-xs text-[var(--a-muted-ink)]">{f.number(m.count)} {P.ops}</p>
            </div>
          ))}
          {s.by_branch.map((b) => (
            <div key={b.branch} className="a-card bg-[#fbf8f2] p-4">
              <p className="text-xs text-[var(--a-muted-ink)]">{b.branch} {P.approvedSuffix}</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{f.money(b.amount)}</p>
              <p className="text-xs text-[var(--a-muted-ink)]">{f.number(b.count)} {P.ops}</p>
            </div>
          ))}
        </section>
      )}

      <form className="a-card grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-[repeat(6,minmax(0,1fr))_auto]">
        <label className="block"><span className="a-label">{P.phone}</span><input name="phone" defaultValue={one("phone")} dir="ltr" inputMode="tel" placeholder="0599…" className="a-input" /></label>
        <label className="block"><span className="a-label">{P.source}</span>
          <select name="source" defaultValue={one("source")} className="a-input"><option value="">{t.common.all}</option><option value="online">{P.online}</option><option value="store">{P.stores}</option></select></label>
        <label className="block"><span className="a-label">{P.branch}</span>
          <select name="branch" defaultValue={one("branch")} className="a-input"><option value="">{t.common.all}</option>{(branches ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label className="block"><span className="a-label">{P.status}</span>
          <select name="status" defaultValue={one("status")} className="a-input"><option value="">{t.common.all}</option><option value="pending">{P.pendingG}</option><option value="completed">{P.completedG}</option><option value="cancelled">{P.cancelledG}</option></select></label>
        <label className="block"><span className="a-label">{t.common.from}</span><input type="date" name="from" defaultValue={from} className="a-input" /></label>
        <label className="block"><span className="a-label">{t.common.to}</span><input type="date" name="to" defaultValue={to} className="a-input" /></label>
        <div className="flex items-end gap-2"><button className="a-btn a-btn-primary">{t.common.apply}</button><Link href="/admin/purchases" className="a-btn a-btn-ghost">{t.common.reset}</Link></div>
      </form>

      {res.invalid_phone && <p role="alert" className="a-card border-[#ecd9b8] bg-[#fffaf1] p-3 text-sm text-[var(--a-warning)]">{P.invalidPhone}</p>}
      <ApproveAll ids={pendingIds} />

      <Card bodyClass="">
        {res.items.length === 0 ? <EmptyState icon={<ClipboardCheck className="h-5 w-5" />} title={P.empty} /> : (
          <>
            <div className="overflow-x-auto">
              <table className="a-table min-w-[60rem]">
                <thead><tr>{[P.date, P.customer, P.source, P.branch, P.amount, P.status, P.by, P.action].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
                <tbody>
                  {res.items.map((i) => (
                    <tr key={`${i.source}-${i.id}`} className="align-top">
                      <td className="whitespace-nowrap text-xs text-[var(--a-muted-ink)]">{f.dateTime(i.created_at)}</td>
                      <td><Link href={`/admin/purchases?phone=${i.phone}`} dir="ltr" className="block text-end font-medium tabular-nums hover:text-[var(--a-accent-ink)] rtl:text-start">{formatPhone(i.phone)}</Link><span className="text-xs text-[var(--a-muted-ink)]">{i.customer_name}</span></td>
                      <td>{i.source === "online" ? <Link href={`/admin/orders?q=${i.ref}`} className="hover:underline">{P.online} <span dir="ltr" className="text-xs text-[var(--a-muted-ink)]">{i.ref}</span></Link> : P.store}</td>
                      <td>{i.branch ?? "—"}</td>
                      <td className="font-semibold tabular-nums">{f.money(i.amount)}</td>
                      <td><StatusBadge status={GROUP_TONE[i.status_group] ?? "unpaid"} label={statusLabel(i)} />
                        {i.review_reason && <span className="mt-1 block text-xs text-[var(--a-muted-ink)]">{P.reason}: {i.review_reason}</span>}</td>
                      <td className="text-xs">{i.source === "store" ? i.created_by_name ?? "—" : P.theCustomer}</td>
                      <td>{i.source === "store" && <RowActions id={i.id} status={i.status} amount={i.amount} branchId={i.branch ? branchIdByName.get(i.branch) ?? null : null} branches={branches ?? []} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination base="/admin/purchases" sp={sp} page={page} pageSize={25} total={res.total} t={t} f={f} />
          </>
        )}
      </Card>
    </div>
  );
}

// الصفحة تُعرض فوراً بهيكل تحميل، ثم يتدفق المحتوى (تنقل سلس دون انتظار الخادم)
export default function PurchasesPage(props: PageProps<"/admin/purchases">) {
  return <Suspense fallback={<PageSkeleton variant="list" />}><PurchasesPageContent {...props} /></Suspense>;
}
