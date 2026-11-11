import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/admin";
import { getStoreSettings } from "@/lib/catalog";
import { chatEnabled, streamChat, type ChatMessage } from "@/lib/ai/providers";
import { buildContext, SYSTEM_PROMPT } from "@/lib/ai/context";

// نقطة المحادثة: تُستدعى من نافذة المساعد في المتجر فقط.
// الحماية: نفس الموقع فقط، حد للطلبات لكل زائر وحد يومي إجمالي (للتحكم بالتكلفة)، رسائل قصيرة وعدد محدود،
// ولا نسجل نص المحادثات في أي مكان.

const MAX_MESSAGES = 12, MAX_CHARS = 600;
const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);
const json = (status: number, error: string) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  if (!chatEnabled()) return json(503, "not_configured");

  // نفس الموقع فقط (المتصفح يرسل Origin مع POST)
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return json(403, "forbidden");

  let body: { messages?: unknown };
  try { body = await req.json(); } catch { return json(400, "bad_request"); }
  const raw = Array.isArray(body.messages) ? body.messages : [];
  const messages: ChatMessage[] = raw.slice(-MAX_MESSAGES)
    .filter((m): m is { role: "user" | "assistant"; content: string } =>
      !!m && typeof m === "object" && ((m as { role?: unknown }).role === "user" || (m as { role?: unknown }).role === "assistant") && typeof (m as { content?: unknown }).content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  const last = messages.at(-1);
  if (!last || last.role !== "user" || !last.content.trim()) return json(400, "bad_request");

  // حد الطلبات: لكل زائر (20 كل 10 دقائق) + حد يومي إجمالي قابل للتعديل (AI_DAILY_LIMIT، الافتراضي 1000)
  const service = createServiceClient();
  if (!service) return json(503, "not_configured"); // بلا حد للطلبات لا نشغّل المساعد (حماية من التكلفة)
  {
    const ip = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const [perIp, daily] = await Promise.all([
      service.rpc("rate_limit_hit", { p_key: `chat:ip:${hash(ip)}`, p_limit: Number(process.env.AI_RATE_LIMIT_PER_IP) || 20, p_window_seconds: 600 }),
      service.rpc("rate_limit_hit", { p_key: "chat:daily", p_limit: Number(process.env.AI_DAILY_LIMIT) || 1000, p_window_seconds: 86_400 }),
    ]);
    if (perIp.data === false || daily.data === false) return json(429, "rate_limited");
  }

  const [context, settings] = await Promise.all([buildContext(last.content), getStoreSettings()]);
  const result = await streamChat(
    [{ role: "system", content: `${SYSTEM_PROMPT}\n\nبيانات المتجر:\n${context}` }, ...messages],
    { maxTokens: 500, siteUrl: settings.site_url },
  );
  if (!result.ok) {
    // تفاصيل الأخطاء في سجلات الخادم فقط (بلا مفاتيح ولا نص المحادثة)
    console.error("chat: all providers failed", result.errors);
    return json(502, "unavailable");
  }
  return new Response(result.stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-AI-Provider": result.provider },
  });
}
