"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/admin/I18nProvider";
import { STATUSES } from "@/lib/custom-order/spec";
import { updateCustomOrder } from "../actions";

export function Manage({ id, status, price }: { id: string; status: string; price: number | null }) {
  const { t, tx } = useI18n();
  const C = t.co;
  const router = useRouter();
  const [form, setForm] = useState({ status, price: price !== null ? String(price) : "", clearPrice: false, note: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault(); setMsg(null);
      start(async () => {
        const r = await updateCustomOrder(id, form);
        if (r.ok) { setMsg({ ok: true, text: C.saved }); setForm((f) => ({ ...f, note: "", clearPrice: false })); router.refresh(); }
        else setMsg({ ok: false, text: r.error === "forbidden" ? t.errors.forbidden : tx(r.error ?? t.errors.generic) });
      });
    }}>
      <label className="block"><span className="a-label">{C.status}</span>
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="a-input">
          {STATUSES.map((s) => <option key={s} value={s}>{C.st[s]}</option>)}
        </select>
      </label>
      <label className="block"><span className="a-label">{C.finalPrice}</span>
        <input inputMode="decimal" dir="ltr" value={form.price} disabled={form.clearPrice} onChange={(e) => setForm({ ...form, price: e.target.value.slice(0, 12) })} className="a-input tabular-nums" />
      </label>
      {price !== null && (
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.clearPrice} onChange={(e) => setForm({ ...form, clearPrice: e.target.checked })} />{C.clearPrice}</label>
      )}
      <label className="block"><span className="a-label">{C.note}</span>
        <textarea rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value.slice(0, 1000) })} className="a-input" />
      </label>
      <button disabled={pending} className="a-btn a-btn-primary w-full">{pending ? t.set.saving : C.save}</button>
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-[var(--a-success)]" : "text-[var(--a-danger-ink)]"}`}>{msg.text}</p>}
    </form>
  );
}
