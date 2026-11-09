"use client";
import { useActionState } from "react";
import { saveVariant } from "./actions";

export type VariantValues = {
  id?: string; name?: string; color?: string | null; size?: string | null; material?: string | null;
  price_override?: string | null; is_active?: boolean; is_default?: boolean; unit_cost?: string | null;
  on_hand?: number | null; reserved?: number | null;
};

const f = "w-full rounded-md border border-gold/30 bg-white px-2 py-1.5 text-sm";

// نموذج خيار واحد (تعديل أو إضافة)
export function VariantRow({ productId, v, canSeeCost }: { productId: string; v?: VariantValues; canSeeCost: boolean }) {
  const [state, action, pending] = useActionState(saveVariant, {});
  const isNew = !v?.id;
  return (
    <form action={action} className="grid items-end gap-2 rounded-xl border border-gold/20 bg-white p-3 text-sm md:grid-cols-[repeat(4,minmax(0,1fr))_6rem_6rem_7rem_auto]">
      <input type="hidden" name="product_id" value={productId} />
      {v?.id && <input type="hidden" name="variant_id" value={v.id} />}
      {v?.on_hand !== undefined && v?.on_hand !== null && <input type="hidden" name="on_hand_before" value={v.on_hand} />}
      <label className="space-y-1"><span className="text-xs opacity-70">اسم الخيار</span>
        <input name="name" defaultValue={v?.name ?? ""} placeholder={isNew ? "مثال: كبير" : ""} className={f} /></label>
      <label className="space-y-1"><span className="text-xs opacity-70">اللون</span><input name="color" defaultValue={v?.color ?? ""} className={f} /></label>
      <label className="space-y-1"><span className="text-xs opacity-70">المقاس</span><input name="size" defaultValue={v?.size ?? ""} className={f} /></label>
      <label className="space-y-1"><span className="text-xs opacity-70">الخامة</span><input name="material" defaultValue={v?.material ?? ""} className={f} /></label>
      <label className="space-y-1"><span className="text-xs opacity-70">سعر خاص ₪</span>
        <input name="price_override" inputMode="decimal" defaultValue={v?.price_override ?? ""} placeholder="سعر المنتج" className={f} /></label>
      {canSeeCost ? (
        <label className="space-y-1"><span className="text-xs opacity-70">التكلفة ₪</span>
          <input name="unit_cost" inputMode="decimal" defaultValue={v?.unit_cost ?? ""} className={f} /></label>
      ) : <span />}
      <label className="space-y-1"><span className="text-xs opacity-70">الكمية{v?.reserved ? ` (محجوز ${v.reserved})` : ""}</span>
        <input name="on_hand" type="number" min={v?.reserved ?? 0} defaultValue={v?.on_hand ?? (isNew ? 0 : "")} className={f} /></label>
      <div className="flex items-center gap-2">
        {!isNew && (
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="is_active" defaultChecked={v?.is_active} className="accent-[var(--gold)]" />فعّال</label>
        )}
        <button disabled={pending} className="rounded-md bg-charcoal px-3 py-1.5 text-white hover:bg-[#3d372e] disabled:opacity-60">
          {pending ? "…" : isNew ? "إضافة" : "حفظ"}
        </button>
      </div>
      {!isNew && (
        <label className="space-y-1 md:col-span-4"><span className="text-xs opacity-70">سبب تعديل الكمية (يُسجَّل في سجل المخزون)</span>
          <input name="qty_reason" maxLength={200} placeholder="مثال: وصول بضاعة جديدة / بيع في المحل / جرد" className={f} /></label>
      )}
      {(state.error || state.message) && (
        <p role={state.error ? "alert" : "status"} className={`md:col-span-8 text-xs ${state.error ? "text-red-700" : "text-emerald-700"}`}>{state.error ?? state.message}</p>
      )}
    </form>
  );
}
