import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { formatPrice, whatsappLink } from "@/lib/format";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/catalog-types";
import { AddressEdit, NoteForm, ProfitInput, StatusActions, TransferReview } from "./OrderActions";

export const instant = false;

const PAYMENT: Record<string, string> = { cash_on_delivery: "نقداً عند الاستلام", cash_in_store: "نقداً في المحل", bank_transfer: "تحويل بنكي" };
const dt = (s: string) => new Date(s).toLocaleString("ar", { numberingSystem: "latn", timeZone: "Asia/Gaza", dateStyle: "short", timeStyle: "short" });

type Item = { id: string; product_name_snapshot: string; variant_snapshot: Record<string, string>; customer_notes: string | null;
  quantity: number; unit_price_snapshot: string; unit_cost_snapshot: string | null; discount_amount: string; net_line_amount: string;
  manager_profit_amount: string | null; store_due_amount: string | null };

export default async function OrderDetail({ params }: PageProps<"/admin/orders/[id]">) {
  const staff = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: o }, { data: items }, { data: history }, { data: notes }] = await Promise.all([
    supabase.from("orders").select("*, delivery_zones(name), coupons(code)").eq("id", id).single(),
    supabase.from("order_items").select("*").eq("order_id", id).order("created_at"),
    supabase.from("order_status_history").select("from_status, to_status, note, created_at").eq("order_id", id).order("created_at"),
    supabase.from("order_notes").select("body, created_at").eq("order_id", id).order("created_at", { ascending: false }),
  ]);
  if (!o) notFound();
  const lines = (items ?? []) as Item[];
  const canFinance = staff.permissions.includes("finance.read");
  const confirmed = !["received", "awaiting_confirmation", "cancelled"].includes(o.status);
  const sum = (k: keyof Item) => lines.reduce((s, l) => s + Number(l[k] ?? 0), 0);
  const profitMissing = lines.some((l) => l.manager_profit_amount === null);
  const wa = whatsappLink(o.customer_phone, `مرحباً ${o.customer_name}، بخصوص طلبك رقم ${o.order_number} من مفروشات العصار`);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link href="/admin/orders" className="text-sm text-gold-dark hover:underline">→ الطلبات</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" dir="ltr">{o.order_number}</h1>
          <p className="text-sm opacity-70">{dt(o.created_at)} · المصدر: {o.source ?? "—"}</p>
        </div>
        <span className="rounded-full bg-beige px-3 py-1 text-sm font-medium">{ORDER_STATUS_LABEL[o.status]}</span>
      </div>

      <section className="space-y-3 rounded-2xl border border-gold/20 bg-white p-5">
        <h2 className="font-bold">الإجراءات</h2>
        {o.reservation_expires_at && ["received", "awaiting_confirmation"].includes(o.status) && (
          <p className="text-sm">الحجز ينتهي: <strong>{dt(o.reservation_expires_at)}</strong> (يُلغى الطلب تلقائياً إن لم يُؤكَّد).</p>
        )}
        <StatusActions id={o.id} status={o.status} fulfillment={o.fulfillment} />
        {o.payment_method === "bank_transfer" && ["awaiting_review", "rejected"].includes(o.payment_status) && o.status !== "cancelled" && <TransferReview id={o.id} />}
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="space-y-2 rounded-2xl border border-gold/20 bg-white p-5 text-sm">
          <h2 className="font-bold">الزبون</h2>
          <p>{o.customer_name}</p>
          <p dir="ltr" className="text-right">{o.customer_phone}</p>
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-block rounded-lg bg-[#25D366] px-3 py-1.5 text-white">مراسلة عبر WhatsApp</a>}
          {o.customer_notes && <p className="rounded-lg bg-beige p-2">ملاحظة الزبون: {o.customer_notes}</p>}
        </section>
        <section className="space-y-2 rounded-2xl border border-gold/20 bg-white p-5 text-sm">
          <h2 className="font-bold">الاستلام والدفع</h2>
          <p>{o.fulfillment === "delivery" ? `توصيل — ${o.delivery_zones?.name ?? ""}` : "استلام من المحل"}</p>
          {o.fulfillment === "delivery" && <AddressEdit id={o.id} address={o.address ?? ""} />}
          <p>الدفع: {PAYMENT[o.payment_method]} — <span className={o.payment_status === "awaiting_review" ? "text-amber-700" : ""}>{PAYMENT_STATUS_LABEL[o.payment_status]}</span></p>
        </section>
      </div>

      <section className="space-y-3 rounded-2xl border border-gold/20 bg-white p-5">
        <h2 className="font-bold">المنتجات {canFinance && <span className="text-xs font-normal opacity-60">(التكلفة والربح والمستحقات سرية — لا يراها الزبون)</span>}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-beige/60"><tr>
              <th className="p-2 text-start">المنتج</th><th className="p-2">الكمية</th><th className="p-2">السعر</th><th className="p-2">الخصم</th><th className="p-2">الصافي</th>
              {canFinance && <><th className="p-2">التكلفة</th><th className="p-2">ربحك</th><th className="p-2">مستحق المحل</th></>}
            </tr></thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-t border-gold/10 align-top">
                  <td className="p-2">{l.product_name_snapshot}
                    <span className="block text-xs opacity-70">{Object.entries(l.variant_snapshot ?? {}).filter(([k, v]) => !(k === "name" && v === "افتراضي")).map(([, v]) => v).join(" · ")}</span>
                    {l.customer_notes && <span className="block text-xs text-gold-dark">{l.customer_notes}</span>}</td>
                  <td className="p-2 text-center">{l.quantity}</td>
                  <td className="p-2 text-center">{formatPrice(l.unit_price_snapshot)}</td>
                  <td className="p-2 text-center">{Number(l.discount_amount) ? formatPrice(l.discount_amount) : "—"}</td>
                  <td className="p-2 text-center font-medium">{formatPrice(l.net_line_amount)}</td>
                  {canFinance && <>
                    <td className="p-2 text-center">{l.unit_cost_snapshot ? formatPrice(Number(l.unit_cost_snapshot) * l.quantity) : "—"}</td>
                    <td className="p-2"><ProfitInput itemId={l.id} current={l.manager_profit_amount} net={l.net_line_amount} disabled={!confirmed} /></td>
                    <td className="p-2 text-center">{l.store_due_amount !== null ? formatPrice(l.store_due_amount) : "—"}</td>
                  </>}
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gold/30 font-medium">
              <tr>
                <td className="p-2" colSpan={4}>المجموع</td><td className="p-2 text-center">{formatPrice(sum("net_line_amount"))}</td>
                {canFinance && <><td /><td className="p-2 text-center">{formatPrice(sum("manager_profit_amount"))}</td><td className="p-2 text-center">{formatPrice(sum("store_due_amount"))}</td></>}
              </tr>
            </tfoot>
          </table>
        </div>
        {canFinance && confirmed && profitMissing && <p className="text-sm text-amber-700">سجّل ربحك لكل بند حتى تظهر مستحقات المحل في التقارير.</p>}
        <dl className="grid max-w-xs grid-cols-2 gap-1 text-sm">
          <dt>المنتجات</dt><dd>{formatPrice(o.subtotal)}</dd>
          {Number(o.discount_total) > 0 && <><dt>الخصم {o.coupons?.code ? `(${o.coupons.code})` : ""}</dt><dd>− {formatPrice(o.discount_total)}</dd></>}
          <dt>التوصيل</dt><dd>{formatPrice(o.delivery_fee)}</dd>
          <dt className="font-bold">الإجمالي</dt><dd className="font-bold">{formatPrice(o.total)}</dd>
        </dl>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="space-y-2 rounded-2xl border border-gold/20 bg-white p-5 text-sm">
          <h2 className="font-bold">سجل الحالات</h2>
          <ol className="space-y-1">
            {(history ?? []).map((h, i) => (
              <li key={i}><span className="opacity-60">{dt(h.created_at)}</span> — {ORDER_STATUS_LABEL[h.to_status]}{h.note ? ` (${h.note})` : ""}</li>
            ))}
          </ol>
        </section>
        <section className="space-y-2 rounded-2xl border border-gold/20 bg-white p-5 text-sm">
          <h2 className="font-bold">ملاحظات داخلية</h2>
          <NoteForm id={o.id} />
          <ul className="space-y-1">{(notes ?? []).map((n, i) => <li key={i} className="rounded bg-beige/60 p-2"><span className="block text-xs opacity-60">{dt(n.created_at)}</span>{n.body}</li>)}</ul>
        </section>
      </div>
    </div>
  );
}
