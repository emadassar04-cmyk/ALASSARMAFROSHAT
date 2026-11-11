"use client";
import { useState, useTransition } from "react";
import { useI18n } from "@/components/admin/I18nProvider";
import { testAiProvider } from "./actions";
import type { ProviderId } from "@/lib/ai/providers";

type Result = Awaited<ReturnType<typeof testAiProvider>>;

export function AiTest({ id }: { id: ProviderId }) {
  const { t, f } = useI18n();
  const [pending, start] = useTransition();
  const [r, setR] = useState<Result | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={pending} onClick={() => start(async () => setR(await testAiProvider(id)))} className="a-btn a-btn-ghost min-h-8 px-3 text-xs">
        {pending ? t.set.aiTesting : t.set.aiTest}
      </button>
      {r && (
        <span role="status" className={`text-xs ${r.ok ? "text-[var(--a-success)]" : "text-[var(--a-danger-ink)]"}`}>
          {r.ok ? `${t.set.aiOk} · ${f.number("ms" in r ? r.ms ?? 0 : 0)}ms${"models" in r && r.models ? ` · ${f.number(r.models)} ${t.set.aiModels}` : ""}` : `${t.set.aiFail}: ${r.error ?? ""}`}
        </span>
      )}
    </div>
  );
}
