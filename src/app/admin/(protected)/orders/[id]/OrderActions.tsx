"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addNote, cancelOrder, confirmOrder, reviewTransfer, setItemProfit, setOrderStatus, updateAddress, type ActionResult } from "../actions";
import { ORDER_STATUS_LABEL } from "@/lib/catalog-types";

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const run = (fn: () => Promise<ActionResult>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) router.refresh();
    });
  };
  return { pending, result, run };
}

function Feedback({ r }: { r: ActionResult | null }) {
  if (!r) return null;
  return <p role={r.error ? "alert" : "status"} className={`text-sm ${r.error ? "text-red-700" : "text-emerald-700"}`}>{r.error ?? "تم ✓"}</p>;
}

const btn = "rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50";

// أزرار الحالة التالية المسموحة فقط (نفس قواعد قاعدة البيانات)
export function StatusActions({ id, status, fulfillment }: { id: string; status: string; fulfillment: string }) {
  const { pending, result, run } = useAction();
  const [reason, setReason] = useState("");
  const [force, setForce] = useState(false);
  const next: [string, string][] = [];
  if (status === "received") next.push(["awaiting_confirmation", "بدأت التواصل عبر WhatsApp"]);
  if (status === "confirmed") next.push(["preparing", "بدء التجهيز"]);
  if (status === "preparing") next.push(fulfillment === "pickup" ? ["ready_for_pickup", "جاهز للاستلام"] : ["out_for_delivery", "خرج للتوصيل"]);
  if (status === "ready_for_pickup" || status === "out_for_delivery") next.push(["delivered", "تم التسليم"]);
  const canConfirm = status === "received" || status === "awaiting_confirmation";
  const canCancel = !["delivered", "cancelled"].includes(status);
  const needsForce = ["preparing", "ready_for_pickup", "out_for_delivery"].includes(status);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canConfirm && (
          <button disabled={pending} onClick={() => run(() => confirmOrder(id), "تأكيد الطلب بعد موافقة الزبون؟ سيُخصم المخزون نهائياً.")}
            className={`${btn} bg-gold text-white hover:bg-gold-dark`}>تأكيد الطلب (وافق الزبون)</button>
        )}
        {next.map(([s, label]) => (
          <button key={s} disabled={pending} onClick={() => run(() => setOrderStatus(id, s), `تغيير الحالة إلى «${ORDER_STATUS_LABEL[s]}»؟`)}
            className={`${btn} border border-gold bg-white text-gold-dark hover:bg-beige`}>{label}</button>
        ))}
      </div>
      {canCancel && (
        <details className="rounded-xl border border-red-200 p-3">
          <summary className="cursor-pointer text-sm text-red-800">إلغاء الطلب</summary>
          <div className="mt-2 space-y-2">
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب الإلغاء (إلزامي)" maxLength={300}
              className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm" />
            {needsForce && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
                موافقة الإدارة: الطلب بدأ تجهيزه، وأريد إلغاءه وإعادة الكمية للمخزون
              </label>
            )}
            <button disabled={pending || !reason.trim() || (needsForce && !force)}
              onClick={() => run(() => cancelOrder(id, reason, force), "إلغاء الطلب نهائياً؟")}
              className={`${btn} bg-red-700 text-white`}>تأكيد الإلغاء</button>
          </div>
        </details>
      )}
      <Feedback r={result} />
    </div>
  );
}

export function ProfitInput({ itemId, current, net, disabled }: { itemId: string; current: string | null; net: string; disabled: boolean }) {
  const { pending, result, run } = useAction();
  const [v, setV] = useState(current ?? "");
  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        <input value={v} onChange={(e) => setV(e.target.value)} inputMode="decimal" disabled={disabled} aria-label="ربحك من هذا البند"
          placeholder={disabled ? "بعد التأكيد" : `حتى ${net}`} className="w-24 rounded-md border border-gold/30 px-2 py-1 text-sm disabled:bg-stone-50" />
        <button disabled={disabled || pending || !v.trim()} onClick={() => run(() => setItemProfit(itemId, v))}
          className="rounded-md bg-gold px-2 text-xs text-white disabled:opacity-40">حفظ</button>
      </div>
      <Feedback r={result} />
    </div>
  );
}

export function TransferReview({ id }: { id: string }) {
  const { pending, result, run } = useAction();
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="space-y-2 rounded-xl bg-amber-50 p-3">
      <p className="text-sm font-medium text-amber-900">تحويل بنكي بانتظار المراجعة. أرسل بيانات الحساب للزبون عبر WhatsApp، وراجع التحويل قبل الاعتماد.</p>
      <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="رقم/مرجع الحوالة (اختياري)" className="w-full rounded-lg border px-3 py-2 text-sm" />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة (اختياري)" className="w-full rounded-lg border px-3 py-2 text-sm" />
      <div className="flex gap-2">
        <button disabled={pending} onClick={() => run(() => reviewTransfer(id, true, ref, note), "اعتماد التحويل كمدفوع؟")} className={`${btn} bg-emerald-700 text-white`}>اعتماد الدفع</button>
        <button disabled={pending} onClick={() => run(() => reviewTransfer(id, false, ref, note), "رفض التحويل؟")} className={`${btn} border border-red-300 text-red-800`}>رفض</button>
      </div>
      <Feedback r={result} />
    </div>
  );
}

export function NoteForm({ id }: { id: string }) {
  const { pending, result, run } = useAction();
  const [body, setBody] = useState("");
  return (
    <div className="space-y-2">
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="ملاحظة داخلية (لا يراها الزبون)" className="w-full rounded-lg border border-gold/30 px-3 py-2 text-sm" />
      <button disabled={pending || !body.trim()} onClick={() => run(async () => { const r = await addNote(id, body); if (r.ok) setBody(""); return r; })}
        className={`${btn} border border-gold text-gold-dark`}>إضافة ملاحظة</button>
      <Feedback r={result} />
    </div>
  );
}

export function AddressEdit({ id, address }: { id: string; address: string }) {
  const { pending, result, run } = useAction();
  const [v, setV] = useState(address);
  return (
    <div className="space-y-1">
      <textarea value={v} onChange={(e) => setV(e.target.value)} rows={2} className="w-full rounded-lg border border-gold/30 px-3 py-2 text-sm" />
      <button disabled={pending || v.trim() === address} onClick={() => run(() => updateAddress(id, v))} className="text-sm text-gold-dark underline disabled:opacity-40">حفظ العنوان</button>
      <Feedback r={result} />
    </div>
  );
}
