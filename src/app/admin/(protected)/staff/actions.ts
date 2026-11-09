"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";

// رموز أخطاء ثابتة تترجمها الواجهة (staff.err)
export type State = { ok?: boolean; error?: string };
const CODES = ["invalid_email", "invalid_role", "cannot_change_self", "cannot_change_owner", "invalid_permission", "forbidden"];
const code = (m: string) => CODES.find((c) => m.includes(c)) ?? "generic";

export async function inviteStaff(_: State, f: FormData): Promise<State> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_invite", { p_email: String(f.get("email") ?? "").trim(), p_role: String(f.get("role") ?? "") });
  if (error) return { error: code(error.message) };
  revalidatePath("/admin/staff");
  return { ok: true };
}

export async function updateStaff(_: State, f: FormData): Promise<State> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_update", {
    p_user_id: String(f.get("id")), p_role: String(f.get("role")), p_active: f.get("active") === "on",
  });
  if (error) return { error: code(error.message) };
  revalidatePath("/admin/staff");
  return { ok: true };
}

// مصفوفة الصلاحيات: التحقق (staff.manage، ومنع تعديل المدير العام) داخل set_role_permissions
export async function saveRolePermissions(_: State, f: FormData): Promise<State> {
  await requireStaff();
  const supabase = await createClient();
  const perms = f.getAll("perm").map(String).filter((p) => /^[a-z_.]+$/.test(p));
  const { error } = await supabase.rpc("set_role_permissions", { p_role: String(f.get("role") ?? ""), p_permissions: perms });
  if (error) return { error: code(error.message) };
  revalidatePath("/admin", "layout");
  return { ok: true };
}
