import type { SearchParams } from "./catalog-types";

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const num = (v: string | undefined) => (v && /^\d+(\.\d+)?$/.test(v) ? Number(v) : undefined);
const SORTS = new Set(["newest", "price_asc", "price_desc", "best_selling", "relevance"]);

// تحويل معاملات الرابط إلى معاملات بحث آمنة ومحدودة
export function parseSearchParams(raw: Raw, overrides: Partial<SearchParams> = {}): SearchParams {
  const sort = one(raw.sort);
  const page = num(one(raw.page));
  return {
    q: one(raw.q)?.slice(0, 100),
    category: one(raw.category),
    min_price: num(one(raw.min)),
    max_price: num(one(raw.max)),
    availability: one(raw.available) === "1" ? "available" : undefined,
    color: one(raw.color),
    size: one(raw.size),
    material: one(raw.material),
    sort: sort && SORTS.has(sort) ? (sort as SearchParams["sort"]) : undefined,
    page: page && page >= 1 && page <= 500 ? Math.floor(page) : 1,
    ...overrides,
  };
}
