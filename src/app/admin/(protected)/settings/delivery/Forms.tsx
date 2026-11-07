"use client";
import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveZone, togglePaymentMethod } from "./actions";

type Zone = { id: string; name: string; fee: string; eta_text: string | null; sort_order: number; is_active: boolean };
const f = "rounded-md border border-gold/30 bg-white px-2 py-1.5 text-sm";

export function ZoneForm({ zone }: { zone?: Zone }) {
  const [state, action, pending] = useActionState(saveZone, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-xl border border-gold/20 bg-white p-3">
      {zone && <input type="hidden" name="id" value={zone.id} />}
      <label className="space-y-1 text-xs"><span className="block opacity-70">المنطقة</span><input name="name" required defaultValue={zone?.name} className={f} /></label>
      <label className="space-y-1 text-xs"><span className="block opacity-70">الرسوم ₪</span><input name="fee" required inputMode="decimal" defaultValue={zone?.fee ?? ""} className={`${f} w-24`} /></label>
      <label className="space-y-1 text-xs"><span className="block opacity-70">مدة التوصيل</span><input name="eta_text" defaultValue={zone?.eta_text ?? ""} placeholder="خلال يوم" className={`${f} w-32`} /></label>
      <label className="space-y-1 text-xs"><span className="block opacity-70">الترتيب</span><input name="sort_order" type="number" defaultValue={zone?.sort_order ?? 0} className={`${f} w-16`} /></label>
      {zone && <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="is_active" defaultChecked={zone.is_active} />فعّالة</label>}
      <button disabled={pending} className="rounded-md bg-gold px-3 py-1.5 text-sm text-white disabled:opacity-50">{zone ? "حفظ" : "إضافة"}</button>
      {state.error && <p role="alert" className="w-full text-xs text-red-700">{state.error}</p>}
      {state.ok && <p role="status" className="w-full text-xs text-emerald-700">تم الحفظ ✓</p>}
    </form>
  );
}

export function PaymentToggle({ code, name, enabled }: { code: string; name: string; enabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center justify-between rounded-xl border border-gold/20 bg-white p-3 text-sm">
      <span>{name}</span>
      <input type="checkbox" checked={enabled} disabled={pending} aria-label={`تفعيل ${name}`}
        onChange={(e) => start(async () => { await togglePaymentMethod(code, e.target.checked); router.refresh(); })} />
    </label>
  );
}
