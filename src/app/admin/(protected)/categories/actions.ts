"use server";
import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";

export type State = { ok?: boolean; error?: string };

const text = (f: FormData, k: string, max: number) => {
  const v = String(f.get(k) ?? "").trim().slice(0, max);
  return v || null;
};
const slugify = (name: string) =>
  name.trim().replace(/[\s_]+/g, "-").replace(/[^\p{L}\p{N}-]/gu, "").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

// الصلاحية (catalog.manage) تُفرض في قاعدة البيانات بسياسة RLS، والتغييرات تُسجَّل بمشغل التدقيق
export async function saveCategory(_: State, f: FormData): Promise<State> {
  await requireStaff();
  const id = String(f.get("id") ?? "");
  const name = text(f, "name", 80);
  if (!name) return { error: "name" };
  const image = text(f, "image_url", 500);
  if (image && !/^https:\/\//.test(image)) return { error: "generic" };
  const parent = text(f, "parent_id", 40);
  const fields = {
    name, description: text(f, "description", 1000), image_url: image,
    sort_order: Math.max(0, Math.min(9999, Number(f.get("sort_order")) || 0)), is_active: f.get("is_active") === "on",
    seo_title: text(f, "seo_title", 120), seo_description: text(f, "seo_description", 300),
    parent_id: parent && parent !== id && /^[0-9a-f-]{36}$/.test(parent) ? parent : null,
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("categories").update(fields).eq("id", id).select("id").single()
    : await supabase.from("categories").insert({ ...fields, slug: slugify(text(f, "slug", 80) ?? name) }).select("id").single();
  if (error) return { error: error.code === "23505" ? "duplicate" : /row-level|permission|PGRST116/.test(`${error.message}${error.code}`) ? "forbidden" : "generic" };
  updateTag("catalog");
  revalidatePath("/admin/categories");
  return { ok: true };
}
