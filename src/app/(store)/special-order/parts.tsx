"use client";
import { useId } from "react";
import { Check } from "lucide-react";
import { COLORS, type ProductType } from "@/lib/custom-order/spec";

// حقل رقمي بوحدة ظاهرة دائماً بجانبه، ورسالة خطأ مربوطة بالحقل (aria-describedby)
export function NumField({ label, unit, value, onChange, error, hint, placeholder, integer = false, name }: {
  label: string; unit?: string; value: string; onChange: (v: string) => void; error?: string; hint?: string; placeholder?: string; integer?: boolean; name?: string;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-charcoal">{label}</label>
      <div className="relative">
        <input id={id} name={name} inputMode={integer ? "numeric" : "decimal"} dir="ltr" autoComplete="off" value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value.slice(0, 8))} aria-invalid={!!error} aria-describedby={error ? `${id}-e` : hint ? `${id}-h` : undefined}
          className={`field h-13 text-right text-[1.15rem] tabular-nums ${unit ? "pl-16 pr-4" : ""}`} />
        {unit && <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center border-r border-border pl-4 pr-3 text-sm text-muted-ink">{unit}</span>}
      </div>
      {error ? <p id={`${id}-e`} className="text-xs text-danger">{error}</p> : hint ? <p id={`${id}-h`} className="text-xs text-muted-ink">{hint}</p> : null}
    </div>
  );
}

export function TextField({ label, value, onChange, error, placeholder, multiline = false, max = 120, optional = false, type = "text", autoComplete }: {
  label: string; value: string; onChange: (v: string) => void; error?: string; placeholder?: string; multiline?: boolean; max?: number; optional?: boolean; type?: string; autoComplete?: string;
}) {
  const id = useId();
  const common = { id, value, placeholder, "aria-invalid": !!error, "aria-describedby": error ? `${id}-e` : undefined, className: "field", autoComplete };
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-charcoal">{label}{optional && <span className="font-normal text-muted-ink"> (اختياري)</span>}</label>
      {multiline
        ? <textarea rows={3} {...common} onChange={(e) => onChange(e.target.value.slice(0, max))} />
        : <input type={type} {...common} onChange={(e) => onChange(e.target.value.slice(0, max))} dir={type === "tel" ? "ltr" : undefined} />}
      {error && <p id={`${id}-e`} className="text-xs text-danger">{error}</p>}
    </div>
  );
}

