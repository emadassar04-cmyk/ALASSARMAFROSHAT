"use client";
import { useActionState, useState, useTransition } from "react";
import { applyStocktake, cancelStocktake, inStoreSale, setCount, startStocktake } from "./actions";

export function SaleForm({ variantId, available }: { variantId: string; available: number }) {
  const [state, action, pending] = useActionState(inStoreSale, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-1">
      <input type="hidden" name="variant_id" value={variantId} />
      <input name="qty" type="number" min={1} max={Math.max(1, available)} required aria-label="الكمية المباعة في المحل"
        placeholder="كم" className="w-16 rounded-md border border-gold/30 px-2 py-1 text-sm" />
      <button disabled={pending || available <= 0} className="rounded-md border border-gold px-2 py-1 text-xs text-gold-dark disabled:opacity-40">بيع في المحل</button>
      {(state.error || state.message) && <span role={state.error ? "alert" : "status"} className={`w-full text-xs ${state.error ? "text-red-700" : "text-emerald-700"}`}>{state.error ?? state.message}</span>}
    </form>
  );
}

export function StartStocktake() {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <button disabled={pending} onClick={() => start(async () => { const r = await startStocktake(""); setErr(r.error ?? null); })}
        className="rounded-lg bg-charcoal px-4 py-2 text-sm font-medium text-white disabled:opacity-50">بدء جرد جديد</button>
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
    </div>
  );
}

export function CountInput({ itemId, counted, expected }: { itemId: number; counted: number | null; expected: number }) {
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
        onBlur={save} aria-label="الكمية المعدودة" className="w-20 rounded-md border border-gold/30 px-2 py-1 text-sm" />
      {diff !== null && !Number.isNaN(diff) && diff !== 0 && <span className={`text-xs ${diff < 0 ? "text-red-700" : "text-emerald-700"}`}>{diff > 0 ? `+${diff}` : diff}</span>}
      <span className="text-xs opacity-60" aria-live="polite">{state === "saving" ? "…" : state === "saved" ? "✓" : state === "error" ? "خطأ" : ""}</span>
    </span>
  );
}

export function StocktakeActions({ id, counted }: { id: string; counted: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button disabled={pending || counted === 0} onClick={() => {
        if (!confirm(`اعتماد الجرد؟ سيُطبَّق الفرق لـ ${counted} صنفاً معدوداً على المخزون، ولا يمكن التراجع (تُسجَّل كحركات مخزون).`)) return;
        start(async () => { const r = await applyStocktake(id); setMsg(r.error ?? null); });
      }} className="rounded-lg bg-charcoal px-4 py-2 text-sm font-medium text-white disabled:opacity-50">اعتماد الجرد</button>
      <button disabled={pending} onClick={() => confirm("إلغاء الجرد دون تغيير المخزون؟") && start(async () => { const r = await cancelStocktake(id); setMsg(r.error ?? null); })}
        className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-800">إلغاء الجرد</button>
      {msg && <p role="alert" className="w-full text-sm text-red-700">{msg}</p>}
    </div>
  );
}
