"use client";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EXPENSE_LABEL } from "@/lib/admin/finance";
import { addExpense, voidExpense } from "./actions";

const f = "rounded-lg border border-gold/30 bg-white px-3 py-2 text-sm";

export function ExpenseForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(addExpense, {});
  return (
    <form action={action} className="grid gap-3 rounded-2xl border border-gold/20 bg-white p-4 md:grid-cols-[12rem_8rem_10rem_1fr_auto] md:items-end">
      <label className="space-y-1 text-sm"><span className="block">النوع</span>
        <select name="category" required className={`${f} w-full`}>{Object.entries(EXPENSE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label className="space-y-1 text-sm"><span className="block">المبلغ ₪</span><input name="amount" required inputMode="decimal" className={`${f} w-full`} /></label>
      <label className="space-y-1 text-sm"><span className="block">التاريخ</span><input name="spent_on" type="date" defaultValue={today} max={today} className={`${f} w-full`} /></label>
      <label className="space-y-1 text-sm"><span className="block">الوصف</span><input name="description" required minLength={2} maxLength={500} placeholder="مثال: أجرة مندوب طلب ALS-1010" className={`${f} w-full`} /></label>
      <button disabled={pending} className="rounded-lg bg-charcoal px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{pending ? "…" : "إضافة"}</button>
      {(state.error || state.message) && <p role={state.error ? "alert" : "status"} className={`text-sm md:col-span-5 ${state.error ? "text-red-700" : "text-emerald-700"}`}>{state.error ?? state.message}</p>}
    </form>
  );
}

export function VoidButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span>
      <button type="button" disabled={pending} className="text-xs text-red-700 hover:underline disabled:opacity-50" onClick={() => {
        const reason = prompt("سبب إلغاء المصروف؟ (يبقى في السجل)");
        if (!reason?.trim()) return;
        start(async () => { const r = await voidExpense(id, reason); setErr(r.error ?? null); if (r.ok) router.refresh(); });
      }}>إلغاء</button>
      {err && <span role="alert" className="ms-2 text-xs text-red-700">{err}</span>}
    </span>
  );
}
