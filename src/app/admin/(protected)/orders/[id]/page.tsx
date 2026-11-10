import { Suspense } from "react";
import { PageSkeleton } from "@/components/admin/PageSkeleton";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MessageCircle, Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, can } from "@/lib/staff";
import { whatsappLink } from "@/lib/format";
import { getDict, fmt } from "@/lib/admin/i18n";
import { Card, StatusBadge } from "@/components/admin/ui";
import { variantText } from "@/lib/admin/orders";
import { AddressEdit, NoteForm, ProfitInput, StatusActions, TransferReview } from "./OrderActions";

export const instant = false;

type Item = { id: string; product_name_snapshot: string; variant_snapshot: Record<string, string>; customer_notes: string | null;
  quantity: number; unit_price_snapshot: string; unit_cost_snapshot: string | null; discount_amount: string; net_line_amount: string;
  manager_profit_amount: string | null; store_due_amount: string | null };

async function OrderDetailContent({ params }: PageProps<"/admin/orders/[id]">) {
  const staff = await requireStaff();
  const t = getDict(staff.locale), f = fmt(staff.locale);
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
  const canFinance = can(staff, "finance.read");
  const canManage = can(staff, "orders.manage");
  const confirmed = !["received", "awaiting_confirmation", "cancelled"].includes(o.status);
  const sum = (k: keyof Item) => lines.reduce((s, l) => s + Number(l[k] ?? 0), 0);
  const profitMissing = lines.some((l) => l.manager_profit_amount === null);
  const wa = whatsappLink(o.customer_phone, `مرحباً ${o.customer_name}، بخصوص طلبك رقم ${o.order_number} من مفروشات العصار`);
  const label = (s: string) => t.status[s as keyof typeof t.status] ?? s;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/admin/orders" className="inline-flex items-center gap-1.5 text-sm text-[var(--a-muted-ink)] hover:text-[var(--a-text)]">
        <ArrowRight aria-hidden="true" className="h-4 w-4 ltr:rotate-180" />{t.od.back}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[1.75rem]" dir="ltr">{o.order_number}</h1>
            <StatusBadge status={o.status} label={label(o.status)} />
            <StatusBadge status={o.payment_status} label={t.paymentStatus[o.payment_status as keyof typeof t.paymentStatus]} />
          </div>
          <p className="mt-1 text-sm text-[var(--a-muted-ink)]">{f.dateTime(o.created_at)} · {t.od.source}: {o.source ?? "—"}</p>
        </div>
        <Link href={`/admin/orders/${o.id}/invoice`} className="a-btn a-btn-ghost"><Printer aria-hidden="true" className="h-4 w-4" />{t.orders.invoice}</Link>
      </div>

      {canManage && (
        <Card title={t.od.actions}>
          <div className="space-y-3">
            {o.reservation_expires_at && ["received", "awaiting_confirmation"].includes(o.status) && (
              <p className="text-sm">{t.od.reservationEnds}: <strong>{f.dateTime(o.reservation_expires_at)}</strong> — {t.od.autoCancel}</p>
            )}
            <StatusActions id={o.id} status={o.status} fulfillment={o.fulfillment} />
            {o.payment_method === "bank_transfer" && ["awaiting_review", "rejected"].includes(o.payment_status) && o.status !== "cancelled" && <TransferReview id={o.id} />}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card title={t.od.customer}>
          <div className="space-y-2 text-sm">
            <p className="font-semibold">{o.customer_name}</p>
            <p dir="ltr" className="text-end tabular-nums rtl:text-start">{o.customer_phone}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="a-btn a-btn-ghost"><MessageCircle aria-hidden="true" className="h-4 w-4 text-[#1f7a4d]" />{t.od.whatsapp}</a>}
              <Link href={`/admin/customers/${o.customer_id}`} className="a-btn a-btn-ghost">{t.od.profile}</Link>
            </div>
            {o.customer_notes && <p className="rounded-[10px] bg-[#faf8f4] p-3">{t.od.customerNote}: {o.customer_notes}</p>}
          </div>
        </Card>
        <Card title={t.od.fulfilment}>
          <div className="space-y-2 text-sm">
            <p>{o.fulfillment === "delivery" ? `${t.od.deliveryTo}: ${o.delivery_zones?.name ?? ""}` : t.od.pickup}</p>
            {o.fulfillment === "delivery" && (canManage ? <AddressEdit id={o.id} address={o.address ?? ""} /> : <p>{o.address}</p>)}
            <p>{t.orders.payment}: {t.payment[o.payment_method as keyof typeof t.payment]}</p>
          </div>
        </Card>
      </div>

      <Card title={<>{t.od.items}{canFinance && <span className="ms-2 text-xs font-normal text-[var(--a-muted-ink)]">({t.od.secret})</span>}</>} bodyClass="">
        <div className="overflow-x-auto">
          <table className="a-table min-w-[44rem]">
            <thead><tr>
              <th scope="col">{t.invoice.item}</th><th scope="col">{t.od.qty}</th><th scope="col">{t.od.price}</th><th scope="col">{t.od.discount}</th><th scope="col">{t.od.net}</th>
              {canFinance && <><th scope="col">{t.od.cost}</th><th scope="col">{t.od.profit}</th><th scope="col">{t.od.due}</th></>}
            </tr></thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="align-top">
                  <td>{l.product_name_snapshot}
                    <span className="block text-xs text-[var(--a-muted-ink)]">{variantText(l.variant_snapshot)}</span>
                    {l.customer_notes && <span className="block text-xs text-[var(--a-accent-ink)]">{l.customer_notes}</span>}</td>
                  <td className="tabular-nums">{f.number(l.quantity)}</td>
                  <td className="tabular-nums">{f.money(l.unit_price_snapshot)}</td>
                  <td className="tabular-nums">{Number(l.discount_amount) ? f.money(l.discount_amount) : "—"}</td>
                  <td className="font-semibold tabular-nums">{f.money(l.net_line_amount)}</td>
                  {canFinance && <>
                    <td className="tabular-nums">{l.unit_cost_snapshot ? f.money(Number(l.unit_cost_snapshot) * l.quantity) : "—"}</td>
                    <td>{can(staff, "finance.manage") ? <ProfitInput itemId={l.id} current={l.manager_profit_amount} net={l.net_line_amount} disabled={!confirmed} /> : l.manager_profit_amount !== null ? f.money(l.manager_profit_amount) : "—"}</td>
                    <td className="tabular-nums">{l.store_due_amount !== null ? f.money(l.store_due_amount) : "—"}</td>
                  </>}
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="font-semibold">
              <td className="px-4 py-3" colSpan={4}>{t.od.sum}</td><td className="px-4 py-3 tabular-nums">{f.money(sum("net_line_amount"))}</td>
              {canFinance && <><td /><td className="px-4 py-3 tabular-nums">{f.money(sum("manager_profit_amount"))}</td><td className="px-4 py-3 tabular-nums">{f.money(sum("store_due_amount"))}</td></>}
            </tr></tfoot>
          </table>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4 border-t border-[var(--a-line)] px-5 py-4">
          {canFinance && confirmed && profitMissing ? <p className="text-sm text-[var(--a-warning)]">{t.od.profitHint}</p> : <span />}
          <dl className="grid min-w-56 grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <dt className="text-[var(--a-muted-ink)]">{t.od.subtotal}</dt><dd className="text-end tabular-nums">{f.money(o.subtotal)}</dd>
            {Number(o.discount_total) > 0 && <><dt className="text-[var(--a-muted-ink)]">{t.od.discount} {o.coupons?.code ? `(${o.coupons.code})` : ""}</dt><dd className="text-end tabular-nums">− {f.money(o.discount_total)}</dd></>}
            <dt className="text-[var(--a-muted-ink)]">{t.od.delivery}</dt><dd className="text-end tabular-nums">{f.money(o.delivery_fee)}</dd>
            <dt className="font-bold">{t.od.total}</dt><dd className="text-end text-base font-bold tabular-nums">{f.money(o.total)}</dd>
          </dl>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card title={t.od.timeline}>
          <ol className="relative space-y-4 border-s border-[var(--a-line)] ps-5 text-sm">
            {(history ?? []).map((h, i) => (
              <li key={i} className="relative">
                <span aria-hidden="true" className={`absolute -start-[1.65rem] top-1 h-3 w-3 rounded-full ring-4 ring-white ${i === (history ?? []).length - 1 ? "bg-[var(--a-accent)]" : "bg-[#d6d0c4]"}`} />
                <p className="font-semibold">{label(h.to_status)}</p>
                <p className="text-xs text-[var(--a-muted-ink)]">{f.dateTime(h.created_at)}{h.note ? ` · ${h.note}` : ""}</p>
              </li>
            ))}
          </ol>
        </Card>
        <Card title={t.od.notes}>
          <div className="space-y-3 text-sm">
            {canManage && <NoteForm id={o.id} />}
            <ul className="space-y-2">{(notes ?? []).map((n, i) => (
              <li key={i} className="rounded-[10px] bg-[#faf8f4] p-3"><span className="block text-xs text-[var(--a-muted-ink)]">{f.dateTime(n.created_at)}</span>{n.body}</li>))}
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}

// الصفحة تُعرض فوراً بهيكل تحميل، ثم يتدفق المحتوى (تنقل سلس دون انتظار الخادم)
export default function OrderDetail(props: PageProps<"/admin/orders/[id]">) {
  return <Suspense fallback={<PageSkeleton variant="form" />}><OrderDetailContent {...props} /></Suspense>;
}
