"use server";
import { updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok?: boolean; error?: string };

// رموز أخطاء ثابتة؛ الواجهة تترجمها حسب لغة الموظف (قاموس od.err)
const ERR: [RegExp, string][] = [
  [/reservation_expired/, "reservation_expired"], [/invalid_transition/, "invalid_transition"],
  [/requires_admin_approval/, "requires_admin_approval"], [/profit_exceeds_net_line/, "profit_exceeds_net_line"],
  [/order_not_confirmed/, "order_not_confirmed"], [/payment_not_reviewable/, "payment_not_reviewable"],
  [/address_locked/, "address_locked"], [/reason is required/, "reason_required"], [/invalid_amount/, "invalid_amount"],
  [/forbidden|permission/, "forbidden"],
];
function message(e: { message?: string } | null): string {
  const m = e?.message ?? "";
  return ERR.find(([re]) => re.test(m))?.[1] ?? "generic";
}

async function call(fn: string, args: Record<string, unknown>): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { error: message(error) };
  updateTag("catalog"); // التوفر قد يتغير (تأكيد/إلغاء)
  return { ok: true };
}

export async function confirmOrder(orderId: string, note?: string) {
  return call("confirm_order", { p_order_id: orderId, p_note: note || null });
}

export async function setOrderStatus(orderId: string, status: string, note?: string) {
  return call("update_order_status", { p_order_id: orderId, p_status: status, p_note: note || null });
}

export async function cancelOrder(orderId: string, reason: string, force: boolean) {
  return call("cancel_order", { p_order_id: orderId, p_reason: reason, p_force: force });
}

export async function setItemProfit(itemId: string, amount: string) {
  const v = amount.trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(v)) return { error: "invalid_amount" };
  return call("set_item_profit", { p_order_item_id: itemId, p_amount: v });
}

export async function reviewTransfer(orderId: string, approved: boolean, reference: string, note: string) {
  return call("review_bank_transfer", {
    p_order_id: orderId, p_approved: approved, p_amount: null, p_reference: reference || null, p_note: note || null });
}

export async function addNote(orderId: string, body: string) {
  if (!body.trim()) return { error: "empty_note" };
  return call("add_order_note", { p_order_id: orderId, p_body: body.trim().slice(0, 2000) });
}

export async function updateAddress(orderId: string, address: string) {
  return call("update_order_address", { p_order_id: orderId, p_address: address.slice(0, 500), p_note: null });
}
