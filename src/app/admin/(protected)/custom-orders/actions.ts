"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, can } from "@/lib/staff";

// تحديث طلب تفصيل: الصلاحية تُفحص هنا وفي قاعدة البيانات (update_custom_order تتطلب orders.manage)
export async function updateCustomOrder(id: string, input: { status: string; price: string; clearPrice: boolean; note: string }) {
  const staff = await requireStaff();
  if (!can(staff, "orders.manage")) return { ok: false, error: "forbidden" };
  const price = input.price.trim() === "" ? null : Number(input.price.replace(",", "."));
  if (price !== null && (!Number.isFinite(price) || price < 0)) return { ok: false, error: "invalid_price" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_custom_order", {
    p_id: id, p_status: input.status || null, p_final_price: input.clearPrice ? null : price, p_note: input.note.trim() || null, p_clear_price: input.clearPrice,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/custom-orders/${id}`);
  revalidatePath("/admin/custom-orders");
  return { ok: true };
}
