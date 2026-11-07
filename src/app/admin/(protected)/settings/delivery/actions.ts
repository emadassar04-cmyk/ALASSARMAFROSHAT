"use server";
import { updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FormState = { ok?: boolean; error?: string };

function fee(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  return /^\d{1,6}(\.\d{1,2})?$/.test(s) ? s : null;
}

export async function saveZone(_: FormState, f: FormData): Promise<FormState> {
  const name = String(f.get("name") ?? "").trim().slice(0, 100);
  const amount = fee(f.get("fee"));
  if (!name) return { error: "اكتب اسم المنطقة." };
  if (amount === null) return { error: "رسوم التوصيل يجب أن تكون رقماً (0 للتوصيل المجاني)." };
  const row = {
    name, fee: amount,
    eta_text: String(f.get("eta_text") ?? "").trim().slice(0, 60) || null,
    sort_order: Number(f.get("sort_order") ?? 0) || 0,
    is_active: f.get("is_active") === "on",
  };
  const id = String(f.get("id") ?? "");
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("delivery_zones").update(row).eq("id", id)
    : await supabase.from("delivery_zones").insert({ ...row, is_active: true });
  if (error) return { error: /permission|row-level/i.test(error.message) ? "لا تملك صلاحية تعديل الإعدادات." : "تعذر الحفظ." };
  updateTag("settings");
  return { ok: true };
}

export async function togglePaymentMethod(code: string, enabled: boolean): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("payment_methods").update({ is_enabled: enabled }).eq("code", code);
  if (error) return { error: "تعذر الحفظ." };
  updateTag("settings");
  return { ok: true };
}
