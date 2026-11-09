"use client";
import { useActionState } from "react";
import { useI18n } from "@/components/admin/I18nProvider";
import { saveCategory } from "./actions";

export type Cat = {
  id?: string; name?: string; slug?: string; description?: string | null; image_url?: string | null; sort_order?: number;
  is_active?: boolean; seo_title?: string | null; seo_description?: string | null; parent_id?: string | null;
};

export function CategoryForm({ c = {}, parents }: { c?: Cat; parents: { id: string; name: string }[] }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(saveCategory, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {c.id && <input type="hidden" name="id" value={c.id} />}
      <label className="block"><span className="a-label">{t.categories.name}</span><input name="name" required maxLength={80} defaultValue={c.name} className="a-input" /></label>
      {c.id ? <p className="block"><span className="a-label">{t.categories.slug}</span><span dir="auto" className="a-input flex items-center bg-[#faf8f4]">{c.slug}</span></p>
        : <label className="block"><span className="a-label">{t.categories.slug}</span><input name="slug" maxLength={80} placeholder={t.categories.name} className="a-input" /></label>}
      <label className="block sm:col-span-2"><span className="a-label">{t.categories.description}</span><textarea name="description" rows={2} maxLength={1000} defaultValue={c.description ?? ""} className="a-input" /></label>
      <label className="block"><span className="a-label">{t.categories.parent}</span>
        <select name="parent_id" defaultValue={c.parent_id ?? ""} className="a-input">
          <option value="">{t.categories.none}</option>
          {parents.filter((p) => p.id !== c.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select></label>
      <label className="block"><span className="a-label">{t.categories.sort}</span><input name="sort_order" type="number" min={0} max={9999} defaultValue={c.sort_order ?? 0} className="a-input" /></label>
      <label className="block sm:col-span-2"><span className="a-label">{t.categories.image}</span><input name="image_url" type="url" dir="ltr" maxLength={500} defaultValue={c.image_url ?? ""} placeholder="https://" className="a-input" /></label>
      <label className="block"><span className="a-label">{t.categories.seoTitle}</span><input name="seo_title" maxLength={120} defaultValue={c.seo_title ?? ""} className="a-input" /></label>
      <label className="block"><span className="a-label">{t.categories.seoDescription}</span><input name="seo_description" maxLength={300} defaultValue={c.seo_description ?? ""} className="a-input" /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={c.is_active ?? true} />{t.categories.active}</label>
      <div className="flex items-center justify-end gap-3">
        {state.error && <span role="alert" className="text-sm text-[var(--a-danger-ink)]">{t.categories.err[state.error] ?? t.categories.err.generic}</span>}
        {state.ok && <span role="status" className="text-sm text-[var(--a-success)]">{t.categories.saved}</span>}
        <button disabled={pending} className="a-btn a-btn-primary">{t.common.save}</button>
      </div>
    </form>
  );
}
