"use client";
import { useActionState } from "react";
import { drawWinner, saveCampaign, setStatus } from "./actions";

export type Campaign = {
  id: string; slug: string; title: string; description: string | null; prize: string; prize_image_url: string | null; terms: string;
  start_local: string; end_local: string; min_amount: number | null; status: "draft" | "published" | "drawn" | "archived";
  winner_display: string | null; ended: boolean;
};

const field = "w-full rounded-md border border-gold/30 bg-white px-3 py-2 text-sm";

// القواعد الافتراضية تُكتب في الشروط وتطابق ما ينفذه النظام فعلاً
export const DEFAULT_TERMS = `- كل شراء مؤهل خلال فترة الحملة يمنح مشاركة واحدة في السحب.
- الشراء المؤهل: طلب من المتجر الإلكتروني تم تسليمه، أو شراء من أحد فرعينا (دير البلح، النصيرات) سُجّل برقم جوالك واعتمدته الإدارة.
- المشتريات الملغاة أو المرفوضة أو المسترجعة لا تُحتسب.
- يُربط الشراء بالزبون عبر رقم الجوال، ولا حاجة لأي تسجيل إضافي.
- يُختار الفائز عشوائياً بعد انتهاء الحملة، ويُعلن على الموقع بالاسم الأول وجزء من رقم الجوال.
- نتواصل مع الفائز عبر رقم جواله لتسليم الجائزة.`;

export function CampaignForm({ c }: { c?: Campaign }) {
  const [state, action, pending] = useActionState(saveCampaign, {});
  const locked = c && (c.status === "drawn" || c.status === "archived");
  return (
    <form action={action} className="space-y-3">
      {c && <input type="hidden" name="id" value={c.id} />}
      <fieldset disabled={!!locked} className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span className="block font-medium">عنوان الحملة</span>
          <input name="title" required defaultValue={c?.title ?? "تسوّق واربح مع العصار"} className={field} /></label>
        <label className="space-y-1 text-sm"><span className="block font-medium">الرابط المختصر (إنجليزي)</span>
          <input name="slug" required dir="ltr" defaultValue={c?.slug ?? ""} placeholder="shop-and-win-december" className={field} /></label>
        <label className="space-y-1 text-sm sm:col-span-2"><span className="block font-medium">الجائزة</span>
          <input name="prize" required defaultValue={c?.prize ?? ""} placeholder="اكتب الجائزة الفعلية" className={field} /></label>
        <label className="space-y-1 text-sm sm:col-span-2"><span className="block font-medium">رابط صورة الجائزة (اختياري)</span>
          <input name="prize_image_url" dir="ltr" defaultValue={c?.prize_image_url ?? ""} placeholder="https://…" className={field} /></label>
        <label className="space-y-1 text-sm sm:col-span-2"><span className="block font-medium">وصف قصير (اختياري)</span>
          <textarea name="description" rows={2} defaultValue={c?.description ?? ""} className={field} /></label>
        <label className="space-y-1 text-sm"><span className="block font-medium">البداية (بتوقيت فلسطين)</span>
          <input type="datetime-local" name="start_at" required defaultValue={c?.start_local} className={field} /></label>
        <label className="space-y-1 text-sm"><span className="block font-medium">النهاية</span>
          <input type="datetime-local" name="end_at" required defaultValue={c?.end_local} className={field} /></label>
        <label className="space-y-1 text-sm"><span className="block font-medium">الحد الأدنى للشراء (₪، اختياري)</span>
          <input name="min_amount" inputMode="decimal" dir="ltr" defaultValue={c?.min_amount ?? ""} placeholder="بدون حد" className={field} /></label>
        <label className="space-y-1 text-sm sm:col-span-2"><span className="block font-medium">الشروط والأحكام</span>
          <textarea name="terms" required rows={7} defaultValue={c?.terms ?? DEFAULT_TERMS} className={`${field} leading-7`} /></label>
      </fieldset>
      {!locked && <button disabled={pending} className="rounded-md bg-charcoal px-4 py-2 text-sm text-white disabled:opacity-50">{pending ? "جارٍ الحفظ…" : c ? "حفظ التعديلات" : "إنشاء الحملة (مسودة)"}</button>}
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state.message && <p role="status" className="text-sm text-emerald-700">{state.message}</p>}
    </form>
  );
}

export function CampaignActions({ c }: { c: Campaign }) {
  const [s1, statusAction, p1] = useActionState(setStatus, {});
  const [s2, drawAction, p2] = useActionState(drawWinner, {});
  const b = "rounded-md px-3 py-1.5 text-sm disabled:opacity-50";
  return (
    <div className="flex flex-wrap items-center gap-2">
      {c.status === "draft" && (
        <form action={statusAction}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="status" value="published" />
          <button disabled={p1} className={`${b} bg-emerald-600 text-white`}>نشر الحملة</button></form>
      )}
      {c.status === "published" && !c.ended && (
        <form action={statusAction}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="status" value="draft" />
          <button disabled={p1} className={`${b} border border-gold/40`}>إرجاع إلى مسودة</button></form>
      )}
      {c.status === "published" && c.ended && (
        <form action={drawAction} onSubmit={(e) => { if (!confirm("سحب الفائز الآن؟ لا يمكن التراجع بعد السحب.")) e.preventDefault(); }}>
          <input type="hidden" name="id" value={c.id} />
          <button disabled={p2} className={`${b} bg-charcoal text-white`}>سحب الفائز</button></form>
      )}
      {c.status === "drawn" && (
        <form action={statusAction}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="status" value="archived" />
          <button disabled={p1} className={`${b} border border-gold/40`}>أرشفة</button></form>
      )}
      {(s1.error || s2.error) && <span role="alert" className="text-sm text-red-700">{s1.error ?? s2.error}</span>}
      {(s1.message || s2.message) && <span role="status" className="text-sm text-emerald-700">{s1.message ?? s2.message}</span>}
    </div>
  );
}
