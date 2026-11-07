"use server";
import { createClient } from "@/lib/supabase/server";

// يُعيد المفتاح مرة واحدة فقط لعرضه؛ لا يُخزَّن في الموقع ولا يُسجَّل
export async function generateN8nKey(): Promise<{ key?: string; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_integration_key", { p_name: "n8n" });
  if (error) return { error: "تعذر إنشاء المفتاح (تحتاج صلاحية الإعدادات)." };
  return { key: data as string };
}
