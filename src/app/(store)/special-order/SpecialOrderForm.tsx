"use client";
import { useState } from "react";
import { whatsappLink } from "@/lib/format";
import { WhatsAppIcon } from "@/components/store/WhatsAppFloat";

const TYPES = ["ستائر", "موكيت / سجاد", "مراتب", "مفروشات أخرى"];
const UNITS = ["سم", "متر"];

export function SpecialOrderForm({ whatsapp, product }: { whatsapp: string | null; product?: string }) {
  const [form, setForm] = useState({ type: TYPES[0], width: "", height: "", unit: UNITS[0], count: "1", color: "", fabric: "", details: product ? `المنتج: ${decodeURIComponent(product)}` : "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value.slice(0, 500) }));

  const text = [
    "مرحباً، أريد عرض سعر لمنتج حسب المقاس:",
    `النوع: ${form.type}`,
    form.width && form.height ? `المقاس: ${form.width} × ${form.height} ${form.unit}` : null,
    `العدد: ${form.count}`,
    form.color ? `اللون: ${form.color}` : null,
    form.fabric ? `الخامة: ${form.fabric}` : null,
    form.details ? `تفاصيل: ${form.details}` : null,
    "(سأرسل صورة مرجعية في المحادثة إن وجدت)",
  ].filter(Boolean).join("\n");
  const href = whatsappLink(whatsapp, text);
  const field = "field";

  return (
    <form className="panel space-y-5 p-5 sm:p-7" onSubmit={(e) => { e.preventDefault(); if (href) window.open(href, "_blank", "noopener"); }}>
      <label className="block space-y-1 text-sm"><span>نوع المنتج</span>
        <select value={form.type} onChange={set("type")} className={field}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
      </label>
      <fieldset className="space-y-1.5 text-sm">
        <legend className="mb-1.5 font-medium">المقاس (العرض × الارتفاع أو الطول)</legend>
        <div className="flex gap-2">
          <input required inputMode="decimal" placeholder="العرض" value={form.width} onChange={set("width")} className={field} aria-label="العرض" />
          <input required inputMode="decimal" placeholder="الارتفاع / الطول" value={form.height} onChange={set("height")} className={field} aria-label="الارتفاع أو الطول" />
          <select value={form.unit} onChange={set("unit")} className={`${field} w-24`} aria-label="وحدة القياس">{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block space-y-1 text-sm"><span>العدد</span><input type="number" min={1} value={form.count} onChange={set("count")} className={field} /></label>
        <label className="block space-y-1 text-sm"><span>اللون</span><input value={form.color} onChange={set("color")} className={field} /></label>
        <label className="block space-y-1 text-sm"><span>الخامة</span><input value={form.fabric} onChange={set("fabric")} className={field} /></label>
      </div>
      <label className="block space-y-1 text-sm"><span>تفاصيل إضافية</span>
        <textarea rows={3} value={form.details} onChange={set("details")} className={field} placeholder="مثال: ستارة مزدوجة مع بطانة معتمة" />
      </label>
      <p className="text-xs text-muted-ink">لا نعرض سعراً تقديرياً: يحدد فريقنا السعر النهائي بعد مراجعة المقاسات. يمكنك إرفاق صورة مرجعية في محادثة WhatsApp.</p>
      {href ? (
        <button className="btn btn-whatsapp w-full h-12">
          <WhatsAppIcon className="h-5 w-5" /> أرسل الطلب عبر WhatsApp
        </button>
      ) : (
        <p role="status" className="rounded-[var(--radius-control)] bg-warning/10 p-3 text-sm text-warning">رقم WhatsApp للمتجر لم يُضبط بعد. يرجى المحاولة لاحقاً.</p>
      )}
    </form>
  );
}
