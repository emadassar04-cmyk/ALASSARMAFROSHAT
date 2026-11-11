"use client";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ImagePlus, Plus, Trash2, View } from "lucide-react";
import {
  BLACKOUT, CEILING_DESIGNS, COLORS, CURTAIN_STYLES, FABRICS, MATTRESS_COVERS, TYPES, UNIT_LABEL,
  emptyDraft, emptyWindow, specLines, validateCustomer, validateSpecs, type Draft, type Errors, type ProductType,
} from "@/lib/custom-order/spec";
import { canonicalPhone } from "@/lib/phone";
import { whatsappLink } from "@/lib/format";
import { WhatsAppIcon } from "@/components/store/WhatsAppIcon";
import { PreviewPanel } from "@/components/store/custom/PreviewPanel";
import { toPreviewModel } from "@/components/store/custom/preview-model";
import type { PreviewHandle } from "@/components/store/custom/Preview3D";
import { Choice, FabricChoice, MeasureGuide, NumField, Swatches, TextField, downscaleImage } from "./parts";
import type { CustomOptions } from "@/lib/catalog";
import { submitCustomOrder } from "./actions";

// استوديو التفصيل: ست خطوات، والبيانات محفوظة في جلسة المتصفح (sessionStorage) فلا تضيع عند الرجوع أو التحديث.
const STEPS = ["اختيار المنتج", "إدخال المقاسات", "الخامة واللون", "المعاينة", "بياناتك", "مراجعة وإرسال"];
const KEY = "alassar-custom-order-v1";
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`.padStart(36, "0"));

type Saved = { draft: Draft; step: number; reached: number; requestId: string };

// شاشة كبيرة؟ (لعرض معاينة واحدة فقط: بجانب النموذج في الكمبيوتر، أو داخله في الجوال — لا سياقَي WebGL معاً)
const mq = "(min-width: 1024px)";
const useDesktop = () => useSyncExternalStore(
  (cb) => { const m = window.matchMedia(mq); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
  () => window.matchMedia(mq).matches, () => false);

function load(type?: ProductType): Saved {
  let s: Saved = { draft: emptyDraft(), step: 0, reached: 0, requestId: newId() };
  try {
    const raw = typeof window !== "undefined" ? sessionStorage.getItem(KEY) : null;
    if (raw) { const p = JSON.parse(raw) as Saved; if (p?.draft && typeof p.step === "number") s = { ...s, ...p, draft: { ...emptyDraft(), ...p.draft } }; }
  } catch { /* بيانات تالفة: نبدأ من جديد */ }
  if (type && TYPES.some((t) => t.id === type)) {
    if (s.draft.type !== type) s = { ...s, draft: { ...s.draft, type }, step: 1, reached: Math.max(s.reached, 1) };
    else s = { ...s, step: Math.max(s.step, 1), reached: Math.max(s.reached, 1) };
  }
  return s;
}

export function Studio({ whatsapp, initialType, productHint, options }: { whatsapp: string | null; initialType?: ProductType; productHint?: string; options?: CustomOptions }) {
  // خيارات المحل من الإدارة؛ وإن لم تتوفر نستخدم القوائم الافتراضية
  const colors = options?.colors.length ? options.colors : COLORS;
  const fabricsFor = (t: ProductType) => options?.fabrics[t]?.length ? options.fabrics[t] : FABRICS[t].filter((f) => !f.startsWith("غير متأكد")).map((name) => ({ name, texture: null }));
  const [state, setState] = useState<Saved>(() => {
    const s = load(initialType);
    if (productHint && !s.draft.customer.notes) s.draft.customer.notes = `بخصوص المنتج: ${productHint}`;
    return s;
  });
  const { draft, step, reached } = state;
  const [errors, setErrors] = useState<Errors>({});
  const [activeWindow, setActiveWindow] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [previewShot, setPreviewShot] = useState<string | null>(null);
  const [result, setResult] = useState<{ number: string; text: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const handle = useRef<PreviewHandle | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const desktop = useDesktop();

  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch { /* التخزين ممتلئ أو معطل */ } }, [state]);

  const model = useMemo(() => toPreviewModel(draft, activeWindow, {
    hex: (name) => colors.find((c) => c.name === name)?.hex ?? "#d9c7a7",
    texture: (t, f) => (options?.fabrics[t] ?? []).find((x) => x.name === f)?.texture ?? null,
  }), [draft, activeWindow, colors, options]);
  const set = (fn: (d: Draft) => Draft) => setState((s) => ({ ...s, draft: fn(structuredClone(s.draft)) }));
  const go = (n: number, keep: Errors = {}) => {
    setErrors(keep);
    setState((s) => ({ ...s, step: n, reached: Math.max(s.reached, n) }));
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  function next() {
    if (step === 0 && !draft.type) return setErrors({ type: "اختر نوع المنتج" });
    if (step === 1 || step === 2) {
      const { errors: e } = validateSpecs(draft);
      if (Object.keys(e).length) return go(1, e); // نبقى/نعود لخطوة المقاسات مع إظهار الأخطاء
    }
    if (step === 3) Promise.resolve(handle.current?.capture() ?? null).then(setPreviewShot).catch(() => setPreviewShot(null));
    if (step === 4) {
      const { errors: e } = validateCustomer(draft.customer, canonicalPhone);
      if (Object.keys(e).length) return setErrors(e);
    }
    go(step + 1);
  }

  const lines = useMemo(() => {
    const { specs } = validateSpecs(draft);
    return draft.type && specs ? specLines(draft.type, specs) : [];
  }, [draft]);
  const typeTitle = TYPES.find((t) => t.id === draft.type)?.title ?? "";

  function submit() {
    setSubmitError(null);
    const t = draft.type!;
    // نافذة WhatsApp تُفتح فوراً عند الضغط (حتى لا يمنعها المتصفح)، ثم نوجهها بعد حفظ الطلب
    const wa = whatsapp ? window.open("about:blank", "_blank") : null;
    start(async () => {
      const r = await submitCustomOrder({
        requestId: state.requestId, type: t, section: draft[t], customer: draft.customer,
        preview: previewShot, reference: t === "other" ? reference : null,
      });
      if (!r.ok) {
        wa?.close();
        setSubmitError(r.error);
        if (r.fields) setErrors(r.fields);
        return;
      }
      const text = [
        `مرحباً، أرسلت طلب تفصيل من الموقع — رقم الطلب: ${r.number}`,
        `نوع المنتج: ${typeTitle}`, ...lines,
        `الاسم: ${draft.customer.name.trim()}`, `المنطقة: ${draft.customer.area.trim()}`,
        draft.customer.notes.trim() ? `ملاحظات: ${draft.customer.notes.trim()}` : "",
        t === "other" && reference ? "(أرفقت صورة مرجعية في الطلب)" : "",
      ].filter(Boolean).join("\n");
      const href = whatsappLink(whatsapp, text);
      if (wa && href) wa.location.href = href; else wa?.close();
      setResult({ number: r.number, text });
      try { sessionStorage.removeItem(KEY); } catch { /* */ }
    });
  }

  if (result) {
    const href = whatsappLink(whatsapp, result.text);
    return (
      <div ref={top} className="panel mx-auto max-w-2xl p-8 text-center sm:p-12" role="status">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/10 text-success"><Check aria-hidden="true" strokeWidth={1.75} className="h-8 w-8" /></span>
        <h2 className="mt-6 text-[1.8rem] font-light">تم استلام طلبك</h2>
        <p className="mt-3 text-muted-ink">رقم الطلب: <span dir="ltr" className="font-medium tabular-nums text-charcoal">{result.number}</span></p>
        <p className="mx-auto mt-4 max-w-md leading-8 text-muted-ink">سيتم مراجعة طلبك وتحديد السعر النهائي والتواصل معك لتأكيد التفاصيل.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {href && <a href={href} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp"><WhatsAppIcon className="h-5 w-5" />فتح المحادثة في WhatsApp</a>}
          <button type="button" className="btn btn-outline" onClick={() => { setResult(null); setReference(null); setPreviewShot(null); setState({ draft: emptyDraft(), step: 0, reached: 0, requestId: newId() }); }}>طلب تفصيل جديد</button>
        </div>
      </div>
    );
  }

  const err = (k: string) => errors[k];
  const showSide = step >= 1 && step <= 3 && model && (desktop || step < 3);

  return (
    <div ref={top} className="scroll-mt-40">
      {/* شريط التقدم: يمكن الرجوع لأي خطوة سابقة دون فقدان البيانات */}
      {/* على الهاتف: شريط تقدم مضغوط (الخطوة الحالية + مقاطع يمكن لمسها للرجوع) بدل صف عريض يحتاج تمريراً */}
      <nav aria-label="خطوات الطلب" className="mb-6 sm:hidden">
        <p className="flex items-baseline justify-between text-sm">
          <span className="font-medium text-charcoal">{STEPS[step]}</span>
          <span className="text-xs text-muted-ink tabular-nums">الخطوة {step + 1} من {STEPS.length}</span>
        </p>
        <ol className="mt-2 flex gap-1.5">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1">
              <button type="button" disabled={i > reached} onClick={() => go(i)} aria-current={i === step ? "step" : undefined}
                aria-label={`${i + 1}. ${s}`} className="flex h-8 w-full items-center disabled:cursor-not-allowed">
                <span className={`h-1.5 w-full rounded-full transition-colors ${i < step ? "bg-gold" : i === step ? "bg-charcoal" : i <= reached ? "bg-gold-light" : "bg-border"}`} />
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <nav aria-label="خطوات الطلب" className="mb-8 overflow-x-auto no-scrollbar max-sm:hidden">
        <ol className="flex min-w-[40rem] items-start">
          {STEPS.map((s, i) => {
            const done = i < step, cur = i === step, can = i <= reached;
            return (
              <li key={s} className="relative flex flex-1 flex-col items-center text-center">
                {i > 0 && <span aria-hidden="true" className={`absolute end-1/2 top-4 h-px w-full ${i <= step ? "bg-gold" : "bg-border"}`} />}
                <button type="button" disabled={!can} onClick={() => go(i)} aria-current={cur ? "step" : undefined}
                  className={`relative z-10 grid h-8 w-8 place-items-center rounded-full border text-xs font-medium tabular-nums transition-colors ${cur ? "border-charcoal bg-charcoal text-ivory" : done ? "border-gold bg-gold text-white" : "border-border bg-white text-muted-ink"} disabled:cursor-not-allowed`}>
                  {done ? <Check aria-hidden="true" strokeWidth={2} className="h-4 w-4" /> : i + 1}
                  <span className="sr-only">{s}</span>
                </button>
                <span className={`mt-2 text-xs ${cur ? "font-medium text-charcoal" : "text-muted-ink"}`}>{s}</span>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className={`grid gap-8 ${showSide ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]" : ""}`}>
        <div className="panel min-w-0 p-5 sm:p-8">
          {/* 1) اختيار المنتج */}
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="text-[1.5rem] font-light">ما الذي تريد تفصيله؟</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {TYPES.map((t) => (
                  <button key={t.id} type="button" onClick={() => { set((d) => ({ ...d, type: t.id })); setErrors({}); setActiveWindow(0); go(1); }}
                    aria-pressed={draft.type === t.id}
                    className={`rounded-[var(--radius-card)] border p-5 text-start transition-colors ${draft.type === t.id ? "border-charcoal bg-champagne" : "border-border bg-white hover:border-border-strong"}`}>
                    <span className="block text-lg font-medium">{t.title}</span>
                    <span className="mt-1 block text-sm text-muted-ink">{t.short}</span>
                    <span className="mt-2 block text-xs text-gold-ink">{t.unitNote}</span>
                  </button>
                ))}
              </div>
              {err("type") && <p className="text-sm text-danger">{err("type")}</p>}
            </div>
          )}

          {/* 2) المقاسات */}
          {step === 1 && draft.type && (
            <div className="space-y-6">
              <div><p className="kicker">{typeTitle}</p><h2 className="mt-3 text-[1.5rem] font-light">أدخل المقاسات</h2></div>
              <MeasureGuide type={draft.type} />
              {draft.type === "curtains" && (
                <div className="space-y-5">
                  {draft.curtains.windows.map((w, i) => (
                    <fieldset key={i} className={`space-y-4 rounded-[var(--radius-card)] border p-4 sm:p-5 ${activeWindow === i ? "border-gold bg-champagne/50" : "border-border"}`} onFocus={() => setActiveWindow(i)}>
                      <div className="flex items-center justify-between gap-3">
                        <legend className="font-medium">الشباك {i + 1}</legend>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => setActiveWindow(i)} className="text-xs text-gold-ink underline-offset-4 hover:underline">عرضه في المعاينة</button>
                          {draft.curtains.windows.length > 1 && (
                            <button type="button" aria-label={`حذف الشباك ${i + 1}`} onClick={() => { set((d) => { d.curtains.windows.splice(i, 1); return d; }); setActiveWindow(0); }}
                              className="grid h-9 w-9 place-items-center rounded-full text-muted-ink hover:bg-surface-soft hover:text-danger"><Trash2 aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" /></button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <NumField label="عرض الشباك" unit="متر" placeholder="2.50" value={w.width} error={err(`w${i}.width`)} onChange={(v) => set((d) => { d.curtains.windows[i].width = v; return d; })} />
                        <NumField label="ارتفاع الشباك" unit="متر" placeholder="2.80" value={w.height} error={err(`w${i}.height`)} onChange={(v) => set((d) => { d.curtains.windows[i].height = v; return d; })} />
                        <NumField label="عدد الشبابيك بهذا المقاس" integer value={w.count} error={err(`w${i}.count`)} onChange={(v) => set((d) => { d.curtains.windows[i].count = v; return d; })} />
                        <NumField label="عدد القطع لكل شباك" integer value={w.panels} error={err(`w${i}.panels`)} hint="عادةً قطعتان" onChange={(v) => set((d) => { d.curtains.windows[i].panels = v; return d; })} />
                      </div>
                    </fieldset>
                  ))}
                  {draft.curtains.windows.length < 20 && (
                    <button type="button" className="btn btn-outline w-full" onClick={() => { set((d) => { d.curtains.windows.push(emptyWindow()); return d; }); setActiveWindow(draft.curtains.windows.length); }}>
                      <Plus aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />إضافة شباك بمقاس مختلف
                    </button>
                  )}
                  <p className="text-xs leading-6 text-muted-ink">نحتاج مقاس الشباك فقط؛ كمية القماش وطريقة الحساب يحددها فريقنا حسب التصميم والخامة.</p>
                </div>
              )}
              {draft.type === "ceiling" && (
                <div className="grid grid-cols-2 gap-4">
                  <NumField label="عرض السقف" unit="متر" placeholder="4.00" value={draft.ceiling.width} error={err("width")} onChange={(v) => set((d) => { d.ceiling.width = v; return d; })} />
                  <NumField label="طول السقف" unit="متر" placeholder="5.25" value={draft.ceiling.length} error={err("length")} onChange={(v) => set((d) => { d.ceiling.length = v; return d; })} />
                  <NumField label="الكمية (عدد الأسقف/القطع)" integer value={draft.ceiling.quantity} error={err("quantity")} onChange={(v) => set((d) => { d.ceiling.quantity = v; return d; })} />
                </div>
              )}
              {draft.type === "mattress" && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <NumField label="عرض الفرشة" unit="سم" placeholder="160" value={draft.mattress.width} error={err("width")} onChange={(v) => set((d) => { d.mattress.width = v; return d; })} />
                  <NumField label="طول الفرشة" unit="سم" placeholder="200" value={draft.mattress.length} error={err("length")} onChange={(v) => set((d) => { d.mattress.length = v; return d; })} />
                  <NumField label="ارتفاع الفرشة" unit="سم" placeholder="25" value={draft.mattress.height} error={err("height")} hint="سماكة الفرشة" onChange={(v) => set((d) => { d.mattress.height = v; return d; })} />
                  <NumField label="الكمية" integer value={draft.mattress.quantity} error={err("quantity")} onChange={(v) => set((d) => { d.mattress.quantity = v; return d; })} />
                </div>
              )}
              {draft.type === "other" && (
                <div className="space-y-4">
                  <TextField label="اسم المنتج" value={draft.other.name} error={err("name")} placeholder="مثال: غطاء كنب، مفرش طاولة" max={60} onChange={(v) => set((d) => { d.other.name = v; return d; })} />
                  <Choice label="وحدة القياس" value={draft.other.unit} options={[{ id: "cm", label: "سنتيمتر" }, { id: "m", label: "متر" }]}
                    onChange={(v) => set((d) => { d.other.unit = v as "m" | "cm"; return d; })} />
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <NumField label="العرض" unit={UNIT_LABEL[draft.other.unit]} value={draft.other.width} error={err("width")} onChange={(v) => set((d) => { d.other.width = v; return d; })} />
                    <NumField label="الطول" unit={UNIT_LABEL[draft.other.unit]} value={draft.other.length} error={err("length")} onChange={(v) => set((d) => { d.other.length = v; return d; })} />
                    <NumField label="الارتفاع (إن وُجد)" unit={UNIT_LABEL[draft.other.unit]} value={draft.other.height} error={err("height")} onChange={(v) => set((d) => { d.other.height = v; return d; })} />
                    <NumField label="الكمية" integer value={draft.other.quantity} error={err("quantity")} onChange={(v) => set((d) => { d.other.quantity = v; return d; })} />
                  </div>
                  <TextField label="وصف تفصيلي" multiline max={1000} optional value={draft.other.description} onChange={(v) => set((d) => { d.other.description = v; return d; })} />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">صورة مرجعية <span className="font-normal text-muted-ink">(اختياري)</span></p>
                    {reference ? (
                      <div className="flex items-center gap-4">
                        {/* eslint-disable-next-line @next/next/no-img-element -- صورة محلية من جهاز العميل (data URL) */}
                        <img src={reference} alt="الصورة المرجعية" className="h-20 w-20 rounded-lg object-cover" />
                        <button type="button" className="btn btn-outline" onClick={() => setReference(null)}>إزالة الصورة</button>
                      </div>
                    ) : (
                      <label className="btn btn-outline cursor-pointer">
                        <ImagePlus aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />اختر صورة
                        <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
                          const f = e.target.files?.[0]; if (!f) return;
                          const d = await downscaleImage(f);
                          if (d) setReference(d); else setErrors((x) => ({ ...x, reference: "تعذر قراءة الصورة. جرّب صورة أخرى (حتى 15MB)." }));
                        }} />
                      </label>
                    )}
                    {err("reference") && <p className="text-xs text-danger">{err("reference")}</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3) الخامة واللون */}
          {step === 2 && draft.type && (
            <div className="space-y-7">
              <div><p className="kicker">{typeTitle}</p><h2 className="mt-3 text-[1.5rem] font-light">اختر الخامة واللون</h2></div>
              <FabricChoice value={draft[draft.type].fabric} options={fabricsFor(draft.type)} onChange={(v) => set((d) => { d[d.type!].fabric = v; return d; })} />
              <Swatches colors={colors} value={draft[draft.type].color} onChange={(v) => set((d) => { d[d.type!].color = v; return d; })} />
              {draft.type === "curtains" && <>
                <Choice label="درجة التعتيم" value={draft.curtains.blackout} options={BLACKOUT.map((b) => ({ id: b.id, label: b.label }))} onChange={(v) => set((d) => { d.curtains.blackout = v; return d; })} />
                <Choice label="نوع التصميم" value={draft.curtains.style} options={CURTAIN_STYLES.map((s) => ({ id: s, label: s }))} onChange={(v) => set((d) => { d.curtains.style = v; return d; })} />
                <TextField label="ملاحظات إضافية" multiline optional max={500} value={draft.curtains.notes} onChange={(v) => set((d) => { d.curtains.notes = v; return d; })} placeholder="مثال: ستارة مزدوجة مع بطانة معتمة" />
              </>}
              {draft.type === "ceiling" && <>
                <Choice label="التصميم" value={draft.ceiling.design} options={CEILING_DESIGNS.map((x) => ({ id: x.id, label: x.label }))} onChange={(v) => set((d) => { d.ceiling.design = v; return d; })} />
                <TextField label="ملاحظات إضافية" multiline optional max={500} value={draft.ceiling.notes} onChange={(v) => set((d) => { d.ceiling.notes = v; return d; })} />
              </>}
              {draft.type === "mattress" && <>
                <Choice label="نوع وجه الفرشة" value={draft.mattress.cover} options={MATTRESS_COVERS.map((x) => ({ id: x.id, label: x.label }))} onChange={(v) => set((d) => { d.mattress.cover = v; return d; })} />
                <TextField label="تفاصيل إضافية" multiline optional max={500} value={draft.mattress.notes} onChange={(v) => set((d) => { d.mattress.notes = v; return d; })} />
              </>}
              <p className="text-xs text-muted-ink">اختر الأقرب لما تريد؛ يؤكد فريقنا الخامات والألوان المتوفرة فعلاً عند التواصل معك.</p>
            </div>
          )}

          {/* 4) المعاينة */}
          {step === 3 && model && (
            <div className="space-y-5">
              <div><p className="kicker">{typeTitle}</p><h2 className="mt-3 text-[1.5rem] font-light">معاينة طلبك</h2></div>
              {!desktop && <PreviewPanel model={model} handleRef={handle} />}
              {draft.type === "curtains" && draft.curtains.windows.length > 1 && (
                <div className="flex flex-wrap gap-2">{draft.curtains.windows.map((_, i) => (
                  <button key={i} type="button" aria-pressed={activeWindow === i} onClick={() => setActiveWindow(i)} className={`rounded-full border px-4 py-1.5 text-sm ${activeWindow === i ? "border-charcoal bg-charcoal text-ivory" : "border-border bg-white"}`}>الشباك {i + 1}</button>
                ))}</div>
              )}
              <ul className="space-y-1.5 rounded-[var(--radius-card)] border border-border bg-champagne p-5 text-sm leading-7">{lines.map((l) => <li key={l}>{l}</li>)}</ul>
              <p className="text-xs text-muted-ink">المعاينة توضيحية لتتأكد من المقاسات والشكل العام؛ التنفيذ النهائي يؤكده فريقنا.</p>
            </div>
          )}

          {/* 5) بيانات العميل */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-[1.5rem] font-light">بياناتك للتواصل</h2>
              <TextField label="الاسم" autoComplete="name" value={draft.customer.name} error={err("name")} max={80} onChange={(v) => set((d) => { d.customer.name = v; return d; })} />
              <TextField label="رقم الجوال" type="tel" autoComplete="tel" placeholder="0599 123 456" value={draft.customer.phone} error={err("phone")} max={20} onChange={(v) => set((d) => { d.customer.phone = v; return d; })} />
              <TextField label="المدينة أو المنطقة" value={draft.customer.area} error={err("area")} max={80} placeholder="مثال: دير البلح" onChange={(v) => set((d) => { d.customer.area = v; return d; })} />
              <TextField label="ملاحظات إضافية" multiline optional max={1000} value={draft.customer.notes} onChange={(v) => set((d) => { d.customer.notes = v; return d; })} />
              <p className="text-xs leading-6 text-muted-ink">نستخدم رقمك للتواصل بخصوص هذا الطلب فقط.</p>
            </div>
          )}

          {/* 6) المراجعة */}
          {step === 5 && draft.type && (
            <div className="space-y-6">
              <h2 className="text-[1.5rem] font-light">راجع طلبك قبل الإرسال</h2>
              <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
                <dl className="space-y-3 text-sm">
                  <div><dt className="text-muted-ink">نوع المنتج</dt><dd className="font-medium">{typeTitle}</dd></div>
                  <div><dt className="text-muted-ink">المقاسات والمواصفات</dt><dd><ul className="mt-1 space-y-1 leading-7">{lines.map((l) => <li key={l}>{l}</li>)}</ul></dd></div>
                  <div><dt className="text-muted-ink">بياناتك</dt><dd className="leading-7">{draft.customer.name} · <span dir="ltr">{draft.customer.phone}</span> · {draft.customer.area}{draft.customer.notes && <><br />{draft.customer.notes}</>}</dd></div>
                </dl>
                {/* eslint-disable-next-line @next/next/no-img-element -- لقطة المعاينة المحلية (data URL) */}
                {previewShot && <img src={previewShot} alt="صورة المعاينة" className="w-full max-w-[16rem] rounded-[var(--radius-card)] border border-border" />}
              </div>
              <p className="rounded-[var(--radius-card)] bg-champagne p-4 text-sm leading-7 text-charcoal">سيتم مراجعة طلبك وتحديد السعر النهائي والتواصل معك لتأكيد التفاصيل.</p>
              {submitError && <p role="alert" className="rounded-[var(--radius-control)] bg-danger/10 p-3 text-sm text-danger">{submitError}</p>}
              <button type="button" disabled={pending} onClick={submit} className={`btn h-14 w-full text-base ${whatsapp ? "btn-whatsapp" : "btn-primary"}`}>
                {whatsapp && <WhatsAppIcon className="h-5 w-5" />}{pending ? "جارٍ الإرسال…" : whatsapp ? "إرسال الطلب عبر WhatsApp" : "إرسال الطلب"}
              </button>
              <p className="text-center text-xs text-muted-ink">يُحفظ طلبك لدينا برقم، ثم تُفتح محادثة WhatsApp بتفاصيله.</p>
            </div>
          )}

          {/* أزرار التنقل (ثابتة أسفل الشاشة في الجوال) */}
          {step < 5 && (
            <div className="sticky bottom-0 z-20 -mx-5 mt-8 flex gap-3 border-t border-border bg-white/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:px-8 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
              {step > 0 && <button type="button" onClick={() => go(step - 1)} className="btn btn-outline flex-1 sm:flex-none"><ArrowRight aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />السابق</button>}
              {step > 0 && <button type="button" onClick={next} className="btn btn-primary flex-1">التالي: {STEPS[step + 1]}<ArrowLeft aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" /></button>}
            </div>
          )}
          {step === 5 && <button type="button" onClick={() => go(4)} className="btn btn-outline mt-4"><ArrowRight aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />السابق</button>}
        </div>

        {/* المعاينة: بجانب النموذج على الكمبيوتر، وبزر على الجوال */}
        {showSide && (
          <aside className="min-w-0 lg:sticky lg:top-40 lg:self-start">
            {desktop && <PreviewPanel model={model} handleRef={handle} />}
            {!desktop && step < 3 && (
              <div>
                <button type="button" onClick={() => setShowPreview((s) => !s)} aria-expanded={showPreview} className="btn btn-outline w-full">
                  <View aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />{showPreview ? "إخفاء المعاينة" : "عرض المعاينة"}
                </button>
                {showPreview && <PreviewPanel model={model} handleRef={handle} className="mt-4" />}
              </div>
            )}
          </aside>
        )}
      </div>
      <p className="mt-6 text-center text-xs text-muted-ink">تفضل التواصل مباشرة؟ <Link href="/branches" className="underline underline-offset-4">زر أحد فروعنا</Link>.</p>
    </div>
  );
}
