"use client";
import { useActionState, useState, useTransition } from "react";
import { useI18n } from "@/components/admin/I18nProvider";
import { fill } from "@/lib/admin/i18n";
import { applyStocktake, cancelStocktake, inStoreSale, setCount, startStocktake } from "./actions";

export function SaleForm({ variantId, available }: { variantId: string; available: number }) {
  const { t, tx } = useI18n();
  const [state, action, pending] = useActionState(inStoreSale, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="variant_id" value={variantId} />
      <input name="qty" type="number" min={1} max={Math.max(1, available)} required aria-label={t.inv.qtyLabel} placeholder={t.inv.qtyPh} className="a-input h-8 min-h-0 w-16 px-2 py-1" />
      <button disabled={pending || available <= 0} className="a-btn a-btn-ghost h-8 min-h-0 px-2.5 text-xs">{t.inv.sellInStore}</button>
      {(state.error || state.message) && <span role={state.error ? "alert" : "status"} className={`w-full text-xs ${state.error ? "text-[var(--a-danger-ink)]" : "text-[var(--a-success)]"}`}>{tx(state.error ?? state.message)}</span>}
    </form>
  );
}

export function StartStocktake() {
  const { t, tx } = useI18n();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <button disabled={pending} onClick={() => start(async () => { const r = await startStocktake(""); setErr(r.error ?? null); })} className="a-btn a-btn-primary">{t.inv.start}</button>
      {err && <p role="alert" className="text-sm text-[var(--a-danger-ink)]">{tx(err)}</p>}
    </div>
  );
}

export function CountInput({ itemId, counted, expected }: { itemId: number; counted: number | null; expected: number }) {
  const { t } = useI18n();
  const [value, setValue] = useState(counted === null ? "" : String(counted));
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const save = async () => {
    const n = value.trim() === "" ? null : Number(value);
    if (n !== null && (!Number.isInteger(n) || n < 0)) return setState("error");
    setState("saving");
    const r = await setCount(itemId, n);
    setState(r.error ? "error" : "saved");
  };
  const diff = value.trim() === "" ? null : Number(value) - expected;
  return (
    <span className="inline-flex items-center gap-2">
      <input type="number" min={0} inputMode="numeric" value={value} onChange={(e) => { setValue(e.target.value); setState("idle"); }}
        onBlur={save} aria-label={t.inv.countLabel} className="a-input h-8 min-h-0 w-20 px-2 py-1" />
      {diff !== null && !Number.isNaN(diff) && diff !== 0 && <span className={`text-xs font-semibold ${diff < 0 ? "text-[var(--a-danger-ink)]" : "text-[var(--a-success)]"}`}>{diff > 0 ? `+${diff}` : diff}</span>}
      <span className="text-xs text-[var(--a-muted-ink)]" aria-live="polite">{state === "saving" ? "…" : state === "saved" ? "✓" : state === "error" ? t.inv.error : ""}</span>
    </span>
  );
}

export function StocktakeActions({ id, counted }: { id: string; counted: number }) {
  const { t, tx } = useI18n();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button disabled={pending || counted === 0} onClick={() => {
        if (!confirm(fill(t.inv.applyQ, { n: counted }))) return;
        start(async () => { const r = await applyStocktake(id); setMsg(r.error ?? null); });
      }} className="a-btn a-btn-primary">{t.inv.apply}</button>
      <button disabled={pending} onClick={() => confirm(t.inv.cancelQ) && start(async () => { const r = await cancelStocktake(id); setMsg(r.error ?? null); })}
        className="a-btn a-btn-danger">{t.inv.cancel}</button>
      {msg && <p role="alert" className="w-full text-sm text-[var(--a-danger-ink)]">{tx(msg)}</p>}
    </div>
  );
}
