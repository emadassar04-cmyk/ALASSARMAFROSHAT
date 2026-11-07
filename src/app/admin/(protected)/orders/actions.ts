"use server";
import { updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok?: boolean; error?: string };

const ERR: [RegExp, string][] = [
  [/reservation_expired/, "انتهت مدة الحجز (ساعتان). الطلب سيُلغى تلقائياً؛ أنشئ طلباً جديداً إن لزم."],
  [/invalid_transition/, "لا يمكن الانتقال إلى هذه الحالة من الحالة الحالية."],
  [/requires_admin_approval/, "الطلب بدأ تجهيزه: الإلغاء يحتاج تأكيد «موافقة الإدارة»."],
  [/profit_exceeds_net_line/, "الربح لا يمكن أن يتجاوز صافي قيمة البند."],
  [/order_not_confirmed/, "يُسجَّل الربح بعد تأكيد الطلب فقط."],
  [/payment_not_reviewable/, "لا يوجد تحويل بنكي بانتظار المراجعة لهذا الطلب."],
  [/address_locked/, "لا يمكن تعديل العنوان بعد خروج الطلب للتوصيل."],
  [/reason is required/, "اكتب سبب الإلغاء."],
  [/invalid_amount/, "قيمة غير صحيحة (رقم موجب بحد أقصى منزلتين عشريتين)."],
  [/forbidden|permission/, "لا تملك صلاحية تنفيذ هذه العملية."],
];
function message(e: { message?: string } | null): string {
  const m = e?.message ?? "";
  return ERR.find(([re]) => re.test(m))?.[1] ?? "تعذر تنفيذ العملية. حاول مرة أخرى.";
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
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(v)) return { error: "اكتب الربح كرقم، مثل 25 أو 25.50" };
  return call("set_item_profit", { p_order_item_id: itemId, p_amount: v });
}

export async function reviewTransfer(orderId: string, approved: boolean, reference: string, note: string) {
  return call("review_bank_transfer", {
    p_order_id: orderId, p_approved: approved, p_amount: null, p_reference: reference || null, p_note: note || null });
}

export async function addNote(orderId: string, body: string) {
  if (!body.trim()) return { error: "الملاحظة فارغة." };
  return call("add_order_note", { p_order_id: orderId, p_body: body.trim().slice(0, 2000) });
}

export async function updateAddress(orderId: string, address: string) {
  return call("update_order_address", { p_order_id: orderId, p_address: address.slice(0, 500), p_note: null });
}
