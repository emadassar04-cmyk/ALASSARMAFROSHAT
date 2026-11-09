"use client";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/admin/I18nProvider";
import { addExpense, voidExpense } from "./actions";

const CATS = ["delivery", "packaging", "marketing", "payment_fees", "discounts", "refunds", "other"];

export function ExpenseForm({ today }: { today: string }) {
  const { t, tx } = useI18n();
  const [state, action, pending] = useActionState(addExpense, {});
  return (
    <form action={action} className="grid gap-3 md:grid-cols-[13rem_8rem_10rem_minmax(0,1fr)_auto] md:items-end">
      <label className="block"><span className="a-label">{t.exp.category}</span>
        <select name="category" required className="a-input">{CATS.map((k) => <option key={k} value={k}>{t.exp.cat[k]}</option>)}</select></label>
      <label className="block"><span className="a-label">{t.exp.amount}</span><input name="amount" required inputMode="decimal" className="a-input" /></label>
      <label className="block"><span className="a-label">{t.exp.date}</span><input name="spent_on" type="date" defaultValue={today} max={today} className="a-input" /></label>
      <label className="block"><span className="a-label">{t.exp.description}</span><input name="description" required minLength={2} maxLength={500} placeholder={t.exp.descPh} className="a-input" /></label>
      <button disabled={pending} className="a-btn a-btn-primary">{pending ? "…" : t.exp.addBtn}</button>
      {(state.error || state.message) && <p role={state.error ? "alert" : "status"} className={`text-sm md:col-span-5 ${state.error ? "text-[var(--a-danger-ink)]" : "text-[var(--a-success)]"}`}>{tx(state.error ?? state.message)}</p>}
    </form>
  );
}

export function VoidButton({ id }: { id: string }) {
  const { t, tx } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span>
      <button type="button" disabled={pending} className="text-xs font-semibold text-[var(--a-danger-ink)] hover:underline disabled:opacity-50" onClick={() => {
        const reason = prompt(t.exp.voidQ);
        if (!reason?.trim()) return;
        start(async () => { const r = await voidExpense(id, reason); setErr(r.error ?? null); if (r.ok) router.refresh(); });
      }}>{t.exp.void}</button>
      {err && <span role="alert" className="ms-2 text-xs text-[var(--a-danger-ink)]">{tx(err)}</span>}
    </span>
  );
}
