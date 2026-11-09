"use server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { isLocale, LOCALE_COOKIE } from "@/lib/admin/i18n";

export type SearchResults = {
  orders: { id: string; order_number: string; customer_name: string; status: string; total: number }[];
  customers: { id: string; name: string; phone: string }[];
  products: { id: string; name: string; status: string }[];
};
export type Notice = { kind: string; severity: "critical" | "warning" | "info"; href: string; count: number };

// البحث الشامل: النتائج مقيدة بصلاحيات الموظف داخل قاعدة البيانات
export async function searchAdmin(q: string): Promise<SearchResults> {
  await requireStaff();
  const query = String(q ?? "").trim().slice(0, 60);
  const empty = { orders: [], customers: [], products: [] };
  if (query.length < 2) return empty;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_search", { p_q: query });
  return error || !data ? empty : (data as SearchResults);
}

export async function loadNotifications(): Promise<Notice[]> {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_notifications");
  return (data ?? []) as Notice[];
}

// اللغة المفضلة تُحفظ في حساب الموظف (قاعدة البيانات) وفي كوكي لصفحات ما قبل الدخول
export async function setAdminLocale(locale: string) {
  if (!isLocale(locale)) return { error: "invalid" };
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_locale", { p_locale: locale });
  if (error) return { error: "failed" };
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/admin", sameSite: "lax", secure: true, httpOnly: true, maxAge: 60 * 60 * 24 * 365 });
  return { ok: true };
}
