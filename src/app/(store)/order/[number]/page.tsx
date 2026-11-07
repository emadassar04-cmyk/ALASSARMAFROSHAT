import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getStoreSettings, trackOrder } from "@/lib/catalog";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/catalog-types";
import { formatPrice, whatsappLink } from "@/lib/format";
import { WhatsAppIcon } from "@/components/store/WhatsAppFloat";

export const metadata: Metadata = { title: "طلبك", robots: { index: false, follow: false } };

const FLOW_DELIVERY = ["received", "confirmed", "preparing", "out_for_delivery", "delivered"];
const FLOW_PICKUP = ["received", "confirmed", "preparing", "ready_for_pickup", "delivered"];
const PAYMENT_LABEL: Record<string, string> = {
  cash_on_delivery: "نقداً عند الاستلام", cash_in_store: "نقداً في المحل", bank_transfer: "تحويل بنكي",
};

async function OrderView({ params, searchParams }: PageProps<"/order/[number]">) {
  const [{ number }, sp] = await Promise.all([params, searchParams]);
  const token = typeof sp.t === "string" ? sp.t : "";
  const isNew = sp.new === "1";
  const [order, settings] = await Promise.all([trackOrder(decodeURIComponent(number), token), getStoreSettings()]);

  if (!order) {
    return (
      <div className="rounded-2xl border border-dashed border-gold/40 bg-white p-10 text-center">
        <h1 className="text-xl font-bold">لم نجد هذا الطلب</h1>
        <p className="mt-2 opacity-70">تأكد من فتح الرابط الكامل الذي ظهر بعد إرسال الطلب.</p>
        <Link href="/track" className="mt-4 inline-block text-gold-dark underline">طلباتي على هذا الجهاز</Link>
      </div>
    );
  }

  const flow = order.fulfillment === "delivery" ? FLOW_DELIVERY : FLOW_PICKUP;
  const reached = new Set(order.history.map((h) => (h.status === "awaiting_confirmation" ? "received" : h.status)));
  const wa = whatsappLink(settings.whatsapp_number,
    `مرحباً، بخصوص طلبي رقم ${order.order_number}` + (order.payment_method === "bank_transfer" && order.payment_status === "awaiting_review"
      ? `\nاخترت الدفع بالتحويل البنكي، أرجو إرسال بيانات الحساب. المبلغ: ${formatPrice(order.total)}` : ""));

  return (
    <div className="space-y-6">
      {isNew && (
        <div role="status" className="rounded-2xl bg-emerald-50 p-5 text-emerald-900">
          <h1 className="text-xl font-bold">تم استلام طلبك ✓</h1>
          <p className="mt-1">رقم الطلب: <strong dir="ltr">{order.order_number}</strong>. سنتواصل معك عبر WhatsApp لتأكيده.</p>
          <p className="mt-1 text-sm">احفظ هذه الصفحة لمتابعة حالة طلبك (محفوظة أيضاً في «طلباتي» على هذا الجهاز).</p>
        </div>
      )}
      {!isNew && <h1 className="text-2xl font-bold">الطلب <span dir="ltr">{order.order_number}</span></h1>}

      <section className="rounded-2xl border border-gold/20 bg-white p-5">
        <h2 className="mb-1 font-bold">حالة الطلب</h2>
        <p className="mb-4 text-gold-dark">{ORDER_STATUS_LABEL[order.status]}</p>
        {order.status !== "cancelled" && (
          <ol className="grid grid-cols-5 gap-1 text-center text-xs">
            {flow.map((s) => (
              <li key={s} className="space-y-1">
                <span className={`mx-auto block h-2 rounded-full ${reached.has(s) ? "bg-gold" : "bg-beige"}`} />
                <span className={reached.has(s) ? "" : "opacity-50"}>{ORDER_STATUS_LABEL[s].replace("تم ", "")}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {order.payment_method === "bank_transfer" && order.payment_status === "awaiting_review" && (
        <p className="rounded-2xl bg-beige p-4 text-sm">
          اخترت الدفع بالتحويل البنكي: سنرسل لك بيانات الحساب عبر WhatsApp. لا يُعتمد الدفع إلا بعد مراجعة التحويل.
        </p>
      )}

      <section className="rounded-2xl border border-gold/20 bg-white p-5">
        <h2 className="mb-3 font-bold">المنتجات</h2>
        <ul className="space-y-2 text-sm">
          {order.items.map((i, n) => (
            <li key={n} className="flex justify-between gap-2">
              <span>{i.name}{i.variant?.name && i.variant.name !== "افتراضي" ? ` (${i.variant.name})` : ""} × {i.quantity}</span>
              <span>{formatPrice(i.line_total)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1 border-t border-gold/20 pt-3 text-sm">
          <div className="flex justify-between"><dt>المنتجات</dt><dd>{formatPrice(order.subtotal)}</dd></div>
          {Number(order.discount) > 0 && <div className="flex justify-between text-emerald-700"><dt>الخصم</dt><dd>− {formatPrice(order.discount)}</dd></div>}
          <div className="flex justify-between"><dt>التوصيل</dt><dd>{order.fulfillment === "pickup" ? "استلام من المحل" : formatPrice(order.delivery_fee)}</dd></div>
          <div className="flex justify-between text-base font-bold"><dt>الإجمالي</dt><dd>{formatPrice(order.total)}</dd></div>
          <div className="flex justify-between opacity-70"><dt>الدفع</dt><dd>{PAYMENT_LABEL[order.payment_method]} — {PAYMENT_STATUS_LABEL[order.payment_status]}</dd></div>
        </dl>
      </section>

      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-3 font-medium text-white">
          <WhatsAppIcon className="h-5 w-5" /> تواصل معنا بخصوص هذا الطلب
        </a>
      )}
      <p className="text-center text-xs opacity-60">لتعديل العنوان أو المقاسات أو إلغاء الطلب قبل بدء التجهيز، تواصل معنا عبر WhatsApp.</p>
    </div>
  );
}

export default function OrderPage(props: PageProps<"/order/[number]">) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-white" />}><OrderView {...props} /></Suspense>
    </div>
  );
}