// اختيار من خيارات (أزرار كبسولة، مع إمكانية الكتابة الحرة عند الحاجة)
export function Choice({ label, options, value, onChange }: { label: string; options: { id: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-charcoal">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.id} className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold ${value === o.id ? "border-charcoal bg-charcoal text-ivory" : "border-border bg-white text-charcoal hover:border-border-strong"}`}>
            <input type="radio" className="sr-only" checked={value === o.id} onChange={() => onChange(o.id)} />{o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// قائمة الأقمشة (من الإدارة): صورة القماش الحقيقية بجانب الاسم إن وُجدت
export function FabricChoice({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { name: string; texture: string | null }[] }) {
  const all = [...options, { name: "غير متأكد — اقترحوا عليّ", texture: null }];
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-charcoal">نوع القماش</legend>
      <div className="flex flex-wrap gap-2">
        {all.map((o) => (
          <label key={o.name} className={`flex cursor-pointer items-center gap-2 rounded-full border py-1.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold ${o.texture ? "ps-1.5 pe-4" : "px-4 py-2"} ${value === o.name ? "border-charcoal bg-charcoal text-ivory" : "border-border bg-white text-charcoal hover:border-border-strong"}`}>
            <input type="radio" className="sr-only" checked={value === o.name} onChange={() => onChange(o.name)} />
            {/* eslint-disable-next-line @next/next/no-img-element -- صورة قماش صغيرة من مخزن الصور */}
            {o.texture && <img src={o.texture} alt="" className="h-7 w-7 rounded-full object-cover" loading="lazy" />}
            {o.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Swatches({ value, onChange, colors = COLORS }: { value: string; onChange: (v: string) => void; colors?: { name: string; hex: string }[] }) {
  const custom = !colors.some((c) => c.name === value);
  const dark = (hex: string) => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) < 140; };
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-charcoal">اللون</legend>
      <div className="flex flex-wrap gap-2.5">
        {colors.map((c) => (
          <label key={c.name} title={c.name} className="group cursor-pointer has-[:focus-visible]:[&>span]:ring-2 has-[:focus-visible]:[&>span]:ring-gold">
            <input type="radio" className="sr-only" checked={value === c.name} onChange={() => onChange(c.name)} aria-label={c.name} />
            <span className={`grid h-10 w-10 place-items-center rounded-full border transition-transform group-hover:scale-105 ${value === c.name ? "ring-2 ring-charcoal ring-offset-2 ring-offset-ivory" : "border-black/10"}`} style={{ background: c.hex }}>
              {value === c.name && <Check aria-hidden="true" strokeWidth={2} className={`h-4 w-4 ${dark(c.hex) ? "text-white" : "text-charcoal"}`} />}
            </span>
          </label>
        ))}
      </div>
      <p className="text-sm text-muted-ink">المختار: <span className="font-medium text-charcoal">{value || "—"}</span></p>
      <label className="block space-y-1.5 text-sm">
        <span className="text-muted-ink">لون آخر؟ اكتبه هنا</span>
        <input className="field" value={custom ? value : ""} placeholder="مثال: زهري فاتح" onChange={(e) => onChange(e.target.value.slice(0, 40))} />
      </label>
      <p className="text-xs text-muted-ink">الألوان على الشاشة تقريبية؛ يمكنك طلب عيّنة القماش عند التأكيد.</p>
    </fieldset>
  );
}

// رسومات صغيرة توضح طريقة القياس قبل الحقول
export function MeasureGuide({ type }: { type: ProductType }) {
  const tips: Record<ProductType, string[]> = {
    curtains: ["قِس عرض فتحة الشباك من الداخل بالمتر (مثال 2.50).", "قِس الارتفاع من أعلى الشباك إلى أسفله.", "لكل شباك بمقاس مختلف أضف شباكاً جديداً."],
    ceiling: ["قِس عرض الغرفة من الجدار للجدار بالمتر.", "قِس الطول بالاتجاه الآخر.", "لأسقف غير مستطيلة اكتب التفاصيل في الملاحظات."],
    mattress: ["العرض: الضلع القصير للفرشة (مثال 160 سم).", "الطول: الضلع الطويل (مثال 200 سم).", "الارتفاع: سماكة الفرشة من الأعلى للأسفل (مثال 25 سم)."],
    other: ["اختر الوحدة أولاً (سم أو متر).", "أدخل العرض والطول، والارتفاع إن وُجد.", "أرفق صورة مرجعية إن أمكن."],
  };
  return (
    <div className="flex gap-4 rounded-[var(--radius-card)] border border-border bg-champagne p-4">
      <svg viewBox="0 0 80 64" aria-hidden="true" className="h-16 w-20 shrink-0" fill="none" strokeWidth="1.5">
        {type === "curtains" && <><rect x="18" y="12" width="44" height="40" stroke="#6b675e" /><line x1="18" y1="6" x2="62" y2="6" stroke="#8a6b2e" /><line x1="70" y1="12" x2="70" y2="52" stroke="#a4483a" /><path d="M12 9h60" stroke="#5b4a36" strokeWidth="2.5" /></>}
        {type === "ceiling" && <><path d="M10 50 30 14h40L50 50z" stroke="#6b675e" /><line x1="10" y1="56" x2="50" y2="56" stroke="#8a6b2e" /><line x1="56" y1="52" x2="74" y2="18" stroke="#3f5871" /></>}
        {(type === "mattress" || type === "other") && <><path d="M8 30 30 20h42L50 30z" stroke="#6b675e" /><path d="M8 30v12h42V30M50 42l22-10V20" stroke="#6b675e" /><line x1="8" y1="50" x2="50" y2="50" stroke="#8a6b2e" /><line x1="56" y1="46" x2="76" y2="36" stroke="#3f5871" /><line x1="3" y1="30" x2="3" y2="42" stroke="#a4483a" /></>}
      </svg>
      <ul className="space-y-1 text-[0.8125rem] leading-6 text-muted-ink">{tips[type].map((t) => <li key={t}>• {t}</li>)}</ul>
    </div>
  );
}

// تصغير صورة مرجعية في المتصفح قبل الإرسال (JPEG حتى 1200px)
export async function downscaleImage(file: File, max = 1200): Promise<string | null> {
  if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024) return null;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    for (const q of [0.8, 0.65, 0.5]) { const d = c.toDataURL("image/jpeg", q); if (d.length <= 680_000) return d; }
    return null;
  } catch { return null; } finally { URL.revokeObjectURL(url); }
}
