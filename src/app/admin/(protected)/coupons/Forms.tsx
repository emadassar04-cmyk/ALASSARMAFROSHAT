"use client";
import { useActionState, useState, useTransition } from "react";
import { saveCoupon, toggleCoupon } from "./actions";
import { toGazaLocalInput as toLocal } from "@/lib/admin/actions-util";

export type CouponValues = {
  id?: string; code?: string; kind?: string; value?: string; max_discount?: string | null; min_order_amount?: string;
  max_uses?: number | null; max_uses_per_customer?: number | null; vip_only?: boolean; starts_at?: string | null; ends_at?: string | null;
};
const f = "w-full rounded-lg border border-gold/30 bg-white px-3 py-2 text-sm";

export function CouponForm({ c = {} }: { c?: CouponValues }) {
  const [state, action, pending] = useActionState(saveCoupon, {});
  const [kind, setKind] = useState(c.kind ?? "percent");
  return (
    <form action={action} className="grid gap-3 rounded-2xl border border-gold/20 bg-white p-4 md:grid-cols-4">
      {c.id && <input type="hidden" name="id" value={c.id} />}
      <label className="space-y-1 text-sm"><span className="block">الكود *</span><input name="code" required defaultValue={c.code} dir="ltr" placeholder="EID20" className={f} /></label>
      <label className="space-y-1 text-sm"><span className="block">النوع</span>
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={f}><option value="percent">نسبة %</option><option value="fixed">مبلغ ثابت ₪</option></select></label>
      <label className="space-y-1 text-sm"><span className="block">{kind === "percent" ? "النسبة % *" : "المبلغ ₪ *"}</span><input name="value" required inputMode="decimal" defaultValue={c.value} className={f} /></label>
      {kind === "percent" && <label className="space-y-1 text-sm"><span className="block">أقصى خصم ₪</span><input name="max_discount" inputMode="decimal" defaultValue={c.max_discount ?? ""} className={f} /></label>}
      <label className="space-y-1 text-sm"><span className="block">حد أدنى للطلب ₪</span><input name="min_order_amount" inputMode="decimal" defaultValue={c.min_order_amount ?? ""} className={f} /></label>
      <label className="space-y-1 text-sm"><span className="block">عدد الاستخدامات الكلي</span><input name="max_uses" type="number" min={1} defaultValue={c.max_uses ?? ""} placeholder="بلا حد" className={f} /></label>
      <label className="space-y-1 text-sm"><span className="block">لكل عميل</span><input name="max_uses_per_customer" type="number" min={1} defaultValue={c.max_uses_per_customer ?? ""} placeholder="بلا حد" className={f} /></label>
      <label className="space-y-1 text-sm"><span className="block">يبدأ (توقيت فلسطين)</span><input name="starts_at" type="datetime-local" defaultValue={toLocal(c.starts_at)} className={f} /></label>
      <label className="space-y-1 text-sm"><span className="block">ينتهي</span><input name="ends_at" type="datetime-local" defaultValue={toLocal(c.ends_at)} className={f} /></label>
      <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" name="vip_only" defaultChecked={c.vip_only} />لعملاء VIP فقط</label>
      <button disabled={pending} className="rounded-lg bg-gold px-4 py-2 text-sm font-medium text-white disabled:opacity-50 md:col-start-4">{pending ? "…" : c.id ? "حفظ" : "إنشاء الكوبون"}</button>
      {(state.error || state.message) && <p role={state.error ? "alert" : "status"} className={`text-sm md:col-span-4 ${state.error ? "text-red-700" : "text-emerald-700"}`}>{state.error ?? state.message}</p>}
    </form>
  );
}

export function ToggleCoupon({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => start(async () => { await toggleCoupon(id, !active); })}
      className={`rounded-full px-3 py-1 text-xs ${active ? "bg-emerald-50 text-emerald-800" : "bg-stone-100 text-stone-600"}`}>
      {active ? "مفعّل — إيقاف" : "موقوف — تفعيل"}
    </button>
  );
}
