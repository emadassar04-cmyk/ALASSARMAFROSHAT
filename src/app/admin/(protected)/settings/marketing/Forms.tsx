"use client";
import { useActionState, useRef } from "react";
import Link from "next/link";
import type { PolicySlug } from "@/lib/catalog-types";
import { saveMarketing, savePolicy } from "./actions";
import { POLICY_DRAFTS } from "./drafts";
import { useI18n } from "@/components/admin/I18nProvider";

const field = "a-input";

export function PolicyForm({ slug, path, title, body, published }: { slug: PolicySlug; path: string; title: string; body: string; published: boolean }) {
  const { t, tx } = useI18n();
  const S = t.set;
  const [state, action, pending] = useActionState(savePolicy, {});
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <form action={action} className="a-card space-y-3 p-5">
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="block flex-1">
          <span className="a-label">{S.pageTitle}</span>
          <input name="title" dir="rtl" required defaultValue={title} className={field} />
        </label>
        <Link href={path} target="_blank" className="text-sm font-semibold text-[var(--a-accent-ink)] underline">{S.viewPage} ↗</Link>
      </div>
      <label className="block">
        <span className="a-label">{S.body}</span>
        <textarea ref={ref} name="body" dir="rtl" lang="ar" rows={12} defaultValue={body} className={`${field} leading-7`}
          placeholder={S.bodyPh} />
      </label>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button type="button" className="a-btn a-btn-ghost"
          onClick={() => {
            if (!ref.current) return;
            if (ref.current.value.trim() && !confirm(S.draftQ)) return;
            ref.current.value = POLICY_DRAFTS[slug];
            ref.current.focus();
          }}>
          {S.insertDraft}
        </button>
        <label className="flex items-center gap-2"><input type="checkbox" name="is_published" defaultChecked={published} />{S.published}</label>
        <button disabled={pending} className="a-btn a-btn-primary ms-auto">{pending ? S.saving : t.common.save}</button>
      </div>
      {state.error && <p role="alert" className="text-sm text-[var(--a-danger-ink)]">{tx(state.error)}</p>}
      {state.ok && <p role="status" className="text-sm text-[var(--a-success)]">{S.saved}</p>}
    </form>
  );
}

export function MarketingForm({ ga, pixel, verification }: { ga: string | null; pixel: string | null; verification: string | null }) {
  const { t, tx } = useI18n();
  const S = t.set;
  const [state, action, pending] = useActionState(saveMarketing, {});
  return (
    <form action={action} className="a-card space-y-4 p-5">
      <label className="block">
        <span className="a-label">{S.ga}</span>
        <input name="ga" defaultValue={ga ?? ""} dir="ltr" placeholder="G-XXXXXXXXXX" className={field} />
        <span className="mt-1 block text-xs text-[var(--a-muted-ink)]">{S.gaHint}</span>
      </label>
      <label className="block">
        <span className="a-label">{S.pixel}</span>
        <input name="pixel" defaultValue={pixel ?? ""} dir="ltr" inputMode="numeric" placeholder="1234567890123456" className={field} />
        <span className="mt-1 block text-xs text-[var(--a-muted-ink)]">{S.pixelHint}</span>
      </label>
      <label className="block">
        <span className="a-label">{S.gsc}</span>
        <input name="verification" defaultValue={verification ?? ""} dir="ltr" placeholder='<meta name="google-site-verification" content="…" />' className={field} />
        <span className="mt-1 block text-xs text-[var(--a-muted-ink)]">{S.gscHint}</span>
      </label>
      <p className="text-xs text-[var(--a-muted-ink)]">{S.emptyOff}</p>
      <button disabled={pending} className="a-btn a-btn-primary">{pending ? S.saving : t.common.save}</button>
      {state.error && <p role="alert" className="text-sm text-[var(--a-danger-ink)]">{tx(state.error)}</p>}
      {state.ok && <p role="status" className="text-sm text-[var(--a-success)]">{S.saved}</p>}
    </form>
  );
}
