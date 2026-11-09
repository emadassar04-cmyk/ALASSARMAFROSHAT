"use client";
import { useState, useTransition } from "react";
import { useI18n } from "@/components/admin/I18nProvider";
import { generateN8nKey } from "./actions";

export function KeyGenerator({ hasKey }: { hasKey: boolean }) {
  const { t, tx } = useI18n();
  const S = t.set;
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const generate = () => {
    if (hasKey && !confirm(S.newKeyQ)) return;
    start(async () => {
      const r = await generateN8nKey();
      setKey(r.key ?? null);
      setError(r.error ?? null);
      setCopied(false);
    });
  };

  return (
    <div className="space-y-3">
      <button onClick={generate} disabled={pending} className="a-btn a-btn-primary">{pending ? S.generating : hasKey ? S.regenerate : S.generate}</button>
      {error && <p role="alert" className="text-sm text-[var(--a-danger-ink)]">{tx(error)}</p>}
      {key && (
        <div className="space-y-2 rounded-[12px] border-2 border-[#e6c27a] bg-[#fffaf1] p-4">
          <p className="text-sm font-bold text-[var(--a-warning)]">{S.copyNow}</p>
          <code dir="ltr" className="block break-all rounded bg-white p-2 text-sm">{key}</code>
          <button onClick={async () => { await navigator.clipboard.writeText(key); setCopied(true); }} className="a-btn a-btn-ghost">{copied ? S.copied : S.copy}</button>
          <p className="text-xs text-[var(--a-warning)]">{S.keyWarn}</p>
        </div>
      )}
    </div>
  );
}
