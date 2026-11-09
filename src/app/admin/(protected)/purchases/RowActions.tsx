"use client";
import { useActionState, useState, useTransition } from "react";
import { approveMany, correctPurchase, reviewPurchase } from "./actions";

const btn = "rounded-md border px-2.5 py-1 text-xs";

// إجراءات عملية الفرع: اعتماد / رفض بسبب / تصحيح قبل الاعتماد / إلغاء المعتمد بسبب
export function RowActions({ id, status, amount, branchId, branches }: {
  id: string; status: string; amount: number; branchId: string | null; branches: { id: string; name: string }[];
}) {
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
                <button disabled={pending} className={`${btn} border-emerald-600 bg-emerald-600 text-white`}>اعتماد</button>
              </form>
              <button type="button" onClick={() => setMode("reject")} className={`${btn} border-red-300 text-red-700`}>رفض</button>
              <button type="button" onClick={() => setMode("correct")} className={`${btn} border-gold/40`}>تصحيح</button>
            </>
          )}
          {status === "approved" && <button type="button" onClick={() => setMode("void")} className={`${btn} border-red-300 text-red-700`}>إلغاء</button>}
        </div>
      )}
      {(mode === "reject" || mode === "void") && (
        <form action={action} className="flex flex-wrap items-center gap-1.5">
          <input type="hidden" name="id" value={id} /><input type="hidden" name="action" value={mode} />
          <input name="reason" required maxLength={300} placeholder="السبب (إلزامي)" className="w-40 rounded-md border border-gold/30 px-2 py-1 text-xs" />
          <button disabled={pending} className={`${btn} border-red-600 bg-red-600 text-white`}>{mode === "reject" ? "تأكيد الرفض" : "تأكيد الإلغاء"}</button>
          <button type="button" onClick={() => setMode(null)} className={btn}>تراجع</button>
        </form>
      )}
      {mode === "correct" && (
        <form action={cAction} className="flex flex-wrap items-center gap-1.5">
          <input type="hidden" name="id" value={id} />
          <input name="amount" defaultValue={amount} inputMode="decimal" dir="ltr" className="w-20 rounded-md border border-gold/30 px-2 py-1 text-xs" aria-label="المبلغ الصحيح" />
          <select name="branch_id" defaultValue={branchId ?? ""} className="rounded-md border border-gold/30 px-1 py-1 text-xs" aria-label="الفرع">
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <input name="reason" required maxLength={300} placeholder="سبب التصحيح" className="w-32 rounded-md border border-gold/30 px-2 py-1 text-xs" />
          <button disabled={cPending} className={`${btn} border-charcoal bg-charcoal text-white`}>حفظ</button>
          <button type="button" onClick={() => setMode(null)} className={btn}>تراجع</button>
        </form>
      )}
      {(state.error || cState.error) && <p role="alert" className="text-xs text-red-700">{state.error ?? cState.error}</p>}
    </div>
  );
}

export function ApproveAll({ ids }: { ids: string[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  if (!ids.length) return null;
  return (
    <div className="flex items-center gap-3">
      <button type="button" disabled={pending}
        onClick={() => { if (confirm(`اعتماد ${ids.length} عملية معروضة بانتظار الاعتماد؟`)) start(async () => {
          const r = await approveMany(ids); setMsg(r.error ?? `تم اعتماد ${r.count} عملية ✓`); }); }}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        اعتماد كل المعروض بانتظار الاعتماد ({ids.length})
      </button>
      {msg && <span role="status" className="text-sm">{msg}</span>}
    </div>
  );
}
