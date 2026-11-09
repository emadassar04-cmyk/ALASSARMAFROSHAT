"use client";
import { useActionState } from "react";
import { drawWinner, saveCampaign, setStatus } from "./actions";
import { useI18n } from "@/components/admin/I18nProvider";

export type Campaign = {
  id: string; slug: string; title: string; description: string | null; prize: string; prize_image_url: string | null; terms: string;
  start_local: string; end_local: string; min_amount: number | null; status: "draft" | "published" | "drawn" | "archived";
  winner_display: string | null; ended: boolean;
};

const field = "a-input";

// القواعد الافتراضية تُكتب في الشروط وتطابق ما ينفذه النظام فعلاً
export const DEFAULT_TERMS = `- كل شراء مؤهل خلال فترة الحملة يمنح مشاركة واحدة في السحب.
- الشراء المؤهل: طلب من المتجر الإلكتروني تم تسليمه، أو شراء من أحد فرعينا (دير البلح، النصيرات) سُجّل برقم جوالك واعتمدته الإدارة.
- المشتريات الملغاة أو المرفوضة أو المسترجعة لا تُحتسب.
- يُربط الشراء بالزبون عبر رقم الجوال، ولا حاجة لأي تسجيل إضافي.
- يُختار الفائز عشوائياً بعد انتهاء الحملة، ويُعلن على الموقع بالاسم الأول وجزء من رقم الجوال.
- نتواصل مع الفائز عبر رقم جواله لتسليم الجائزة.`;

export function CampaignForm({ c }: { c?: Campaign }) {
  const { t, tx } = useI18n();
  const C = t.camp;
  const [state, action, pending] = useActionState(saveCampaign, {});
  const locked = c && (c.status === "drawn" || c.status === "archived");
  return (
    <form action={action} className="space-y-3">
      {c && <input type="hidden" name="id" value={c.id} />}
      <fieldset disabled={!!locked} className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="a-label">{C.fTitle}</span>
          <input name="title" required defaultValue={c?.title ?? "تسوّق واربح مع العصار"} dir="auto" className={field} /></label>
        <label className="block"><span className="a-label">{C.slug}</span>
          <input name="slug" required dir="ltr" defaultValue={c?.slug ?? ""} placeholder="shop-and-win-december" className={field} /></label>
        <label className="block sm:col-span-2"><span className="a-label">{C.prize}</span>
          <input name="prize" required defaultValue={c?.prize ?? ""} placeholder={C.prizePh} className={field} /></label>
        <label className="block sm:col-span-2"><span className="a-label">{C.prizeImage}</span>
          <input name="prize_image_url" dir="ltr" defaultValue={c?.prize_image_url ?? ""} placeholder="https://…" className={field} /></label>
        <label className="block sm:col-span-2"><span className="a-label">{C.description}</span>
          <textarea name="description" rows={2} defaultValue={c?.description ?? ""} className={field} /></label>
        <label className="block"><span className="a-label">{C.start}</span>
          <input type="datetime-local" name="start_at" required defaultValue={c?.start_local} className={field} /></label>
        <label className="block"><span className="a-label">{C.end}</span>
          <input type="datetime-local" name="end_at" required defaultValue={c?.end_local} className={field} /></label>
        <label className="block"><span className="a-label">{C.min}</span>
          <input name="min_amount" inputMode="decimal" dir="ltr" defaultValue={c?.min_amount ?? ""} placeholder={C.noMin} className={field} /></label>
        <label className="block sm:col-span-2"><span className="a-label">{C.terms}</span>
          <textarea name="terms" dir="rtl" lang="ar" required rows={7} defaultValue={c?.terms ?? DEFAULT_TERMS} className={`${field} leading-7`} /></label>
      </fieldset>
      {!locked && <button disabled={pending} className="a-btn a-btn-primary">{pending ? C.saving : c ? C.saveEdits : C.create}</button>}
      {state.error && <p role="alert" className="text-sm text-[var(--a-danger-ink)]">{tx(state.error)}</p>}
      {state.message && <p role="status" className="text-sm text-[var(--a-success)]">{tx(state.message)}</p>}
    </form>
  );
}

export function CampaignActions({ c }: { c: Campaign }) {
  const { t, tx } = useI18n();
  const C = t.camp;
  const [s1, statusAction, p1] = useActionState(setStatus, {});
  const [s2, drawAction, p2] = useActionState(drawWinner, {});
  const b = "a-btn";
  return (
    <div className="flex flex-wrap items-center gap-2">
      {c.status === "draft" && (
        <form action={statusAction}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="status" value="published" />
          <button disabled={p1} className={`${b} bg-[var(--a-success)] text-white`}>{C.publish}</button></form>
      )}
      {c.status === "published" && !c.ended && (
        <form action={statusAction}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="status" value="draft" />
          <button disabled={p1} className={`${b} a-btn-ghost`}>{C.toDraft}</button></form>
      )}
      {c.status === "published" && c.ended && (
        <form action={drawAction} onSubmit={(e) => { if (!confirm(C.drawQ)) e.preventDefault(); }}>
          <input type="hidden" name="id" value={c.id} />
          <button disabled={p2} className={`${b} a-btn-primary`}>{C.draw}</button></form>
      )}
      {c.status === "drawn" && (
        <form action={statusAction}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="status" value="archived" />
          <button disabled={p1} className={`${b} a-btn-ghost`}>{C.archive}</button></form>
      )}
      {(s1.error || s2.error) && <span role="alert" className="text-sm text-[var(--a-danger-ink)]">{tx(s1.error ?? s2.error)}</span>}
      {(s1.message || s2.message) && <span role="status" className="text-sm text-[var(--a-success)]">{tx(s1.message ?? s2.message)}</span>}
    </div>
  );
}
