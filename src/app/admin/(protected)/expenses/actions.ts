"use server";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dbMessage, moneyString, type Result } from "@/lib/admin/actions-util";

export async function addExpense(_: Result, f: FormData): Promise<Result> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("add_expense", {
      p_category: String(f.get("category")),
      p_amount: moneyString(f.get("amount")),
      p_description: String(f.get("description") ?? "").slice(0, 500),
      p_spent_on: String(f.get("spent_on") ?? "") || null,
    });
    if (error) return { error: dbMessage(error) };
    refresh();
    return { ok: true, message: "تمت إضافة المصروف." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function voidExpense(id: string, reason: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_expense", { p_id: id, p_reason: reason });
  return error ? { error: dbMessage(error) } : { ok: true };
}
