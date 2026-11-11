"use client";
import { useState, useTransition } from "react";
import { useI18n } from "@/components/admin/I18nProvider";
import { telegramFlush, telegramTest } from "./actions";

export function TelegramActions() {
  const { t, f } = useI18n();
  const S = t.set;
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} className="a-btn a-btn-ghost" onClick={() => start(async () => {
          const r = await telegramTest();
          setMsg(r.ok ? { ok: true, text: S.tgTestOk } : { ok: false, text: `${S.tgFail}: ${r.error ?? ""}` });
        })}>{S.tgTest}</button>
        <button type="button" disabled={pending} className="a-btn a-btn-primary" onClick={() => start(async () => {
          const r = await telegramFlush();
          setMsg(r.ok ? { ok: r.failed === 0, text: `${S.tgSent} ${f.number(r.sent)}${r.failed ? ` · ${S.tgFail} ${f.number(r.failed)}` : ""}` } : { ok: false, text: `${S.tgFail}: ${r.error ?? ""}` });
        })}>{S.tgFlush}</button>
      </div>
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-[var(--a-success)]" : "text-[var(--a-danger-ink)]"}`}>{msg.text}</p>}
    </div>
  );
}
