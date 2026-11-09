"use client";
import { useActionState, useState, useTransition } from "react";
import { useI18n } from "@/components/admin/I18nProvider";
import { saveCoupon, toggleCoupon } from "./actions";
import { toGazaLocalInput as toLocal } from "@/lib/admin/actions-util";

export type CouponValues = {
  id?: string; code?: string; kind?: string; value?: string; max_discount?: string | null; min_order_amount?: string;
  max_uses?: number | null; max_uses_per_customer?: number | null; vip_only?: boolean; starts_at?: string | null; ends_at?: string | null;
};

// خارج المكوّن حتى لا تُعاد تهيئة الحقول عند تغيير النوع
function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="a-label">{label}</span>{children}</label>;
}

export function CouponForm({ c = {} }: { c?: CouponValues }) {
  const { t, tx } = useI18n();
  const k = t.coupons;
  const [state, action, pending] = useActionState(saveCoupon, {});
  const [kind, setKind] = useState(c.kind ?? "percent");
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {c.id && <input type="hidden" name="id" value={c.id} />}
      <L label={k.code}><input name="code" required defaultValue={c.code} dir="ltr" placeholder="EID20" className="a-input" /></L>
      <L label={k.kind}><select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="a-input"><option value="percent">{k.percent}</option><option value="fixed">{k.fixed}</option></select></L>
      <L label={kind === "percent" ? k.valuePercent : k.valueFixed}><input name="value" required inputMode="decimal" defaultValue={c.value} className="a-input" /></L>
      {kind === "percent" && <L label={k.maxDiscount}><input name="max_discount" inputMode="decimal" defaultValue={c.max_discount ?? ""} className="a-input" /></L>}
      <L label={k.minOrder}><input name="min_order_amount" inputMode="decimal" defaultValue={c.min_order_amount ?? ""} className="a-input" /></L>
      <L label={k.maxUses}><input name="max_uses" type="number" min={1} defaultValue={c.max_uses ?? ""} placeholder={k.unlimited} className="a-input" /></L>
      <L label={k.perCustomer}><input name="max_uses_per_customer" type="number" min={1} defaultValue={c.max_uses_per_customer ?? ""} placeholder={k.unlimited} className="a-input" /></L>
      <L label={k.starts}><input name="starts_at" type="datetime-local" defaultValue={toLocal(c.starts_at)} className="a-input" /></L>
      <L label={k.ends}><input name="ends_at" type="datetime-local" defaultValue={toLocal(c.ends_at)} className="a-input" /></L>
      <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:self-end lg:pb-2.5"><input type="checkbox" name="vip_only" defaultChecked={c.vip_only} />{k.vipOnly}</label>
      <div className="flex items-end lg:col-start-4"><button disabled={pending} className="a-btn a-btn-primary w-full">{pending ? "…" : c.id ? t.common.save : k.create}</button></div>
      {(state.error || state.message) && <p role={state.error ? "alert" : "status"} className={`text-sm sm:col-span-2 lg:col-span-4 ${state.error ? "text-[var(--a-danger-ink)]" : "text-[var(--a-success)]"}`}>{tx(state.error ?? state.message)}</p>}
    </form>
  );
}

export function ToggleCoupon({ id, active }: { id: string; active: boolean }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={(e) => { e.preventDefault(); start(async () => { await toggleCoupon(id, !active); }); }}
      className={`rounded-full px-3 py-1 text-xs font-semibold ${active ? "bg-[#eaf6f0] text-[#13704c]" : "bg-[#f1eee8] text-[#5f5f5f]"}`}>
      {active ? `${t.coupons.active} — ${t.coupons.pause}` : `${t.coupons.paused} — ${t.coupons.activate}`}
    </button>
  );
}
