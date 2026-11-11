"use server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, can } from "@/lib/staff";
import { testProvider, type ProviderId } from "@/lib/ai/providers";

// يُعيد المفتاح مرة واحدة فقط لعرضه؛ لا يُخزَّن في الموقع ولا يُسجَّل
export async function generateN8nKey(): Promise<{ key?: string; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_integration_key", { p_name: "n8n" });
  if (error) return { error: "تعذر إنشاء المفتاح (تحتاج صلاحية الإعدادات)." };
  return { key: data as string };
}

// اختبار مزود ذكاء اصطناعي (للمدير فقط، والتحقق في الخادم): طلب صغير جداً، ويُعاد الوقت والنتيجة دون أي مفتاح
export async function testAiProvider(id: ProviderId) {
  const staff = await requireStaff();
  if (!can(staff, "settings.manage")) return { ok: false, error: "forbidden" };
  return testProvider(id);
}
