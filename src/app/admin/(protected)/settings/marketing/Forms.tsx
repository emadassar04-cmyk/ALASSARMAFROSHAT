"use client";
import { useActionState, useRef } from "react";
import Link from "next/link";
import type { PolicySlug } from "@/lib/catalog-types";
import { saveMarketing, savePolicy } from "./actions";
import { POLICY_DRAFTS } from "./drafts";

const field = "w-full rounded-md border border-gold/30 bg-white px-3 py-2 text-sm";

export function PolicyForm({ slug, path, title, body, published }: { slug: PolicySlug; path: string; title: string; body: string; published: boolean }) {
  const [state, action, pending] = useActionState(savePolicy, {});
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-gold/20 bg-white p-5">
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex-1 space-y-1 text-sm">
          <span className="block font-medium">عنوان الصفحة</span>
          <input name="title" required defaultValue={title} className={field} />
        </label>
        <Link href={path} target="_blank" className="text-sm text-gold-dark underline">عرض الصفحة ↗</Link>
      </div>
      <label className="block space-y-1 text-sm">
        <span className="block font-medium">النص</span>
        <textarea ref={ref} name="body" rows={12} defaultValue={body} className={`${field} leading-7`}
          placeholder="اكتب السياسة هنا. سطر يبدأ بـ ## يصبح عنواناً فرعياً، وسطر يبدأ بـ - يصبح بنداً في قائمة." />
      </label>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button type="button" className="rounded-md border border-gold/40 px-3 py-1.5 hover:bg-beige"
          onClick={() => {
            if (!ref.current) return;
            if (ref.current.value.trim() && !confirm("سيُستبدل النص الحالي بالمسودة المقترحة. متابعة؟")) return;
            ref.current.value = POLICY_DRAFTS[slug];
            ref.current.focus();
          }}>
          أدرج مسودة مقترحة
        </button>
        <label className="flex items-center gap-2"><input type="checkbox" name="is_published" defaultChecked={published} />منشورة للزبائن</label>
        <button disabled={pending} className="ms-auto rounded-md bg-gold-dark px-4 py-1.5 text-white disabled:opacity-50">{pending ? "جارٍ الحفظ…" : "حفظ"}</button>
      </div>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-emerald-700">تم الحفظ ✓</p>}
    </form>
  );
}

export function MarketingForm({ ga, pixel, verification }: { ga: string | null; pixel: string | null; verification: string | null }) {
  const [state, action, pending] = useActionState(saveMarketing, {});
  return (
    <form action={action} className="space-y-4 rounded-2xl border border-gold/20 bg-white p-5">
      <label className="block space-y-1 text-sm">
        <span className="block font-medium">معرّف Google Analytics 4</span>
        <input name="ga" defaultValue={ga ?? ""} dir="ltr" placeholder="G-XXXXXXXXXX" className={field} />
        <span className="block text-xs opacity-70">من Google Analytics: المسؤول ← مصادر البيانات ← Web ← معرّف القياس.</span>
      </label>
      <label className="block space-y-1 text-sm">
        <span className="block font-medium">معرّف Meta Pixel</span>
        <input name="pixel" defaultValue={pixel ?? ""} dir="ltr" inputMode="numeric" placeholder="1234567890123456" className={field} />
        <span className="block text-xs opacity-70">من Meta Events Manager: مصادر البيانات ← اختر الـ Pixel ← المعرّف (أرقام فقط).</span>
      </label>
      <label className="block space-y-1 text-sm">
        <span className="block font-medium">رمز التحقق من Google Search Console</span>
        <input name="verification" defaultValue={verification ?? ""} dir="ltr" placeholder='<meta name="google-site-verification" content="…" />' className={field} />
        <span className="block text-xs opacity-70">في Search Console اختر «بادئة عنوان URL» ثم طريقة «علامة HTML»، وانسخ الوسم كاملاً هنا.</span>
      </label>
      <p className="text-xs opacity-70">اترك الحقل فارغاً لإيقاف الأداة. التغيير يظهر في المتجر خلال دقائق.</p>
      <button disabled={pending} className="rounded-md bg-gold-dark px-4 py-1.5 text-sm text-white disabled:opacity-50">{pending ? "جارٍ الحفظ…" : "حفظ"}</button>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-emerald-700">تم الحفظ ✓</p>}
    </form>
  );
}
