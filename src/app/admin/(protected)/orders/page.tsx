import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { canonicalPhone } from "@/lib/phone";
import { requireStaff } from "@/lib/staff";
import { formatPrice } from "@/lib/format";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/catalog-types";

export const instant = false;

const STATUSES = ["received", "awaiting_confirmation", "confirmed", "preparing", "ready_for_pickup", "out_for_delivery", "delivered", "cancelled"];
const KANBAN = STATUSES.filter((s) => s !== "cancelled" && s !== "delivered");

type Row = {
  id: string; order_number: string; customer_name: string; customer_phone: string; status: string; fulfillment: string;
  payment_method: string; payment_status: string; total: string; created_at: string; reservation_expires_at: string | null;
};

// وقت الطلب الحالي (الصفحة ديناميكية تُعرض عند كل طلب)
async function requestTime() {
  return Date.now();
}

function Expiry({ at, status, now }: { at: string | null; status: string; now: number }) {
  if (!at || !["received", "awaiting_confirmation"].includes(status)) return null;
  const mins = Math.round((new Date(at).getTime() - now) / 60000);
  return <span className={`text-xs ${mins < 30 ? "text-red-700" : "opacity-70"}`}>{mins > 0 ? `الحجز ينتهي خلال ${mins} د` : "انتهى الحجز"}</span>;
}

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireStaff();
  const sp = await searchParams;
  const view = sp.view === "kanban" ? "kanban" : "table";
  const status = typeof sp.status === "string" && STATUSES.includes(sp.status) ? sp.status : "";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 40) : "";

  const supabase = await createClient();
  let query = supabase.from("orders")
    .select("id, order_number, customer_name, customer_phone, status, fulfillment, payment_method, payment_status, total, created_at, reservation_expires_at")
    .order("created_at", { ascending: false }).limit(view === "kanban" ? 300 : 100);
  if (status) query = query.eq("status", status);
  if (view === "kanban") query = query.in("status", KANBAN);
  if (q) {
    const safe = q.replace(/[%_,()]/g, "");
    query = /^\d+$/.test(safe) || safe.toUpperCase().startsWith("ALS")
      ? query.or(`order_number.ilike.%${safe}%,customer_phone.ilike.%${(canonicalPhone(safe) ?? safe).replace(/\D/g, "")}%`)
      : query.ilike("customer_name", `%${safe}%`);
  }
  const [{ data, error }, now] = await Promise.all([query, requestTime()]);
  const rows = (data ?? []) as Row[];
  const tab = (v: string) => `rounded-lg px-3 py-1.5 text-sm ${view === v ? "bg-charcoal text-white" : "border border-gold/30 bg-white"}`;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">الطلبات</h1>
        <div className="flex gap-2">
          <Link href="/admin/orders" className={tab("table")}>جدول</Link>
          <Link href="/admin/orders?view=kanban" className={tab("kanban")}>Kanban</Link>
        </div>
      </div>
      <form className="flex flex-wrap gap-2">
        {view === "kanban" && <input type="hidden" name="view" value="kanban" />}
        <input name="q" defaultValue={q} placeholder="رقم الطلب أو الهاتف أو الاسم" className="rounded-lg border border-gold/30 px-3 py-2 text-sm" />
        {view === "table" && (
          <select name="status" defaultValue={status} className="rounded-lg border border-gold/30 px-3 py-2 text-sm">
            <option value="">كل الحالات</option>
            {STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}
          </select>
        )}
        <button className="rounded-lg border border-gold/30 px-3 py-2 text-sm hover:bg-beige">بحث</button>
      </form>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">تعذر تحميل الطلبات.</p>}

      {view === "table" ? (
        rows.length === 0 ? <p className="rounded-2xl border border-dashed border-gold/40 bg-white p-10 text-center">لا توجد طلبات.</p> : (
          <div className="overflow-x-auto rounded-2xl border border-gold/20 bg-white">
            <table className="w-full min-w-[48rem] text-sm">
              <thead className="bg-beige/60"><tr>
                <th className="p-3 text-start">الطلب</th><th className="p-3 text-start">الزبون</th><th className="p-3 text-start">الحالة</th>
                <th className="p-3 text-start">الاستلام</th><th className="p-3 text-start">الدفع</th><th className="p-3 text-start">الإجمالي</th>
              </tr></thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id} className="border-t border-gold/10 align-top">
                    <td className="p-3"><Link href={`/admin/orders/${o.id}`} dir="ltr" className="font-medium text-gold-dark hover:underline">{o.order_number}</Link>
                      <span className="block text-xs opacity-60">{new Date(o.created_at).toLocaleString("ar", { numberingSystem: "latn", timeZone: "Asia/Gaza" })}</span></td>
                    <td className="p-3">{o.customer_name}<span dir="ltr" className="block text-xs opacity-70">{o.customer_phone}</span></td>
                    <td className="p-3">{ORDER_STATUS_LABEL[o.status]}<br /><Expiry at={o.reservation_expires_at} status={o.status} now={now} /></td>
                    <td className="p-3">{o.fulfillment === "delivery" ? "توصيل" : "استلام"}</td>
                    <td className={`p-3 ${o.payment_status === "awaiting_review" ? "text-amber-700" : ""}`}>{PAYMENT_STATUS_LABEL[o.payment_status]}</td>
                    <td className="p-3 font-medium">{formatPrice(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {KANBAN.map((s) => {
            const col = rows.filter((o) => o.status === s);
            return (
              <section key={s} className="w-64 shrink-0 rounded-2xl bg-beige/60 p-2" aria-label={ORDER_STATUS_LABEL[s]}>
                <h2 className="mb-2 px-1 text-sm font-bold">{ORDER_STATUS_LABEL[s]} <span className="opacity-60">({col.length})</span></h2>
                <ul className="space-y-2">
                  {col.map((o) => (
                    <li key={o.id}>
                      <Link href={`/admin/orders/${o.id}`} className="block space-y-1 rounded-xl border border-gold/20 bg-white p-3 text-sm hover:border-gold">
                        <span className="flex justify-between"><span dir="ltr" className="font-medium">{o.order_number}</span><span>{formatPrice(o.total)}</span></span>
                        <span className="block">{o.customer_name}</span>
                        <span className="block text-xs opacity-70">{o.fulfillment === "delivery" ? "توصيل" : "استلام من المحل"} · {PAYMENT_STATUS_LABEL[o.payment_status]}</span>
                        <Expiry at={o.reservation_expires_at} status={o.status} now={now} />
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
