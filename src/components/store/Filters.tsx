import type { Category, Facets, SearchParams } from "@/lib/catalog-types";

// فلاتر بنموذج GET عادي: تعمل دون JavaScript وتنتج روابط قابلة للمشاركة
// الخيارات (الألوان، المقاسات، الخامات، نطاق السعر) من بيانات المنتجات الفعلية فقط
export function Filters({ params, facets, categories, action, hideCategory = false }: {
  params: SearchParams;
  facets: Facets;
  categories: Category[];
  action: string;
  hideCategory?: boolean;
}) {
  const label = "block space-y-1.5 text-sm";
  const title = "font-medium text-charcoal";
  return (
    <form action={action} className="space-y-5">
      {params.q && <input type="hidden" name="q" value={params.q} />}
      <h2 className="font-sans text-base font-semibold max-lg:sr-only">تصفية النتائج</h2>
      <label className={label}>
        <span className={title}>الترتيب</span>
        <select name="sort" defaultValue={params.sort ?? ""} className="field">
          <option value="">{params.q ? "الأكثر صلة" : "الأحدث"}</option>
          <option value="newest">الأحدث</option>
          <option value="price_asc">السعر: من الأقل</option>
          <option value="price_desc">السعر: من الأعلى</option>
          <option value="best_selling">الأكثر مبيعاً</option>
        </select>
      </label>
      {!hideCategory && (
        <label className={label}>
          <span className={title}>القسم</span>
          <select name="category" defaultValue={params.category ?? ""} className="field">
            <option value="">كل الأقسام</option>
            {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
        </label>
      )}
      <fieldset className="space-y-1.5 text-sm">
        <legend className={`${title} mb-1.5`}>السعر (₪)</legend>
        <div className="flex gap-2">
          <input name="min" type="number" min={0} inputMode="numeric" placeholder={facets.price_min ? `من ${Math.floor(facets.price_min)}` : "من"} defaultValue={params.min_price ?? ""} className="field" aria-label="أقل سعر" />
          <input name="max" type="number" min={0} inputMode="numeric" placeholder={facets.price_max ? `إلى ${Math.ceil(facets.price_max)}` : "إلى"} defaultValue={params.max_price ?? ""} className="field" aria-label="أعلى سعر" />
        </div>
      </fieldset>
      {facets.colors.length > 0 && (
        <label className={label}>
          <span className={title}>اللون</span>
          <select name="color" defaultValue={params.color ?? ""} className="field">
            <option value="">الكل</option>
            {facets.colors.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
      )}
      {facets.sizes.length > 0 && (
        <label className={label}>
          <span className={title}>المقاس</span>
          <select name="size" defaultValue={params.size ?? ""} className="field">
            <option value="">الكل</option>
            {facets.sizes.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
      )}
      {facets.materials.length > 0 && (
        <label className={label}>
          <span className={title}>الخامة</span>
          <select name="material" defaultValue={params.material ?? ""} className="field">
            <option value="">الكل</option>
            {facets.materials.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
      )}
      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input type="checkbox" name="available" value="1" defaultChecked={params.availability === "available"} className="h-4 w-4 accent-[var(--charcoal)]" />
        المتوفر فقط
      </label>
      <div className="flex gap-2 pt-1">
        <button className="btn btn-primary flex-1">تطبيق</button>
        <a href={params.q ? `${action}?q=${encodeURIComponent(params.q)}` : action} className="btn btn-outline">مسح</a>
      </div>
    </form>
  );
}
