"use server";
import { refresh, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dbMessage, intOrNull, type Result } from "@/lib/admin/actions-util";

async function rpc(fn: string, args: Record<string, unknown>, catalogChanged = true): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { error: dbMessage(error) };
  if (catalogChanged) updateTag("catalog"); // التوفر في المتجر قد يتغير
  refresh();
  return { ok: true };
}

export async function inStoreSale(_: Result, f: FormData): Promise<Result> {
  try {
    const qty = intOrNull(f.get("qty"), 1, 10000);
    if (!qty) return { error: "اكتب الكمية المباعة." };
    const r = await rpc("record_in_store_sale", {
      p_variant_id: String(f.get("variant_id")), p_quantity: qty, p_note: String(f.get("note") ?? "").slice(0, 200) || "بيع داخل المحل" });
    return r.ok ? { ok: true, message: `سُجّل بيع ${qty} قطعة.` } : r;
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function startStocktake(note: string) {
  return rpc("start_stocktake", { p_note: note || null }, false);
}
export async function setCount(itemId: number, counted: number | null) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_stocktake_count", { p_item_id: itemId, p_counted: counted });
  return error ? { error: dbMessage(error) } : { ok: true };
}
export async function applyStocktake(id: string) {
  return rpc("apply_stocktake", { p_id: id });
}
export async function cancelStocktake(id: string) {
  return rpc("cancel_stocktake", { p_id: id }, false);
}
