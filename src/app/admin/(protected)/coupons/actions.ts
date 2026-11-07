"use server";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dbMessage, gazaDateTime, intOrNull, moneyString, type Result } from "@/lib/admin/actions-util";

export async function saveCoupon(_: Result, f: FormData): Promise<Result> {
  try {
    const code = String(f.get("code") ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) return { error: "الكود: 3–32 حرفاً إنجليزياً أو رقماً بلا مسافات (مثل EID20)." };
    const kind = f.get("kind") === "fixed" ? "fixed" : "percent";
    const row = {
      code, kind,
      value: moneyString(f.get("value")),
      max_discount: kind === "percent" ? moneyString(f.get("max_discount"), { optional: true }) : null,
      min_order_amount: moneyString(f.get("min_order_amount"), { optional: true }) ?? "0",
      max_uses: intOrNull(f.get("max_uses"), 1),
      max_uses_per_customer: intOrNull(f.get("max_uses_per_customer"), 1),
      vip_only: f.get("vip_only") === "on",
      starts_at: gazaDateTime(f.get("starts_at")),
      ends_at: gazaDateTime(f.get("ends_at")),
      is_active: f.get("is_active") !== "off",
    };
    const id = String(f.get("id") ?? "");
    const supabase = await createClient();
    const { error } = id ? await supabase.from("coupons").update(row).eq("id", id) : await supabase.from("coupons").insert(row);
    if (error) return { error: dbMessage(error) };
    refresh();
    return { ok: true, message: id ? "تم حفظ الكوبون." : `أُنشئ الكوبون ${code}.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function toggleCoupon(id: string, active: boolean): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("coupons").update({ is_active: active }).eq("id", id);
  if (error) return { error: dbMessage(error) };
  refresh();
  return { ok: true };
}
