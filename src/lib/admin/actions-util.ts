// أدوات مشتركة لإجراءات الإدارة (ليست ملف "use server" حتى تُصدَّر دوال عادية)
export type Result = { ok?: boolean; error?: string; message?: string };

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export const toLatinDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));

export function moneyString(v: FormDataEntryValue | null, { optional = false } = {}): string | null {
  const s = toLatinDigits(String(v ?? "").trim()).replace(/[,،]/g, "");
  if (!s) {
    if (optional) return null;
    throw new Error("المبلغ مطلوب.");
  }
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(s)) throw new Error("اكتب المبلغ كرقم (حتى منزلتين عشريتين).");
  return s;
}

export function intOrNull(v: FormDataEntryValue | null, min = 0, max = 1_000_000): number | null {
  const s = toLatinDigits(String(v ?? "").trim());
  if (!s) return null;
  const n = Number(s);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error("رقم غير صحيح.");
  return n;
}

const KNOWN: [RegExp, string][] = [
  [/forbidden|permission|row-level/i, "لا تملك صلاحية تنفيذ هذه العملية."],
  [/insufficient_stock/, "الكمية المتاحة غير كافية (الكميات المحجوزة لطلبات قائمة لا تُباع)."],
  [/below reserved|stocktake_below_reserved/, "لا يمكن أن تصبح الكمية أقل من المحجوز لطلبات قائمة."],
  [/stocktake_already_open/, "يوجد جرد مفتوح بالفعل. أكمله أو ألغه أولاً."],
  [/stocktake_not_open/, "هذا الجرد مغلق."],
  [/expense_not_found_or_voided/, "المصروف غير موجود أو أُلغي مسبقاً."],
  [/invalid_amount/, "مبلغ غير صحيح."],
  [/invalid_date/, "تاريخ غير صحيح."],
  [/reason is required/, "اكتب السبب."],
  [/coupons_code_key|duplicate key/, "هذا الكود مستخدم لكوبون آخر."],
  [/coupons_check|check constraint/, "قيم الكوبون غير منطقية (النسبة ≤ 100، والنهاية بعد البداية)."],
];
export function dbMessage(e: { message?: string } | null | undefined): string {
  const m = e?.message ?? "";
  return KNOWN.find(([re]) => re.test(m))?.[1] ?? "تعذر الحفظ. حاول مرة أخرى.";
}

// تاريخ ووقت من حقل datetime-local بتوقيت فلسطين (يتبع التوقيت الصيفي تلقائياً في PostgreSQL)
export function gazaDateTime(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) throw new Error("تاريخ غير صحيح.");
  return `${s}:00 Asia/Gaza`;
}

export function toGazaLocalInput(iso?: string | null): string {
  return iso ? new Date(iso).toLocaleString("sv", { timeZone: "Asia/Gaza" }).slice(0, 16).replace(" ", "T") : "";
}
