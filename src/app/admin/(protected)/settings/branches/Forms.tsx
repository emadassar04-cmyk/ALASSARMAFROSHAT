"use client";
import { useActionState } from "react";
import { saveBranch } from "./actions";

type Branch = { id: string; name: string; city: string | null; address: string | null; phone: string | null; map_url: string | null; lat: number | null; lng: number | null; is_default: boolean };
const field = "w-full rounded-md border border-gold/30 bg-white px-3 py-2 text-sm";
const local = (p: string | null) => (p ? p.replace(/^\+97[02]/, "0") : "");

export function BranchForm({ branch }: { branch: Branch }) {
  const [state, action, pending] = useActionState(saveBranch, {});
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-gold/20 bg-white p-5">
      <input type="hidden" name="id" value={branch.id} />
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold">{branch.name}</h2>
        {branch.is_default && <span className="rounded-full bg-charcoal px-2 py-0.5 text-xs text-white">الرئيسي (المخزون والطلبات)</span>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span className="block font-medium">اسم الفرع</span><input name="name" required defaultValue={branch.name} className={field} /></label>
        <label className="space-y-1 text-sm"><span className="block font-medium">المدينة</span><input name="city" defaultValue={branch.city ?? ""} className={field} /></label>
        <label className="space-y-1 text-sm"><span className="block font-medium">العنوان</span><input name="address" defaultValue={branch.address ?? ""} placeholder="مثال: دوار البركة" className={field} /></label>
        <label className="space-y-1 text-sm"><span className="block font-medium">رقم الجوال</span><input name="phone" dir="ltr" inputMode="tel" defaultValue={local(branch.phone)} placeholder="0594793301" className={field} /></label>
      </div>
      <label className="block space-y-1 text-sm">
        <span className="block font-medium">رابط الموقع من Google Maps</span>
        <input name="map_url" dir="ltr" defaultValue={branch.map_url ?? ""} placeholder="https://maps.app.goo.gl/..." className={field} />
        <span className="block text-xs opacity-70">في Google Maps: اضغط مطولاً على مكان المحل ← مشاركة ← نسخ الرابط، ثم الصقه هنا. نستخرج الموقع الدقيق تلقائياً.</span>
      </label>
      <details className="text-sm">
        <summary className="cursor-pointer opacity-80">الإحداثيات (اختياري){branch.lat !== null ? ` — الحالية: ${branch.lat}, ${branch.lng}` : ""}</summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1"><span className="block">خط العرض</span><input name="lat" dir="ltr" inputMode="decimal" defaultValue={branch.lat ?? ""} className={field} /></label>
          <label className="space-y-1"><span className="block">خط الطول</span><input name="lng" dir="ltr" inputMode="decimal" defaultValue={branch.lng ?? ""} className={field} /></label>
        </div>
        <p className="mt-1 text-xs opacity-70">اتركهما فارغين ليُستخرجا من الرابط. لإعادة الاستخراج من رابط جديد: امسح الحقلين ثم احفظ.</p>
      </details>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="rounded-md bg-charcoal px-4 py-1.5 text-sm text-white disabled:opacity-50">{pending ? "جارٍ الحفظ…" : "حفظ"}</button>
        {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
        {state.ok && <p role="status" className="text-sm text-emerald-700">تم الحفظ ✓{state.note ? ` — ${state.note}` : ""}</p>}
      </div>
    </form>
  );
}
