import "server-only";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import type { Category, DeliveryZone, Facets, PaymentMethod, ProductDetail, SearchParams, SearchResult, StoreSettings } from "./catalog-types";

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
    .select("store_name, whatsapp_number, contact_phone, is_published, maintenance_mode")
    .single();
  return (data as StoreSettings | null) ?? {
    store_name: "مفروشات العصار – دير البلح – النصيرات",
    whatsapp_number: null, contact_phone: null, is_published: false, maintenance_mode: false,
  };
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
