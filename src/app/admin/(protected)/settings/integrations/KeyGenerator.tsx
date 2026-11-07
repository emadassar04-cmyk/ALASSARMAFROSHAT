"use client";
import { useState, useTransition } from "react";
import { generateN8nKey } from "./actions";

export function KeyGenerator({ hasKey }: { hasKey: boolean }) {
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const generate = () => {
    if (hasKey && !confirm("إنشاء مفتاح جديد يوقف المفتاح الحالي فوراً، ويجب تحديثه في n8n. متابعة؟")) return;
    start(async () => {
      const r = await generateN8nKey();
      setKey(r.key ?? null);
      setError(r.error ?? null);
      setCopied(false);
    });
  };

  return (
    <div className="space-y-3">
      <button onClick={generate} disabled={pending} className="rounded-lg bg-gold px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {pending ? "جارٍ الإنشاء…" : hasKey ? "إنشاء مفتاح جديد (يُبطل الحالي)" : "إنشاء مفتاح n8n"}
      </button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {key && (
        <div className="space-y-2 rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">انسخ المفتاح الآن: لن يظهر مرة أخرى.</p>
          <code dir="ltr" className="block break-all rounded bg-white p-2 text-sm">{key}</code>
          <button onClick={async () => { await navigator.clipboard.writeText(key); setCopied(true); }}
            className="rounded-lg border border-amber-500 px-3 py-1.5 text-sm">{copied ? "تم النسخ ✓" : "نسخ"}</button>
          <p className="text-xs text-amber-900">ضعه فقط في n8n (Header Auth). لا ترسله في أي محادثة.</p>
        </div>
      )}
    </div>
  );
}
