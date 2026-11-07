"use server";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dbMessage, type Result } from "@/lib/admin/actions-util";

export async function setTier(customerId: string, tier: "regular" | "loyal" | "vip"): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_customer_tier", { p_customer_id: customerId, p_tier: tier });
  if (error) return { error: dbMessage(error) };
  refresh();
  return { ok: true };
}
