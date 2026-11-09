"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";

export type ActionState = { ok?: boolean; error?: string };

const ERRORS: Record<string, string> = {
  reason_required: "اكتب السبب.",
  invalid_transition: "لا يمكن تنفيذ هذا الإجراء على هذه العملية في حالتها الحالية.",
  invalid_amount: "المبلغ غير صحيح.",
  invalid_branch: "الفرع غير صحيح.",
  forbidden: "لا تملك صلاحية مراجعة المبيعات.",
};
const msg = (m: string) => ERRORS[Object.keys(ERRORS).find((k) => m.includes(k)) ?? ""] ?? "تعذر تنفيذ الإجراء.";

export async function reviewPurchase(_: ActionState, f: FormData): Promise<ActionState> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_store_purchase", {
    p_id: String(f.get("id")), p_action: String(f.get("action")), p_reason: String(f.get("reason") ?? "").slice(0, 300) || null,
  });
  if (error) return { error: msg(error.message) };
  revalidatePath("/admin/purchases");
  return { ok: true };
}

export async function correctPurchase(_: ActionState, f: FormData): Promise<ActionState> {
  await requireStaff();
  const amount = String(f.get("amount") ?? "").trim().replace(",", ".");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(amount)) return { error: ERRORS.invalid_amount };
  const supabase = await createClient();
  const { error } = await supabase.rpc("correct_store_purchase", {
    p_id: String(f.get("id")), p_amount: Number(amount), p_branch_id: String(f.get("branch_id")), p_reason: String(f.get("reason") ?? "").slice(0, 300),
  });
  if (error) return { error: msg(error.message) };
  revalidatePath("/admin/purchases");
  return { ok: true };
}

export async function approveMany(ids: string[]): Promise<ActionState & { count?: number }> {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approve_store_purchases", { p_ids: ids.slice(0, 100) });
  if (error) return { error: msg(error.message) };
  revalidatePath("/admin/purchases");
  return { ok: true, count: data as number };
}
