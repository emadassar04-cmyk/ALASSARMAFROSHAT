import "server-only";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { DEFAULT_SITE_URL } from "./site";
import type { Branch, CampaignInfo, Category, DeliveryZone, Facets, PaymentMethod, Policy, ProductDetail, SearchParams, SearchResult, SitemapData, StoreSettings } from "./catalog-types";

// عميل عام بلا جلسة: الكتالوج بيانات عامة وقابلة للتخزين المؤقت
function publicClient() {
  return createSupabase(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await publicClient().rpc(fn, args);
  if (error) throw new Error(`catalog ${fn}: ${error.message}`);
  return data as T;
}

export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheTag("catalog");
  cacheLife("minutes");
  return rpc<Category[]>("catalog_categories");
}

export async function searchProducts(params: SearchParams): Promise<SearchResult> {
  "use cache";
  cacheTag("catalog");
  cacheLife("minutes");
  return rpc<SearchResult>("catalog_search", { p: params });
}

export async function getBestSellers(limit = 8): Promise<SearchResult["items"]> {
  "use cache";
  cacheTag("catalog");
  cacheLife("minutes");
  return rpc<SearchResult["items"]>("catalog_best_sellers", { p_limit: limit });
}

export async function getProduct(slug: string): Promise<ProductDetail | null> {
  "use cache";
  cacheTag("catalog", `product:${slug}`);
  cacheLife("minutes");
  return rpc<ProductDetail | null>("catalog_product", { p_slug: slug });
}

export async function getFacets(category?: string): Promise<Facets> {
  "use cache";
  cacheTag("catalog");
  cacheLife("minutes");
  return rpc<Facets>("catalog_facets", { p_category: category ?? null });
}

export async function getStoreSettings(): Promise<StoreSettings> {
  "use cache";
  cacheTag("settings");
  cacheLife("hours");
  const { data } = await publicClient()
    .from("store_settings")
    .select("store_name, whatsapp_number, contact_phone, is_published, maintenance_mode, site_url, ga_measurement_id, meta_pixel_id, google_site_verification")
    .single();
  return (data as StoreSettings | null) ?? {
    store_name: "مفروشات العصار – دير البلح – النصيرات",
    whatsapp_number: null, contact_phone: null, is_published: false, maintenance_mode: false,
    site_url: DEFAULT_SITE_URL, ga_measurement_id: null, meta_pixel_id: null, google_site_verification: null,
  };
}

// السياسات المنشورة فقط (للتذييل وصفحات /policies)
export async function getPolicies(): Promise<Policy[]> {
  "use cache";
  cacheTag("policies");
  cacheLife("hours");
  return rpc<Policy[]>("catalog_policies");
}

export async function getSitemapData(): Promise<SitemapData> {
  "use cache";
  cacheTag("catalog", "policies");
  cacheLife("hours");
  return rpc<SitemapData>("catalog_sitemap");
}

export async function getBranches(): Promise<Branch[]> {
  "use cache";
  cacheTag("settings");
  cacheLife("hours");
  return rpc<Branch[]>("catalog_branches");
}

// عروض: منتجات عليها خصم فعلي الآن
export async function getOffers(limit = 8): Promise<SearchResult["items"]> {
  "use cache";
  cacheTag("catalog");
  cacheLife("minutes");
  return rpc<SearchResult["items"]>("catalog_offers", { p_limit: limit });
}

// حملة السحب الحالية/القادمة + آخر فائز (بيانات عامة فقط)
export async function getCampaign(): Promise<CampaignInfo> {
  "use cache";
  cacheTag("campaign");
  cacheLife("minutes");
  return rpc<CampaignInfo>("catalog_campaign");
}

export async function getCheckoutOptions(): Promise<{ zones: DeliveryZone[]; methods: PaymentMethod[] }> {
  "use cache";
  cacheTag("settings");
  cacheLife("minutes");
  const db = publicClient();
  const [zones, methods] = await Promise.all([
    db.from("delivery_zones").select("id, name, fee, eta_text, sort_order").eq("is_active", true).order("sort_order").order("name"),
    db.from("payment_methods").select("code, name_ar, instructions, sort_order").eq("is_enabled", true).order("sort_order"),
  ]);
  return { zones: (zones.data ?? []) as DeliveryZone[], methods: (methods.data ?? []) as PaymentMethod[] };
}

export type TrackedOrder = {
  order_number: string; status: string; created_at: string; fulfillment: "delivery" | "pickup";
  payment_method: string; payment_status: string; subtotal: number; discount: number; delivery_fee: number; total: number;
  items: { name: string; variant: Record<string, string>; quantity: number; unit_price: number; line_total: number }[];
  history: { status: string; at: string }[];
};

// بلا تخزين مؤقت: حالة الطلب تتغير، والرمز السري مطلوب
export async function trackOrder(orderNumber: string, token: string): Promise<TrackedOrder | null> {
  if (!/^ALS-\d{1,10}$/.test(orderNumber) || !/^[0-9a-f]{64}$/.test(token)) return null;
  const { data } = await publicClient().rpc("track_order", { p_order_number: orderNumber, p_token: token });
  return (data as TrackedOrder | null) ?? null;
}

// خيارات استوديو التفصيل (الأقمشة بصورها والألوان) كما تديرها الإدارة — المفعّل فقط (RLS)
export type CustomOptions = {
  fabrics: Record<"curtains" | "ceiling" | "mattress" | "other", { name: string; texture: string | null }[]>;
  colors: { name: string; hex: string }[];
};
export async function getCustomOptions(): Promise<CustomOptions> {
  "use cache";
  cacheTag("custom-options");
  cacheLife("hours");
  const db = publicClient();
  const [f, c] = await Promise.all([
    db.from("custom_fabrics").select("product_type, name, texture_url").order("sort_order").order("name"),
    db.from("custom_colors").select("name, hex").order("sort_order").order("name"),
  ]);
  const fabrics: CustomOptions["fabrics"] = { curtains: [], ceiling: [], mattress: [], other: [] };
  for (const r of (f.data ?? []) as { product_type: keyof CustomOptions["fabrics"]; name: string; texture_url: string | null }[]) {
    fabrics[r.product_type]?.push({ name: r.name, texture: r.texture_url });
  }
  return { fabrics, colors: (c.data ?? []) as { name: string; hex: string }[] };
}
