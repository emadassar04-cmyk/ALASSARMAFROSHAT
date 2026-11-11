import "server-only";

// مزودو الذكاء الاصطناعي: كلهم يدعمون واجهة Chat Completions المتوافقة مع OpenAI
// (Gemini عبر نقطة التوافق الرسمية v1beta/openai)، فنستخدم كوداً واحداً للجميع.
// المفاتيح تُضبط في Vercel (Environment Variables) فقط، ولا تبدأ بـ NEXT_PUBLIC، ولا تُرسل للمتصفح أبداً.
//   OPENROUTER_API_KEY · GROQ_API_KEY · XAI_API_KEY (Grok) · GEMINI_API_KEY · OPENAI_API_KEY
// اختياري: AI_PROVIDER_ORDER="gemini,groq,openrouter,openai,xai" (ترتيب المحاولة)
//          AI_MODEL_<ID> لتغيير النموذج، مثل AI_MODEL_GEMINI="gemini-2.5-flash"

export type ProviderId = "openrouter" | "groq" | "xai" | "gemini" | "openai";

type Provider = { id: ProviderId; label: string; envKey: string; baseURL: string; defaultModel: string };

const PROVIDERS: Provider[] = [
  { id: "gemini", label: "Google Gemini", envKey: "GEMINI_API_KEY", baseURL: "https://generativelanguage.googleapis.com/v1beta/openai", defaultModel: "gemini-flash-latest" },
  { id: "groq", label: "Groq", envKey: "GROQ_API_KEY", baseURL: "https://api.groq.com/openai/v1", defaultModel: "llama-3.3-70b-versatile" },
  { id: "openrouter", label: "OpenRouter", envKey: "OPENROUTER_API_KEY", baseURL: "https://openrouter.ai/api/v1", defaultModel: "openrouter/auto" },
  { id: "openai", label: "OpenAI", envKey: "OPENAI_API_KEY", baseURL: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini" },
  { id: "xai", label: "xAI Grok", envKey: "XAI_API_KEY", baseURL: "https://api.x.ai/v1", defaultModel: "grok-3-mini" },
];

const env = (k: string) => process.env[k]?.trim() || undefined;

function resolved(p: Provider) {
  const id = p.id.toUpperCase();
  return {
    ...p,
    key: env(p.envKey),
    model: env(`AI_MODEL_${id}`) ?? p.defaultModel,
    // للاختبار المحلي فقط (خادم وهمي)؛ في الإنتاج يبقى العنوان الرسمي
    baseURL: env(`AI_BASE_URL_${id}`) ?? p.baseURL,
  };
}

// كل المزودين بترتيب المحاولة (المرتب في AI_PROVIDER_ORDER أولاً)، مع حالة المفتاح فقط (لا القيمة)
export function allProviders() {
  const order = (env("AI_PROVIDER_ORDER") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const rank = (id: string) => { const i = order.indexOf(id); return i === -1 ? 100 + PROVIDERS.findIndex((p) => p.id === id) : i; };
  return [...PROVIDERS].sort((a, b) => rank(a.id) - rank(b.id)).map(resolved);
}

export function activeProviders() {
  return allProviders().filter((p) => p.key);
}

export function chatEnabled() {
  return activeProviders().length > 0;
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function request(p: ReturnType<typeof resolved>, messages: ChatMessage[], opts: { stream: boolean; maxTokens: number; signal?: AbortSignal; siteUrl?: string }) {
  return fetch(`${p.baseURL}/chat/completions`, {
    method: "POST",
    signal: opts.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${p.key}`,
      ...(p.id === "openrouter" && { "HTTP-Referer": opts.siteUrl ?? "https://alassarnumber1.vercel.app", "X-Title": "Al Assar Furniture" }),
    },
    body: JSON.stringify({ model: p.model, messages, stream: opts.stream, max_tokens: opts.maxTokens, temperature: 0.3 }),
  });
}

// رسالة خطأ آمنة للعرض: رمز الحالة ونص قصير من المزود، بعد حذف أي شيء يشبه مفتاحاً
function safeError(status: number, body: string, key?: string) {
  const msg = (() => { try { const j = JSON.parse(body); return j?.error?.message ?? j?.[0]?.error?.message ?? j?.message; } catch { return body; } })();
  let text = String(msg ?? "");
  if (key) text = text.split(key).join("***").split(key.slice(0, 12)).join("***");
  text = text.replace(/(sk|gsk|xai|AIza)[-_A-Za-z0-9]{8,}/g, "***").slice(0, 160);
  return `HTTP ${status}${text ? `: ${text}` : ""}`;
}

// يقرأ تدفق SSE ويُخرج نص الإجابة فقط
async function* deltas(res: Response): AsyncGenerator<string> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const text = JSON.parse(data)?.choices?.[0]?.delta?.content;
        if (typeof text === "string" && text) yield text;
      } catch { /* سطر غير مكتمل أو تعليق: نتجاهله */ }
    }
  }
}

/**
 * محادثة متدفقة مع تبديل تلقائي: يجرب المزودين بالترتيب، وينتقل للتالي إن فشل الاتصال أو لم يصل أول جزء من الإجابة.
 * يعيد تدفق نص عادي + اسم المزود المستخدم.
 */
export async function streamChat(messages: ChatMessage[], opts: { maxTokens?: number; siteUrl?: string } = {}) {
  const errors: string[] = [];
  for (const p of activeProviders()) {
    try {
      const res = await request(p, messages, { stream: true, maxTokens: opts.maxTokens ?? 500, signal: AbortSignal.timeout(30_000), siteUrl: opts.siteUrl });
      if (!res.ok || !res.body) { errors.push(`${p.id}: ${safeError(res.status, await res.text().catch(() => ""), p.key)}`); continue; }
      const it = deltas(res);
      const first = await it.next();
      if (first.done) { errors.push(`${p.id}: empty`); continue; }
      const enc = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(c) { c.enqueue(enc.encode(first.value)); },
        async pull(c) {
          try {
            const n = await it.next();
            if (n.done) c.close(); else c.enqueue(enc.encode(n.value));
          } catch { c.close(); }
        },
      });
      return { ok: true as const, stream, provider: p.id };
    } catch (e) {
      errors.push(`${p.id}: ${e instanceof Error ? e.name : "error"}`);
    }
  }
  return { ok: false as const, errors };
}

// اختبار مزود واحد من لوحة الإدارة: طلب صغير جداً + عدد النماذج المتاحة بالمفتاح
export async function testProvider(id: ProviderId) {
  const p = allProviders().find((x) => x.id === id);
  if (!p) return { ok: false, error: "unknown" };
  if (!p.key) return { ok: false, error: "no_key" };
  const t0 = Date.now();
  try {
    const res = await request(p, [{ role: "user", content: "Reply with the single word: OK" }], { stream: false, maxTokens: 5, signal: AbortSignal.timeout(20_000) });
    const body = await res.text();
    const ms = Date.now() - t0;
    if (!res.ok) return { ok: false, ms, model: p.model, error: safeError(res.status, body, p.key) };
    let models: number | null = null;
    try {
      const m = await fetch(`${p.baseURL}/models`, { headers: { Authorization: `Bearer ${p.key}` }, signal: AbortSignal.timeout(10_000) });
      if (m.ok) models = ((await m.json())?.data ?? []).length;
    } catch { /* اختياري */ }
    return { ok: true, ms, model: p.model, models };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, model: p.model, error: e instanceof Error ? e.name : "error" };
  }
}
