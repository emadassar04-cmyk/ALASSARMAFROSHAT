"use client";
import { useActionState, useState } from "react";
import type { FormState } from "./actions";
import { toGazaLocalInput } from "@/lib/admin/actions-util";

type Option = { id: string | number; name: string };
export type ProductValues = {
  id?: string; name?: string; slug?: string; description?: string | null; category_id?: string | null; unit_id?: number;
  status?: string; availability_mode?: string; requires_measurement?: boolean; price?: string | null; sale_price?: string | null;
  sale_starts_at?: string | null; sale_ends_at?: string | null;
  prep_days_min?: number | null; prep_days_max?: number | null; is_featured?: boolean; low_stock_threshold?: number;
  materials?: string[]; seo_title?: string | null; seo_description?: string | null;
};

const field = "w-full rounded-lg border border-gold/30 bg-white px-3 py-2 text-sm focus:border-gold focus:outline-none";
const label = "block space-y-1 text-sm";

export function ProductForm({ action, values = {}, categories, units, isNew }: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  values?: ProductValues;
  categories: Option[];
  units: Option[];
  isNew: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [measured, setMeasured] = useState(!!values.requires_measurement);

  return (
    <form action={formAction} className="space-y-5 rounded-2xl border border-gold/20 bg-white p-5">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <div className="grid gap-4 md:grid-cols-2">
        <label className={label}><span>اسم المنتج *</span>
          <input name="name" required maxLength={200} defaultValue={values.name} className={field} /></label>
        <label className={label}><span>الرابط (slug) — يُولَّد من الاسم إن تُرك فارغاً</span>
          <input name="slug" maxLength={80} defaultValue={values.slug} className={field} placeholder="مثال: سجادة-تركية" /></label>
        <label className={label}><span>التصنيف</span>
          <select name="category_id" defaultValue={values.category_id ?? ""} className={field}>
            <option value="">بدون تصنيف</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
        <label className={label}><span>وحدة القياس *</span>
          <select name="unit_id" required defaultValue={values.unit_id ?? units[0]?.id} className={field}>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select></label>
      </div>

      <label className={label}><span>الوصف</span>
        <textarea name="description" rows={4} maxLength={5000} defaultValue={values.description ?? ""} className={field} /></label>

      <fieldset className="space-y-3 rounded-xl bg-beige/50 p-4">
        <legend className="px-1 font-bold">السعر والتوفر</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="requires_measurement" checked={measured} onChange={(e) => setMeasured(e.target.checked)} className="accent-[var(--gold)]" />
          منتج حسب المقاس/التفصيل (لا يُعرض له سعر، والطلب عبر WhatsApp)
        </label>
        {!measured && (
          <div className="grid gap-4 md:grid-cols-2">
            <label className={label}><span>السعر (₪)</span>
              <input name="price" inputMode="decimal" defaultValue={values.price ?? ""} className={field} placeholder="مثال: 450" /></label>
            <label className={label}><span>سعر الخصم (₪) — اختياري</span>
              <input name="sale_price" inputMode="decimal" defaultValue={values.sale_price ?? ""} className={field} /></label>
            <label className={label}><span>يبدأ الخصم (اختياري، توقيت فلسطين)</span>
              <input name="sale_starts_at" type="datetime-local" defaultValue={toGazaLocalInput(values.sale_starts_at)} className={field} /></label>
            <label className={label}><span>ينتهي الخصم (اختياري)</span>
              <input name="sale_ends_at" type="datetime-local" defaultValue={toGazaLocalInput(values.sale_ends_at)} className={field} /></label>
          </div>
        )}
        {isNew && (
          <div className="grid gap-4 md:grid-cols-2">
            <label className={label}><span>تكلفة الشراء (₪) — سرية، لا تظهر للزبائن</span>
              <input name="unit_cost" inputMode="decimal" className={field} /></label>
            <label className={label}><span>الكمية المتوفرة الآن</span>
              <input name="initial_qty" type="number" min={0} defaultValue={0} className={field} /></label>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          <label className={label}><span>حالة التوفر</span>
            <select name="availability_mode" defaultValue={values.availability_mode ?? "stock"} className={field}>
              <option value="stock">حسب الكمية (متوفر / محدود / نافد)</option>
              <option value="made_to_order">متوفر حسب الطلب</option>
              <option value="coming_soon">قريباً في المتجر</option>
              <option value="unavailable">غير متوفر</option>
            </select></label>
          <label className={label}><span>تنبيه &quot;كمية محدودة&quot; عند</span>
            <input name="low_stock_threshold" type="number" min={0} defaultValue={values.low_stock_threshold ?? 2} className={field} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className={label}><span>التجهيز من (يوم)</span>
              <input name="prep_days_min" type="number" min={0} defaultValue={values.prep_days_min ?? ""} className={field} /></label>
            <label className={label}><span>إلى (يوم)</span>
              <input name="prep_days_max" type="number" min={0} defaultValue={values.prep_days_max ?? ""} className={field} /></label>
          </div>
        </div>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <label className={label}><span>الخامات (افصل بفاصلة)</span>
          <input name="materials" defaultValue={(values.materials ?? []).join("، ")} className={field} placeholder="قطن، بوليستر" /></label>
        <label className={label}><span>حالة النشر</span>
          <select name="status" defaultValue={values.status ?? "draft"} className={field}>
            <option value="draft">مسودة (لا يظهر للزبائن)</option>
            <option value="active">منشور</option>
            <option value="archived">مؤرشف</option>
          </select></label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_featured" defaultChecked={values.is_featured} className="accent-[var(--gold)]" /> منتج مميز (يظهر في الصفحة الرئيسية)
      </label>

      <details className="rounded-xl border border-gold/20 p-3 text-sm">
        <summary className="cursor-pointer font-medium">إعدادات محركات البحث (SEO) — اختياري</summary>
        <div className="mt-3 space-y-3">
          <label className={label}><span>عنوان SEO (حتى 70 حرفاً)</span><input name="seo_title" maxLength={70} defaultValue={values.seo_title ?? ""} className={field} /></label>
          <label className={label}><span>وصف SEO (حتى 160 حرفاً)</span><textarea name="seo_description" maxLength={160} rows={2} defaultValue={values.seo_description ?? ""} className={field} /></label>
        </div>
      </details>

      {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state.message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{state.message}</p>}
      <button disabled={pending} className="rounded-lg bg-gold px-6 py-2.5 font-medium text-white hover:bg-gold-dark disabled:opacity-60">
        {pending ? "جارٍ الحفظ…" : isNew ? "إضافة المنتج" : "حفظ التغييرات"}
      </button>
    </form>
  );
}
