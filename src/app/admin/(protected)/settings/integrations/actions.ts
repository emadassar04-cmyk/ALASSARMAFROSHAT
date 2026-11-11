"use server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, can } from "@/lib/staff";
import { testProvider, type ProviderId } from "@/lib/ai/providers";
import { flushTelegram, sendTelegram } from "@/lib/notify/telegram";

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

// Telegram المباشر: رسالة تجربة، وإرسال المعلّق الآن (للمدير بصلاحية الإعدادات فقط)
export async function telegramTest() {
  const staff = await requireStaff();
  if (!can(staff, "settings.manage")) return { ok: false, error: "forbidden" };
  return sendTelegram("✅ <b>تجربة إشعارات مفروشات العصار</b>\nالإشعارات تصل من الموقع مباشرة.");
}
export async function telegramFlush() {
  const staff = await requireStaff();
  if (!can(staff, "settings.manage")) return { ok: false, error: "forbidden", sent: 0, failed: 0 };
  const r = await flushTelegram({ limit: 25, force: true });
  return { ok: !("skipped" in r && r.skipped), error: "skipped" in r ? r.skipped : undefined, sent: r.sent, failed: r.failed };
}
