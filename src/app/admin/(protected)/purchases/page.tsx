import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { formatPrice } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { ORDER_STATUS_LABEL } from "@/lib/catalog-types";
import { ApproveAll, RowActions } from "./RowActions";

export const instant = false;

type Item = { id: string; source: "online" | "store"; ref: string | null; phone: string; customer_name: string; amount: number;
  status: string; status_group: string; created_at: string; review_reason: string | null; branch: string | null; created_by_name: string | null };
type Money = { count: number; amount: number };
type Summary = { online_completed: Money; online_open: Money; store_approved: Money; store_pending: Money; by_branch: { branch: string; count: number; amount: number }[] };

const STORE_STATUS: Record<string, string> = { submitted: "بانتظار الاعتماد", approved: "معتمدة", rejected: "مرفوضة", voided: "ملغاة" };
const GROUP_STYLE: Record<string, string> = { pending: "bg-amber-50 text-amber-800", completed: "bg-emerald-50 text-emerald-800", cancelled: "bg-stone-100 text-stone-600" };

const gazaToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Gaza" }).format(new Date());

export default async function PurchasesPage({ searchParams }: PageProps<"/admin/purchases">) {
  const staff = await requireStaff();
  if (!staff.permissions.includes("sales.review")) redirect("/admin");
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const today = gazaToday();
  const monthStart = `${today.slice(0, 8)}01`;
  const from = one("from") || monthStart;
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
  const pages = Math.max(1, Math.ceil(res.total / 25));
  const branchIdByName = new Map((branches ?? []).map((b) => [b.name, b.id]));
  const pendingIds = res.items.filter((i) => i.source === "store" && i.status === "submitted").map((i) => i.id);
  const qs = (p: number) => { const q = new URLSearchParams(); for (const k of ["source", "branch", "phone", "status", "from", "to"]) if (one(k)) q.set(k, one(k)); if (p > 1) q.set("page", String(p)); return `?${q}`; };
  const field = "rounded-md border border-gold/30 bg-white px-2 py-1.5 text-sm";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold">المشتريات (أونلاين + الفروع)</h1>
        <Link href="/admin/sales" className="rounded-lg bg-charcoal px-4 py-2 text-sm text-white">＋ تسجيل بيع في الفرع</Link>
      </div>

      {s && (
        <section aria-label="ملخص الفترة" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["أونلاين مكتملة (تم التسليم)", s.online_completed],
            ["أونلاين قيد التنفيذ", s.online_open],
            ["الفروع (معتمدة)", s.store_approved],
            ["الفروع بانتظار الاعتماد (الكل)", s.store_pending],
          ].map(([label, m]) => (
            <div key={label as string} className="rounded-2xl border border-gold/20 bg-white p-4">
              <p className="text-xs opacity-70">{label as string}</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{formatPrice((m as Money).amount)}</p>
              <p className="text-xs opacity-70">{(m as Money).count} عملية</p>
            </div>
          ))}
          {s.by_branch.map((b) => (
            <div key={b.branch} className="rounded-2xl border border-gold/20 bg-beige/40 p-4">
              <p className="text-xs opacity-70">{b.branch} (معتمدة)</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{formatPrice(b.amount)}</p>
              <p className="text-xs opacity-70">{b.count} عملية</p>
            </div>
          ))}
        </section>
      )}

      <form className="flex flex-wrap items-end gap-2 rounded-2xl border border-gold/20 bg-white p-4 text-sm">
        <label className="space-y-1"><span className="block text-xs">رقم الجوال</span><input name="phone" defaultValue={one("phone")} dir="ltr" inputMode="tel" placeholder="0599…" className={`${field} w-36`} /></label>
        <label className="space-y-1"><span className="block text-xs">المصدر</span>
          <select name="source" defaultValue={one("source")} className={field}><option value="">الكل</option><option value="online">أونلاين</option><option value="store">الفروع</option></select></label>
        <label className="space-y-1"><span className="block text-xs">الفرع</span>
          <select name="branch" defaultValue={one("branch")} className={field}><option value="">الكل</option>{(branches ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label className="space-y-1"><span className="block text-xs">الحالة</span>
          <select name="status" defaultValue={one("status")} className={field}><option value="">الكل</option><option value="pending">بانتظار / قيد التنفيذ</option><option value="completed">مكتملة / معتمدة</option><option value="cancelled">ملغاة / مرفوضة</option></select></label>
        <label className="space-y-1"><span className="block text-xs">من</span><input type="date" name="from" defaultValue={from} className={field} /></label>
        <label className="space-y-1"><span className="block text-xs">إلى</span><input type="date" name="to" defaultValue={to} className={field} /></label>
        <button className="rounded-md bg-charcoal px-4 py-1.5 text-white">عرض</button>
        <Link href="/admin/purchases" className="px-2 py-1.5 underline">مسح</Link>
      </form>

      {res.invalid_phone && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">رقم الجوال غير صحيح. اكتبه هكذا: 0599123456</p>}
      <ApproveAll ids={pendingIds} />

      <p className="text-sm opacity-70">{res.total} عملية</p>
      <div className="overflow-x-auto rounded-2xl border border-gold/20 bg-white">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className="bg-beige/60 text-right">
            <tr>{["التاريخ", "الزبون", "المصدر", "الفرع", "المبلغ", "الحالة", "سجّلها", "إجراء"].map((h) => <th key={h} scope="col" className="p-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {res.items.length === 0 && <tr><td colSpan={8} className="p-8 text-center opacity-70">لا توجد مشتريات بهذه الفلاتر.</td></tr>}
            {res.items.map((i) => (
              <tr key={`${i.source}-${i.id}`} className="border-t border-gold/10 align-top">
                <td className="p-3 text-xs" dir="ltr">{new Date(i.created_at).toLocaleString("ar", { timeZone: "Asia/Gaza", numberingSystem: "latn", dateStyle: "short", timeStyle: "short" })}</td>
                <td className="p-3"><Link href={`/admin/purchases?phone=${i.phone}`} dir="ltr" className="block tabular-nums text-gold-dark hover:underline">{formatPhone(i.phone)}</Link><span className="text-xs opacity-70">{i.customer_name}</span></td>
                <td className="p-3">{i.source === "online" ? <Link href={`/admin/orders?q=${i.ref}`} className="hover:underline">أونلاين <span dir="ltr" className="text-xs opacity-70">{i.ref}</span></Link> : "الفرع"}</td>
                <td className="p-3">{i.branch ?? "—"}</td>
                <td className="p-3 font-medium tabular-nums">{formatPrice(i.amount)}</td>
                <td className="p-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${GROUP_STYLE[i.status_group]}`}>{i.source === "store" ? STORE_STATUS[i.status] : ORDER_STATUS_LABEL[i.status] ?? i.status}</span>
                  {i.review_reason && <span className="mt-1 block text-xs opacity-70">السبب: {i.review_reason}</span>}
                </td>
                <td className="p-3 text-xs">{i.source === "store" ? i.created_by_name ?? "—" : "الزبون"}</td>
                <td className="p-3">{i.source === "store" && <RowActions id={i.id} status={i.status} amount={i.amount} branchId={i.branch ? branchIdByName.get(i.branch) ?? null : null} branches={branches ?? []} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav aria-label="الصفحات" className="flex flex-wrap justify-center gap-2">
          {Array.from({ length: pages }, (_, k) => k + 1).map((p) => (
            <Link key={p} href={qs(p)} aria-current={p === page ? "page" : undefined}
              className={`min-w-9 rounded-md border px-3 py-1.5 text-center text-sm ${p === page ? "border-charcoal bg-charcoal text-white" : "border-gold/30 bg-white"}`}>{p}</Link>
          ))}
        </nav>
      )}
    </div>
  );
}
