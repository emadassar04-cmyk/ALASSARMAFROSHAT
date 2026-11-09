"use client";
import { useActionState, useState, useTransition } from "react";
import { approveMany, correctPurchase, reviewPurchase } from "./actions";
import { useI18n } from "@/components/admin/I18nProvider";
import { fill } from "@/lib/admin/i18n";

const btn = "a-btn h-8 min-h-0 px-2.5 text-xs";

// إجراءات عملية الفرع: اعتماد / رفض بسبب / تصحيح قبل الاعتماد / إلغاء المعتمد بسبب
export function RowActions({ id, status, amount, branchId, branches }: {
  id: string; status: string; amount: number; branchId: string | null; branches: { id: string; name: string }[];
}) {
  const { t, tx } = useI18n();
  const P = t.pur;
  const [mode, setMode] = useState<null | "reject" | "void" | "correct">(null);
  const [state, action, pending] = useActionState(reviewPurchase, {});
  const [cState, cAction, cPending] = useActionState(correctPurchase, {});
  if (status !== "submitted" && status !== "approved") return null;
  return (
    <div className="space-y-1.5">
      {mode === null && (
        <div className="flex flex-wrap gap-1.5">
          {status === "submitted" && (
            <>
              <form action={action}>
                <input type="hidden" name="id" value={id} /><input type="hidden" name="action" value="approve" />
                <button disabled={pending} className={`${btn} bg-[var(--a-success)] text-white`}>{P.approve}</button>
              </form>
              <button type="button" onClick={() => setMode("reject")} className={`${btn} a-btn-danger`}>{P.reject}</button>
              <button type="button" onClick={() => setMode("correct")} className={`${btn} a-btn-ghost`}>{P.correct}</button>
            </>
          )}
          {status === "approved" && <button type="button" onClick={() => setMode("void")} className={`${btn} a-btn-danger`}>{P.void}</button>}
        </div>
      )}
      {(mode === "reject" || mode === "void") && (
        <form action={action} className="flex flex-wrap items-center gap-1.5">
          <input type="hidden" name="id" value={id} /><input type="hidden" name="action" value={mode} />
          <input name="reason" required maxLength={300} placeholder={P.reasonReq} aria-label={P.reasonReq} className="a-input h-8 min-h-0 w-40 px-2 py-1 text-xs" />
          <button disabled={pending} className={`${btn} bg-[var(--a-danger-ink)] text-white`}>{mode === "reject" ? P.confirmReject : P.confirmVoid}</button>
          <button type="button" onClick={() => setMode(null)} className={`${btn} a-btn-ghost`}>{P.back}</button>
        </form>
      )}
      {mode === "correct" && (
        <form action={cAction} className="flex flex-wrap items-center gap-1.5">
          <input type="hidden" name="id" value={id} />
          <input name="amount" defaultValue={amount} inputMode="decimal" dir="ltr" className="a-input h-8 min-h-0 w-20 px-2 py-1 text-xs" aria-label={P.rightAmount} />
          <select name="branch_id" defaultValue={branchId ?? ""} className="a-input h-8 min-h-0 w-auto px-1 py-1 text-xs" aria-label={P.branch}>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <input name="reason" required maxLength={300} placeholder={P.correctReason} aria-label={P.correctReason} className="a-input h-8 min-h-0 w-32 px-2 py-1 text-xs" />
          <button disabled={cPending} className={`${btn} a-btn-primary`}>{t.common.save}</button>
          <button type="button" onClick={() => setMode(null)} className={`${btn} a-btn-ghost`}>{P.back}</button>
        </form>
      )}
      {(state.error || cState.error) && <p role="alert" className="text-xs text-[var(--a-danger-ink)]">{tx(state.error ?? cState.error)}</p>}
    </div>
  );
}

export function ApproveAll({ ids }: { ids: string[] }) {
  const { t, tx } = useI18n();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  if (!ids.length) return null;
  return (
    <div className="flex items-center gap-3">
      <button type="button" disabled={pending}
        onClick={() => { if (confirm(fill(t.pur.approveAllQ, { n: ids.length }))) start(async () => {
          const r = await approveMany(ids); setMsg(r.error ? tx(r.error) : fill(t.pur.approvedN, { n: r.count ?? 0 })); }); }}
        className="a-btn bg-[var(--a-success)] text-white">
        {fill(t.pur.approveAll, { n: ids.length })}
      </button>
      {msg && <span role="status" className="text-sm">{msg}</span>}
    </div>
  );
}
