import "server-only";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import type { Category, Facets, ProductDetail, SearchParams, SearchResult, StoreSettings } from "./catalog-types";

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
