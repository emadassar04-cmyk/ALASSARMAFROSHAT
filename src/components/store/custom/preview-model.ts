import { colorHex, parseNum, type Draft } from "@/lib/custom-order/spec";

// نموذج المعاينة: أبعاد بالمتر داخل المشهد + نصوص القياس كما أدخلها العميل بوحدتها الأصلية
type Labels = { w: string; l?: string; h?: string };
export type PreviewModel =
  | { kind: "curtains"; width: number; height: number; color: string; fabric: string; blackout: string; label: Labels }
  | { kind: "ceiling"; width: number; length: number; color: string; fabric: string; design: string; label: Labels }
  | { kind: "mattress"; width: number; length: number; height: number; color: string; fabric: string; cover: string; label: Labels }
  | { kind: "other"; width: number; length: number; height: number; color: string; fabric: string; label: Labels };

// قيمة صالحة للمعاينة أو قيمة افتراضية معقولة (المعاينة تعمل أثناء الكتابة، والتحقق الحقيقي منفصل)
const v = (raw: string, def: number, min: number, max: number) => {
  const n = parseNum(raw);
  return n !== null && n >= min && n <= max ? n : def;
};
// التسمية تعرض ما أدخله العميل فقط؛ الحقل الفارغ يظهر «؟» (الشكل يستخدم قيمة افتراضية مؤقتة للعرض فقط)
const lbl = (raw: string, _n: number, unit: string) => { const p = parseNum(raw); return `${p !== null ? p : "؟"} ${unit}`; };

export function toPreviewModel(d: Draft, windowIndex = 0): PreviewModel | null {
  if (d.type === "curtains") {
    const w = d.curtains.windows[Math.min(windowIndex, d.curtains.windows.length - 1)];
    const width = v(w.width, 2.5, 0.2, 12), height = v(w.height, 2.6, 0.2, 8);
    return { kind: "curtains", width, height, color: colorHex(d.curtains.color), fabric: d.curtains.fabric, blackout: d.curtains.blackout,
      label: { w: lbl(w.width, width, "م"), h: lbl(w.height, height, "م") } };
  }
  if (d.type === "ceiling") {
    const c = d.ceiling, width = v(c.width, 4, 0.5, 20), length = v(c.length, 5, 0.5, 30);
    return { kind: "ceiling", width, length, color: colorHex(c.color), fabric: c.fabric, design: c.design, label: { w: lbl(c.width, width, "م"), l: lbl(c.length, length, "م") } };
  }
  if (d.type === "mattress") {
    const m = d.mattress, w = v(m.width, 160, 40, 250), l = v(m.length, 200, 100, 250), h = v(m.height, 25, 5, 60);
    return { kind: "mattress", width: w / 100, length: l / 100, height: h / 100, color: colorHex(m.color), fabric: m.fabric, cover: m.cover,
      label: { w: lbl(m.width, w, "سم"), l: lbl(m.length, l, "سم"), h: lbl(m.height, h, "سم") } };
  }
  if (d.type === "other") {
    const o = d.other, k = o.unit === "m" ? 1 : 100, u = o.unit === "m" ? "م" : "سم";
    const [mn, mx] = o.unit === "m" ? [0.05, 30] : [5, 3000];
    const w = v(o.width, o.unit === "m" ? 1 : 100, mn, mx), l = v(o.length, o.unit === "m" ? 1.5 : 150, mn, mx);
    const hasH = parseNum(o.height) !== null, h = v(o.height, o.unit === "m" ? 0.05 : 5, mn, mx);
    return { kind: "other", width: w / k, length: l / k, height: Math.max(h / k, 0.01), color: colorHex(o.color), fabric: o.fabric,
      label: { w: lbl(o.width, w, u), l: lbl(o.length, l, u), h: hasH ? lbl(o.height, h, u) : undefined } };
  }
  return null;
}
