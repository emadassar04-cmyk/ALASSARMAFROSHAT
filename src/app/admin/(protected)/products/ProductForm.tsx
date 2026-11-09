"use client";
import { useActionState, useState } from "react";
import type { FormState } from "./actions";
import { toGazaLocalInput } from "@/lib/admin/actions-util";
import { useI18n } from "@/components/admin/I18nProvider";

type Option = { id: string | number; name: string };
export type ProductValues = {
  id?: string; name?: string; slug?: string; description?: string | null; category_id?: string | null; unit_id?: number;
  status?: string; availability_mode?: string; requires_measurement?: boolean; price?: string | null; sale_price?: string | null;
  sale_starts_at?: string | null; sale_ends_at?: string | null;
  prep_days_min?: number | null; prep_days_max?: number | null; is_featured?: boolean; low_stock_threshold?: number;
  materials?: string[]; seo_title?: string | null; seo_description?: string | null;
};

const field = "a-input";
const label = "block";

export function ProductForm({ action, values = {}, categories, units, isNew }: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  values?: ProductValues;
  categories: Option[];
  units: Option[];
  isNew: boolean;
}) {
  const { t, tx } = useI18n();
  const P = t.pf;
  const [state, formAction, pending] = useActionState(action, {});
  const [measured, setMeasured] = useState(!!values.requires_measurement);

  return (
    <form action={formAction} className="a-card space-y-5 p-5">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <div className="grid gap-4 md:grid-cols-2">
        <label className={label}><span className="a-label">{P.name}</span>
          <input name="name" required maxLength={200} defaultValue={values.name} className={field} /></label>
        <label className={label}><span className="a-label">{P.slug}</span>
          <input name="slug" maxLength={80} defaultValue={values.slug} className={field} placeholder={P.slugPh} /></label>
        <label className={label}><span className="a-label">{P.category}</span>
          <select name="category_id" defaultValue={values.category_id ?? ""} className={field}>
            <option value="">{P.noCategory}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
        <label className={label}><span className="a-label">{P.unit}</span>
          <select name="unit_id" required defaultValue={values.unit_id ?? units[0]?.id} className={field}>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select></label>
      </div>

      <label className={label}><span className="a-label">{P.description}</span>
        <textarea name="description" rows={4} maxLength={5000} defaultValue={values.description ?? ""} className={field} /></label>

      <fieldset className="space-y-3 rounded-[12px] border border-[var(--a-line)] bg-[#fcfbf8] p-4">
        <legend className="px-1 font-bold">{P.priceAvail}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="requires_measurement" checked={measured} onChange={(e) => setMeasured(e.target.checked)} className="accent-[var(--gold)]" />
          {P.measured}
        </label>
        {!measured && (
          <div className="grid gap-4 md:grid-cols-2">
            <label className={label}><span className="a-label">{P.price}</span>
              <input name="price" inputMode="decimal" defaultValue={values.price ?? ""} className={field} placeholder={P.pricePh} /></label>
            <label className={label}><span className="a-label">{P.salePrice}</span>
              <input name="sale_price" inputMode="decimal" defaultValue={values.sale_price ?? ""} className={field} /></label>
            <label className={label}><span className="a-label">{P.saleStart}</span>
              <input name="sale_starts_at" type="datetime-local" defaultValue={toGazaLocalInput(values.sale_starts_at)} className={field} /></label>
            <label className={label}><span className="a-label">{P.saleEnd}</span>
              <input name="sale_ends_at" type="datetime-local" defaultValue={toGazaLocalInput(values.sale_ends_at)} className={field} /></label>
          </div>
        )}
        {isNew && (
          <div className="grid gap-4 md:grid-cols-2">
            <label className={label}><span className="a-label">{P.cost}</span>
              <input name="unit_cost" inputMode="decimal" className={field} /></label>
            <label className={label}><span className="a-label">{P.initialQty}</span>
              <input name="initial_qty" type="number" min={0} defaultValue={0} className={field} /></label>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          <label className={label}><span className="a-label">{P.availability}</span>
            <select name="availability_mode" defaultValue={values.availability_mode ?? "stock"} className={field}>
              <option value="stock">{P.avStock}</option>
              <option value="made_to_order">{P.avMto}</option>
              <option value="coming_soon">{P.avSoon}</option>
              <option value="unavailable">{P.avNone}</option>
            </select></label>
          <label className={label}><span className="a-label">{P.lowAt}</span>
            <input name="low_stock_threshold" type="number" min={0} defaultValue={values.low_stock_threshold ?? 2} className={field} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className={label}><span className="a-label">{P.prepFrom}</span>
              <input name="prep_days_min" type="number" min={0} defaultValue={values.prep_days_min ?? ""} className={field} /></label>
            <label className={label}><span className="a-label">{P.prepTo}</span>
              <input name="prep_days_max" type="number" min={0} defaultValue={values.prep_days_max ?? ""} className={field} /></label>
          </div>
        </div>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <label className={label}><span className="a-label">{P.materials}</span>
          <input name="materials" defaultValue={(values.materials ?? []).join("، ")} className={field} placeholder={P.materialsPh} /></label>
        <label className={label}><span className="a-label">{P.status}</span>
          <select name="status" defaultValue={values.status ?? "draft"} className={field}>
            <option value="draft">{P.stDraft}</option>
            <option value="active">{P.stActive}</option>
            <option value="archived">{P.stArchived}</option>
          </select></label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_featured" defaultChecked={values.is_featured} className="accent-[var(--gold)]" /> {P.featured}
      </label>

      <details className="rounded-[12px] border border-[var(--a-line)] p-3 text-sm">
        <summary className="cursor-pointer font-medium">{P.seo}</summary>
        <div className="mt-3 space-y-3">
          <label className={label}><span className="a-label">{P.seoTitle}</span><input name="seo_title" maxLength={70} defaultValue={values.seo_title ?? ""} className={field} /></label>
          <label className={label}><span className="a-label">{P.seoDesc}</span><textarea name="seo_description" maxLength={160} rows={2} defaultValue={values.seo_description ?? ""} className={field} /></label>
        </div>
      </details>

      {state.error && <p role="alert" className="rounded-[10px] bg-[#fdf3f3] p-3 text-sm text-[var(--a-danger-ink)]">{tx(state.error)}</p>}
      {state.message && <p role="status" className="rounded-[10px] bg-[#f1faf5] p-3 text-sm text-[var(--a-success)]">{tx(state.message)}</p>}
      <button disabled={pending} className="a-btn a-btn-primary px-6">
        {pending ? P.saving : isNew ? P.add : P.saveChanges}
      </button>
    </form>
  );
}
