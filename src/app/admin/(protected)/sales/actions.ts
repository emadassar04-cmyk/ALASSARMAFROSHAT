"use server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";

export type SaleResult =
  | { ok: true; amount: number; branch: string; phone: string; newCustomer: boolean; replayed: boolean }
  | { ok: false; error: string; duplicate?: boolean };

const ERRORS: Record<string, string> = {
  invalid_phone: "رقم الجوال غير صحيح. اكتبه هكذا: 0599123456",
  invalid_amount: "المبلغ غير صحيح. اكتب رقماً أكبر من صفر (منزلتان عشريتان كحد أقصى).",
  invalid_branch: "اختر الفرع.",
  missing_request_id: "أعد تحميل الصفحة وحاول مرة أخرى.",
  forbidden: "لا تملك صلاحية تسجيل المبيعات.",
};

// كل التحقق الحقيقي في قاعدة البيانات (record_store_purchase): الصلاحية، الرقم، المبلغ، الفرع، منع التكرار
export async function recordSale(input: { phone: string; amount: string; branchId: string; requestId: string; confirmDuplicate?: boolean }): Promise<SaleResult> {
  await requireStaff();
  const amountText = String(input.amount ?? "").trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(",", ".");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(amountText) || Number(amountText) <= 0) return { ok: false, error: ERRORS.invalid_amount };
  if (!/^[0-9a-f-]{36}$/i.test(input.requestId)) return { ok: false, error: ERRORS.missing_request_id };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_store_purchase", {
    p_phone: String(input.phone ?? "").slice(0, 30),
    p_amount: Number(amountText),
    p_branch_id: input.branchId,
    p_request_id: input.requestId,
    p_confirm_duplicate: !!input.confirmDuplicate,
  });
  if (error) {
    if (/possible_duplicate/.test(error.message)) {
      return { ok: false, duplicate: true, error: "سُجّلت عملية بنفس الرقم والمبلغ والفرع قبل أقل من دقيقتين. هل هذه عملية جديدة فعلاً؟" };
    }
    const key = Object.keys(ERRORS).find((k) => error.message.includes(k));
    return { ok: false, error: key ? ERRORS[key] : "تعذر التسجيل. تحقق من الاتصال وحاول مرة أخرى." };
  }
  const d = data as { amount: number; branch: string; phone: string; new_customer?: boolean; replayed: boolean };
  return { ok: true, amount: Number(d.amount), branch: d.branch, phone: d.phone, newCustomer: !!d.new_customer, replayed: d.replayed };
}
