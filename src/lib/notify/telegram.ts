import "server-only";
import { createServiceClient } from "@/lib/supabase/admin";

// إرسال إشعارات Telegram مباشرة من خادم الموقع (لا يحتاج n8n).
// الإعداد في Vercel (Environment Variables): TELEGRAM_BOT_TOKEN (من @BotFather) و TELEGRAM_CHAT_ID (رقم المحادثة أو المجموعة).
// الرسائل نفسها تُبنى في قاعدة البيانات (private.telegram_text)، والحجز يمنع التكرار إن كان n8n يعمل أيضاً.

const env = (k: string) => process.env[k]?.trim() || undefined;
export const telegramConfigured = () => !!(env("TELEGRAM_BOT_TOKEN") && env("TELEGRAM_CHAT_ID"));

// للاختبار المحلي فقط: عنوان خادم وهمي بدل api.telegram.org
const api = () => env("TELEGRAM_API_BASE") ?? "https://api.telegram.org";

export async function sendTelegram(text: string): Promise<{ ok: boolean; error?: string }> {
  const token = env("TELEGRAM_BOT_TOKEN"), chat = env("TELEGRAM_CHAT_ID");
  if (!token || !chat) return { ok: false, error: "not_configured" };
  try {
    const res = await fetch(`${api()}/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    // رسالة الخطأ من Telegram فقط (بلا التوكن)
    return res.ok && body.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}${body.description ? `: ${body.description.slice(0, 160)}` : ""}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.name : "error" };
  }
}

// يرسل الإشعارات المعلّقة (آخر يوم) ويسجل النتيجة لكل حدث؛ يُستدعى بعد الطلبات وتسجيل الدخول (after)
let lastFlush = 0;
export async function flushTelegram({ limit = 10, force = false } = {}) {
  if (!telegramConfigured()) return { sent: 0, failed: 0, skipped: "not_configured" as const };
  if (!force && Date.now() - lastFlush < 15_000) return { sent: 0, failed: 0, skipped: "throttled" as const };
  lastFlush = Date.now();
  const service = createServiceClient();
  if (!service) return { sent: 0, failed: 0, skipped: "no_service" as const };
  const { data, error } = await service.rpc("notifications_claim_service", { p_channel: "telegram", p_limit: limit });
  if (error) { console.error("telegram claim", error.message); return { sent: 0, failed: 0, skipped: "claim_failed" as const }; }
  let sent = 0, failed = 0;
  for (const ev of (data ?? []) as { event_id: string; text: string }[]) {
    const r = await sendTelegram(ev.text);
    await service.rpc("notifications_complete_service", { p_event_id: ev.event_id, p_success: r.ok, p_error: r.error ?? null, p_channel: "telegram" });
    if (r.ok) sent++; else failed++;
  }
  return { sent, failed };
}
