"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addNote, cancelOrder, confirmOrder, reviewTransfer, setItemProfit, setOrderStatus, updateAddress, type ActionResult } from "../actions";
import { useI18n } from "@/components/admin/I18nProvider";
import { fill } from "@/lib/admin/i18n";

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
  const { t } = useI18n();
  if (!r) return null;
  return <p role={r.error ? "alert" : "status"} className={`text-sm ${r.error ? "text-[var(--a-danger-ink)]" : "text-[var(--a-success)]"}`}>{r.error ? (t.od.err[r.error] ?? t.od.err.generic) : t.od.done}</p>;
}

// أزرار الحالة التالية المسموحة فقط (نفس قواعد قاعدة البيانات، والتحقق الفعلي هناك)
export function StatusActions({ id, status, fulfillment }: { id: string; status: string; fulfillment: string }) {
  const { t } = useI18n();
  const { pending, result, run } = useAction();
  const [reason, setReason] = useState("");
  const [force, setForce] = useState(false);
  const next: [string, string][] = [];
  if (status === "received") next.push(["awaiting_confirmation", t.od.startWhatsapp]);
  if (status === "confirmed") next.push(["preparing", t.od.startPreparing]);
  if (status === "preparing") next.push(fulfillment === "pickup" ? ["ready_for_pickup", t.od.readyPickup] : ["out_for_delivery", t.od.outDelivery]);
  if (status === "ready_for_pickup" || status === "out_for_delivery") next.push(["delivered", t.od.delivered]);
  const canConfirm = status === "received" || status === "awaiting_confirmation";
  const canCancel = !["delivered", "cancelled"].includes(status);
  const needsForce = ["preparing", "ready_for_pickup", "out_for_delivery"].includes(status);
  const label = (s: string) => t.status[s as keyof typeof t.status] ?? s;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canConfirm && <button disabled={pending} onClick={() => run(() => confirmOrder(id), t.od.confirmQ)} className="a-btn a-btn-primary">{t.od.confirm}</button>}
        {next.map(([s, l]) => (
          <button key={s} disabled={pending} onClick={() => run(() => setOrderStatus(id, s), fill(t.od.toStatusQ, { s: label(s) }))} className="a-btn a-btn-accent">{l}</button>
        ))}
      </div>
      {canCancel && (
        <details className="rounded-[12px] border border-[#f0c9c9] p-3">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--a-danger-ink)]">{t.od.cancel}</summary>
          <div className="mt-3 space-y-2">
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t.od.cancelReason} aria-label={t.od.cancelReason} maxLength={300} className="a-input" />
            {needsForce && (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={force} onChange={(e) => setForce(e.target.checked)} />{t.od.force}
              </label>
            )}
            <button disabled={pending || !reason.trim() || (needsForce && !force)} onClick={() => run(() => cancelOrder(id, reason, force), t.od.cancelQ)}
              className="a-btn bg-[var(--a-danger-ink)] text-white">{t.od.confirmCancel}</button>
          </div>
        </details>
      )}
      <Feedback r={result} />
    </div>
  );
}

export function ProfitInput({ itemId, current, net, disabled }: { itemId: string; current: string | null; net: string; disabled: boolean }) {
  const { t } = useI18n();
  const { pending, result, run } = useAction();
  // قاعدة البيانات تعيد الأرقام كأرقام لا نصوص
  const [v, setV] = useState(current === null || current === undefined ? "" : String(current));
  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        <input value={v} onChange={(e) => setV(e.target.value)} inputMode="decimal" disabled={disabled} aria-label={t.od.profitLabel}
          placeholder={disabled ? t.od.afterConfirm : fill(t.od.upTo, { n: net })} className="a-input h-8 min-h-0 w-24 px-2 py-1 disabled:bg-[#f7f6f2]" />
        <button disabled={disabled || pending || !v.trim()} onClick={() => run(() => setItemProfit(itemId, v))} className="a-btn a-btn-primary h-8 min-h-0 px-2.5 text-xs">{t.common.save}</button>
      </div>
      <Feedback r={result} />
    </div>
  );
}

export function TransferReview({ id, wallet = false }: { id: string; wallet?: boolean }) {
  const { t } = useI18n();
  const { pending, result, run } = useAction();
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="space-y-2 rounded-[12px] border border-[#ecd9b8] bg-[#fffaf1] p-3">
      <p className="text-sm font-medium text-[var(--a-warning)]">{wallet ? t.od.wallet : t.od.transfer}</p>
      <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder={t.od.reference} aria-label={t.od.reference} className="a-input" />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.od.note} aria-label={t.od.note} className="a-input" />
      <div className="flex gap-2">
        <button disabled={pending} onClick={() => run(() => reviewTransfer(id, true, ref, note), t.od.approveQ)} className="a-btn bg-[var(--a-success)] text-white">{t.od.approve}</button>
        <button disabled={pending} onClick={() => run(() => reviewTransfer(id, false, ref, note), t.od.rejectQ)} className="a-btn a-btn-danger">{t.od.reject}</button>
      </div>
      <Feedback r={result} />
    </div>
  );
}

export function NoteForm({ id }: { id: string }) {
  const { t } = useI18n();
  const { pending, result, run } = useAction();
  const [body, setBody] = useState("");
  return (
    <div className="space-y-2">
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder={t.od.notePlaceholder} aria-label={t.od.notePlaceholder} className="a-input" />
      <button disabled={pending || !body.trim()} onClick={() => run(async () => { const r = await addNote(id, body); if (r.ok) setBody(""); return r; })}
        className="a-btn a-btn-ghost">{t.od.addNote}</button>
      <Feedback r={result} />
    </div>
  );
}

export function AddressEdit({ id, address }: { id: string; address: string }) {
  const { t } = useI18n();
  const { pending, result, run } = useAction();
  const [v, setV] = useState(String(address ?? ""));
  return (
    <div className="space-y-1">
      <textarea value={v} onChange={(e) => setV(e.target.value)} rows={2} aria-label={t.od.address} className="a-input" />
      <button disabled={pending || v.trim() === address} onClick={() => run(() => updateAddress(id, v))} className="text-sm font-semibold text-[var(--a-accent-ink)] underline disabled:opacity-40">{t.od.saveAddress}</button>
      <Feedback r={result} />
    </div>
  );
}
