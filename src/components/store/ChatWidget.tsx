"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUp, Sparkles, X } from "lucide-react";

// نافذة «مساعد العصار»: تُرسل المحادثة إلى /api/chat (الخادم يختار المزود ويضيف بيانات المتجر)
// وتعرض الإجابة متدفقة. المحادثة في ذاكرة الصفحة فقط (لا تُحفظ في المتصفح ولا في الخادم).

type Msg = { role: "user" | "assistant"; content: string };
const HIDDEN_ON = /^\/(cart|checkout|order)(\/|$)/;
const SUGGESTIONS = ["ما مناطق التوصيل ورسومها؟", "أبحث عن بطانية شتوية", "كيف أطلب ستارة حسب المقاس؟", "وين فروعكم؟"];
const ERRORS: Record<string, string> = {
  rate_limited: "وصلت للحد المسموح من الأسئلة مؤقتاً. حاول بعد قليل أو تواصل معنا عبر WhatsApp.",
  not_configured: "المساعد غير متاح حالياً. تواصل معنا عبر WhatsApp.",
};

// عرض آمن لنص الإجابة: روابط داخلية فقط [نص](/مسار)، وخط عريض **نص**، وأسطر جديدة. لا HTML من النموذج إطلاقاً.
function Rich({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  const parts = text.split(/(\[[^\]]+\]\([^)\s]+\)|\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        const link = p.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
        if (link) {
          const href = link[2];
          return href.startsWith("/") && !href.startsWith("//")
            ? <Link key={i} href={href} onClick={onNavigate} className="font-medium text-gold-ink underline decoration-gold/50 underline-offset-4 hover:decoration-gold-ink">{link[1]}</Link>
            : <span key={i}>{link[1]}</span>;
        }
        const bold = p.match(/^\*\*([^*]+)\*\*$/);
        if (bold) return <strong key={i} className="font-medium text-charcoal">{bold[1]}</strong>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

export function ChatWidget({ whatsapp }: { whatsapp: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [msgs]);
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btnRef.current?.focus(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (HIDDEN_ON.test(pathname)) return null;

  async function send(text: string) {
    const q = text.trim().slice(0, 600);
    if (!q || busy) return;
    const history: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history }) });
      if (!res.ok || !res.body) {
        const code = (await res.json().catch(() => ({})))?.error as string | undefined;
        throw new Error(ERRORS[code ?? ""] ?? "تعذر الوصول للمساعد الآن. حاول مرة أخرى أو تواصل معنا عبر WhatsApp.");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMsgs([...history, { role: "assistant", content: acc }]);
      }
      if (!acc.trim()) throw new Error("لم تصل إجابة. حاول مرة أخرى.");
    } catch (e) {
      setMsgs([...history, { role: "assistant", content: e instanceof Error ? e.message : "حدث خطأ." }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  const wa = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, "")}` : null;

  return (
    <>
      <button ref={btnRef} type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="alassar-chat"
        aria-label={open ? "إغلاق مساعد العصار" : "اسأل مساعد العصار"}
        className={`fixed bottom-5 right-4 z-50 flex h-13 items-center gap-2 rounded-full ps-4 pe-5 text-sm font-medium shadow-lift ring-1 transition-[transform,bottom,background-color] duration-300 sm:right-6 [.has-buybar_&]:max-md:bottom-24 ${open ? "bg-charcoal text-ivory ring-gold/40 hover:bg-[#36372f]" : "bg-gold-light text-charcoal ring-charcoal/10 hover:bg-[#e6d9bd]"}`}>
        {open ? <X aria-hidden="true" strokeWidth={1.5} className="h-5 w-5" /> : <Sparkles aria-hidden="true" strokeWidth={1.5} className="h-5 w-5" />}
        <span className="max-sm:sr-only">{open ? "إغلاق" : "اسأل المساعد"}</span>
      </button>

      {open && (
        <section id="alassar-chat" role="dialog" aria-label="مساعد العصار"
          className="animate-toast fixed inset-x-3 bottom-22 z-50 flex max-h-[min(36rem,calc(100svh-7.5rem))] flex-col overflow-hidden rounded-[16px] border border-border bg-ivory shadow-lift sm:inset-x-auto sm:right-6 sm:w-[24rem] [.has-buybar_&]:max-md:bottom-40">
          <header className="flex items-center gap-3 bg-charcoal px-5 py-4 text-ivory">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-gold/40"><Sparkles aria-hidden="true" strokeWidth={1.4} className="h-5 w-5 text-gold-light" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.98rem] font-medium">مساعد العصار</span>
              <span className="block truncate text-xs text-on-dark-muted">يجيب من بيانات المتجر · قد يخطئ أحياناً</span>
            </span>
            <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق" className="grid h-9 w-9 place-items-center rounded-full text-ivory/70 hover:bg-white/10 hover:text-ivory">
              <X aria-hidden="true" strokeWidth={1.5} className="h-5 w-5" />
            </button>
          </header>

          <div ref={listRef} aria-live="polite" className="flex-1 space-y-3 overflow-y-auto px-4 py-5 text-[0.92rem] leading-7">
            {msgs.length === 0 && (
              <div className="space-y-4">
                <p className="text-muted-ink">أهلاً بك! اسألني عن المنتجات والأسعار والتوصيل والفروع والطلب حسب المقاس.</p>
                <ul className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <li key={s}><button type="button" onClick={() => send(s)} className="rounded-full border border-border bg-white px-3.5 py-1.5 text-[0.8125rem] text-charcoal transition-colors hover:border-gold">{s}</button></li>
                  ))}
                </ul>
                <p className="text-xs text-muted-ink">لا تكتب معلومات شخصية (رقم جوال، عنوان). للطلبات والتأكيد تواصل معنا مباشرة.</p>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-start" : "flex justify-end"}>
                <p className={`max-w-[85%] whitespace-pre-wrap rounded-[14px] px-4 py-2.5 ${m.role === "user" ? "rounded-ss-sm bg-charcoal text-ivory" : "rounded-se-sm border border-border bg-white text-ink"}`}>
                  {m.role === "assistant" && !m.content && busy
                    ? <span className="inline-flex gap-1 py-2" aria-label="يكتب…"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold [animation-delay:150ms]" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold [animation-delay:300ms]" /></span>
                    : m.role === "assistant" ? <Rich text={m.content} onNavigate={() => setOpen(false)} /> : m.content}
                </p>
              </div>
            ))}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="border-t border-border bg-white p-3">
            <div className="flex items-end gap-2">
              <label htmlFor="chat-input" className="sr-only">رسالتك</label>
              <textarea id="chat-input" ref={inputRef} rows={1} value={input} maxLength={600}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                placeholder="اكتب سؤالك…" className="field max-h-28 min-h-11 flex-1 resize-none rounded-[22px] py-2.5" />
              <button type="submit" disabled={busy || !input.trim()} aria-label="إرسال"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-charcoal text-ivory transition-opacity disabled:opacity-40">
                <ArrowUp aria-hidden="true" strokeWidth={1.75} className="h-5 w-5" />
              </button>
            </div>
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="mt-2 block text-center text-xs text-muted-ink underline-offset-4 hover:text-charcoal hover:underline">تفضّل التحدث مع شخص؟ راسلنا على WhatsApp</a>}
          </form>
        </section>
      )}
    </>
  );
}
