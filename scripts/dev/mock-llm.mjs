// مزود ذكاء اصطناعي وهمي للاختبار المحلي فقط (واجهة متوافقة مع OpenAI Chat Completions).
// لا يتصل بأي خدمة خارجية ولا يحتاج مفاتيح حقيقية.
// - النموذج "fail" يرد بخطأ 500 (لاختبار الانتقال التلقائي للمزود التالي)
// - llama-3.3-70b-versatile يرد 404 «النموذج غير موجود» (لاختبار الاختيار التلقائي من /models)
// - غير ذلك: يرد بإجابة متدفقة تذكر أول منتج وارد في «بيانات المتجر» برابطه، ليتأكد الاختبار أن البيانات وصلت للنموذج
import http from "node:http";

const PORT = Number(process.env.MOCK_LLM_PORT ?? 54400);
let lastModel = null;
// يحاكي Groq في 2026: النموذج القديم الافتراضي لم يعد موجوداً
const GONE = new Set(["llama-3.3-70b-versatile"]);

http.createServer((req, res) => {
  if (req.method === "GET" && req.url.endsWith("/models")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ data: [{ id: "whisper-large-v3" }, { id: "llama-3.1-8b-instant" }, { id: "openai/gpt-oss-120b" }, { id: "meta-llama/llama-guard-4-12b" }] }));
  }
  if (req.method === "GET" && req.url.endsWith("/last-model")) { res.writeHead(200); return res.end(String(lastModel)); }
  if (req.method !== "POST" || !req.url.endsWith("/chat/completions")) { res.writeHead(404); return res.end(); }
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = JSON.parse(raw);
    const auth = req.headers.authorization ?? "";
    if (GONE.has(body.model)) { res.writeHead(404, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ error: { message: `The model \`${body.model}\` does not exist or you do not have access to it.`, type: "invalid_request_error", code: "model_not_found" } })); }
    lastModel = body.model;
    if (body.model === "fail") { res.writeHead(500, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ error: { message: `mock failure (auth ${auth.slice(0, 12)}…)` } })); }
    const system = body.messages.find((m) => m.role === "system")?.content ?? "";
    const product = system.match(/^- ([^|]+?) \|[^\n]*\| (\/product\/[^\s]+)$/m);
    const answer = product
      ? `أكيد! عندنا **${product[1].trim()}**. تفاصيله هنا: [${product[1].trim()}](${product[2]}). وفي مخدة ثانية [رابط خارجي](https://evil.example).`
      : "ما لقيت منتجاً مطابقاً، تواصل معنا عبر WhatsApp.";
    if (!body.stream) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: "OK" } }] }));
    }
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    const words = answer.split(/(?<= )/);
    let i = 0;
    const tick = setInterval(() => {
      if (i < words.length) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: words[i++] } }] })}\n\n`);
      else { res.write("data: [DONE]\n\n"); res.end(); clearInterval(tick); }
    }, 15);
  });
}).listen(PORT, () => console.log(`mock llm on :${PORT}`));
