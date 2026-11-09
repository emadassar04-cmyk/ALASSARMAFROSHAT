"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";

export type State = { ok?: boolean; error?: string };
const ERRORS: [RegExp, string][] = [
  [/invalid_email/, "البريد الإلكتروني غير صحيح."],
  [/invalid_role/, "اختر دوراً صحيحاً."],
  [/cannot_change_self/, "لا يمكنك تعديل حسابك أنت."],
  [/cannot_change_owner/, "لا يمكن تعديل حساب المدير الكامل من هنا."],
  [/forbidden/, "لا تملك صلاحية إدارة الموظفين."],
];
const msg = (m: string) => ERRORS.find(([re]) => re.test(m))?.[1] ?? "تعذر الحفظ.";

export async function inviteStaff(_: State, f: FormData): Promise<State> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_invite", { p_email: String(f.get("email") ?? "").trim(), p_role: String(f.get("role") ?? "") });
  if (error) return { error: msg(error.message) };
  revalidatePath("/admin/staff");
  return { ok: true };
}

export async function updateStaff(_: State, f: FormData): Promise<State> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_update", {
    p_user_id: String(f.get("id")), p_role: String(f.get("role")), p_active: f.get("active") === "on",
  });
  if (error) return { error: msg(error.message) };
  revalidatePath("/admin/staff");
  return { ok: true };
}
