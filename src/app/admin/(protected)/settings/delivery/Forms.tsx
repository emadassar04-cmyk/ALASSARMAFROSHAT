"use client";
import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/admin/I18nProvider";
import { saveZone, togglePaymentMethod } from "./actions";

type Zone = { id: string; name: string; fee: string; eta_text: string | null; sort_order: number; is_active: boolean };

export function ZoneForm({ zone }: { zone?: Zone }) {
  const { t, tx } = useI18n();
  const S = t.set;
  const [state, action, pending] = useActionState(saveZone, {});
  return (
    <form action={action} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_7rem_9rem_6rem_auto_auto] sm:items-end">
      {zone && <input type="hidden" name="id" value={zone.id} />}
      <label className="block"><span className="a-label">{S.zone}</span><input name="name" required defaultValue={zone?.name} dir="auto" className="a-input" /></label>
      <label className="block"><span className="a-label">{S.fee}</span><input name="fee" required inputMode="decimal" defaultValue={zone?.fee ?? ""} className="a-input" /></label>
      <label className="block"><span className="a-label">{S.eta}</span><input name="eta_text" defaultValue={zone?.eta_text ?? ""} dir="auto" placeholder={S.etaPh} className="a-input" /></label>
      <label className="block"><span className="a-label">{S.sort}</span><input name="sort_order" type="number" defaultValue={zone?.sort_order ?? 0} className="a-input" /></label>
      {zone ? <label className="flex items-center gap-2 pb-2.5 text-sm"><input type="checkbox" name="is_active" defaultChecked={zone.is_active} />{S.active}</label> : <span />}
      <button disabled={pending} className="a-btn a-btn-primary">{zone ? t.common.save : S.add}</button>
      {state.error && <p role="alert" className="text-xs text-[var(--a-danger-ink)] sm:col-span-6">{tx(state.error)}</p>}
      {state.ok && <p role="status" className="text-xs text-[var(--a-success)] sm:col-span-6">{S.saved}</p>}
    </form>
  );
}

export function PaymentToggle({ code, name, enabled }: { code: string; name: string; enabled: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const label = t.payment[code as keyof typeof t.payment] ?? name;
  return (
    <label className="flex items-center justify-between px-5 py-4 text-sm">
      <span className="font-medium">{label}</span>
      <input type="checkbox" checked={enabled} disabled={pending} aria-label={`${t.set.enable} ${label}`} className="h-5 w-5 accent-[var(--a-sidebar)]"
        onChange={(e) => start(async () => { await togglePaymentMethod(code, e.target.checked); router.refresh(); })} />
    </label>
  );
}
