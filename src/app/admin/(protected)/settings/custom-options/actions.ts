"use server";
import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, can } from "@/lib/staff";

// إدارة خيارات التفصيل: الصلاحية هنا وفي قاعدة البيانات (RLS: catalog.manage)، وكل تعديل مسجل تلقائياً
type Table = "custom_fabrics" | "custom_colors";
const TYPES = ["curtains", "ceiling", "mattress", "other"];
const okUrl = (u: unknown) => u === null || (typeof u === "string" && /^(https:\/\/|\/)[^\s"<>]+$/.test(u) && u.length < 500);

async function guard() {
  const staff = await requireStaff();
  return can(staff, "catalog.manage");
}
function done() { updateTag("custom-options"); revalidatePath("/admin/settings/custom-options"); return { ok: true as const }; }

export async function addOption(table: Table, input: { product_type?: string; name: string; hex?: string; texture_url?: string | null }) {
  if (!(await guard())) return { ok: false as const, error: "forbidden" };
  const name = input.name.trim().slice(0, table === "custom_colors" ? 40 : 60);
  if (!name) return { ok: false as const, error: "name" };
  const supabase = await createClient();
  const row: Record<string, unknown> = table === "custom_colors"
    ? { name, hex: String(input.hex ?? "").toLowerCase(), sort_order: 100 }
    : { name, product_type: input.product_type, texture_url: input.texture_url ?? null, sort_order: 100 };
  if (table === "custom_fabrics" && (!TYPES.includes(String(input.product_type)) || !okUrl(row.texture_url ?? null))) return { ok: false as const, error: "invalid" };
  if (table === "custom_colors" && !/^#[0-9a-f]{6}$/.test(String(row.hex))) return { ok: false as const, error: "invalid" };
  const { error } = await supabase.from(table).insert(row);
  return error ? { ok: false as const, error: error.code === "23505" ? "duplicate" : error.message } : done();
}

export async function updateOption(table: Table, id: string, patch: { name?: string; hex?: string; sort_order?: number; is_active?: boolean; texture_url?: string | null }) {
  if (!(await guard())) return { ok: false as const, error: "forbidden" };
  const clean: Record<string, unknown> = {};
  if (patch.name !== undefined) clean.name = patch.name.trim().slice(0, 60);
  if (patch.hex !== undefined) { if (!/^#[0-9a-fA-F]{6}$/.test(patch.hex)) return { ok: false as const, error: "invalid" }; clean.hex = patch.hex.toLowerCase(); }
  if (patch.sort_order !== undefined) clean.sort_order = Math.max(0, Math.min(9999, Math.round(patch.sort_order)));
  if (patch.is_active !== undefined) clean.is_active = !!patch.is_active;
  if (patch.texture_url !== undefined) { if (table !== "custom_fabrics" || !okUrl(patch.texture_url)) return { ok: false as const, error: "invalid" }; clean.texture_url = patch.texture_url; }
  const supabase = await createClient();
  const { error } = await supabase.from(table).update(clean).eq("id", id);
  return error ? { ok: false as const, error: error.message } : done();
}

export async function deleteOption(table: Table, id: string) {
  if (!(await guard())) return { ok: false as const, error: "forbidden" };
  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq("id", id);
  return error ? { ok: false as const, error: error.message } : done();
}
