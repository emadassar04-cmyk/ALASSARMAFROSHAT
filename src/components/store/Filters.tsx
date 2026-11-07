import type { Category, Facets, SearchParams } from "@/lib/catalog-types";

// فلاتر بنموذج GET عادي: تعمل دون JavaScript وتنتج روابط قابلة للمشاركة
export function Filters({ params, facets, categories, action, hideCategory = false }: {
  params: SearchParams;
  facets: Facets;
  categories: Category[];
  action: string;
  hideCategory?: boolean;
}) {
  const field = "w-full rounded-lg border border-gold/30 bg-white px-3 py-2 text-sm focus:border-gold focus:outline-none";
  return (
    <form action={action} className="space-y-4 rounded-2xl border border-gold/20 bg-white p-4">
      {params.q && <input type="hidden" name="q" value={params.q} />}
      <h2 className="font-bold">تصفية النتائج</h2>
      {!hideCategory && (
        <label className="block space-y-1 text-sm">
          <span>التصنيف</span>
          <select name="category" defaultValue={params.category ?? ""} className={field}>
            <option value="">الكل</option>
            {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
        </label>
      )}
      <fieldset className="space-y-1 text-sm">
        <legend>السعر (₪)</legend>
        <div className="flex gap-2">
          <input name="min" type="number" min={0} inputMode="numeric" placeholder={facets.price_min ? `من ${Math.floor(facets.price_min)}` : "من"} defaultValue={params.min_price ?? ""} className={field} aria-label="أقل سعر" />
          <input name="max" type="number" min={0} inputMode="numeric" placeholder={facets.price_max ? `إلى ${Math.ceil(facets.price_max)}` : "إلى"} defaultValue={params.max_price ?? ""} className={field} aria-label="أعلى سعر" />
        </div>
      </fieldset>
      {facets.colors.length > 0 && (
        <label className="block space-y-1 text-sm">
          <span>اللون</span>
          <select name="color" defaultValue={params.color ?? ""} className={field}>
            <option value="">الكل</option>
            {facets.colors.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
      )}
      {facets.sizes.length > 0 && (
        <label className="block space-y-1 text-sm">
          <span>المقاس</span>
          <select name="size" defaultValue={params.size ?? ""} className={field}>
            <option value="">الكل</option>
            {facets.sizes.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
      )}
      {facets.materials.length > 0 && (
        <label className="block space-y-1 text-sm">
          <span>الخامة</span>
          <select name="material" defaultValue={params.material ?? ""} className={field}>
            <option value="">الكل</option>
            {facets.materials.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="available" value="1" defaultChecked={params.availability === "available"} className="accent-[var(--gold)]" />
        المتوفر فقط
      </label>
      <label className="block space-y-1 text-sm">
        <span>الترتيب</span>
        <select name="sort" defaultValue={params.sort ?? ""} className={field}>
          <option value="">{params.q ? "الأكثر صلة" : "الأحدث"}</option>
          <option value="newest">الأحدث</option>
          <option value="price_asc">السعر: من الأقل</option>
          <option value="price_desc">السعر: من الأعلى</option>
          <option value="best_selling">الأكثر مبيعاً</option>
        </select>
      </label>
      <div className="flex gap-2">
        <button className="flex-1 rounded-lg bg-gold px-3 py-2 text-sm font-medium text-white hover:bg-gold-dark">تطبيق</button>
        <a href={params.q ? `${action}?q=${encodeURIComponent(params.q)}` : action} className="rounded-lg border border-gold/30 px-3 py-2 text-sm hover:bg-beige">مسح</a>
      </div>
    </form>
  );
}
