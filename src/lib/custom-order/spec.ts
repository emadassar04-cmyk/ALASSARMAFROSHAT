// مواصفات «التفصيل حسب المقاس»: مصدر واحد للأنواع والحقول والحدود والتسميات.
// يُستخدم في الواجهة (التحقق الفوري والمعاينة) وفي الخادم (التحقق النهائي قبل الحفظ)،
// والحدود نفسها مكررة في قاعدة البيانات (private.custom_spec_ok) كخط دفاع أخير.
// كل قيمة تُخزَّن مع وحدتها بشكل منفصل (m أو cm)، ولا يُحوَّل بين الوحدات إلا للعرض.

export type ProductType = "curtains" | "ceiling" | "mattress" | "other";
export type Unit = "m" | "cm";

export const UNIT_LABEL: Record<Unit, string> = { m: "متر", cm: "سم" };

// حدود منطقية (قابلة للتعديل هنا وفي migration 0025 معاً)
export const LIMITS = {
  curtains: { width: [0.2, 12], height: [0.2, 8], count: [1, 20], panels: [1, 8], windows: [1, 20] },
  ceiling: { width: [0.5, 20], length: [0.5, 30], quantity: [1, 50] },
  mattress: { width: [40, 250], length: [100, 250], height: [5, 60], quantity: [1, 20] },
  other: { m: [0.05, 30], cm: [5, 3000], quantity: [1, 100] },
} as const;

export const TYPES: { id: ProductType; title: string; short: string; unitNote: string }[] = [
  { id: "curtains", title: "الستائر", short: "تفصيل الستائر بمقاسات شبابيكك", unitNote: "المقاسات بالمتر" },
  { id: "ceiling", title: "بطانة السقف", short: "تفصيل بطانة الأسقف بمقاس الغرفة", unitNote: "المقاسات بالمتر" },
  { id: "mattress", title: "وجه الفرشات", short: "وجه فرشة بمقاس فرشتك بالضبط", unitNote: "المقاسات بالسنتيمتر" },
  { id: "other", title: "تفصيلات أخرى", short: "أي قطعة أخرى حسب طلبك", unitNote: "بالمتر أو السنتيمتر" },
];

// خيارات مساعدة (العميل يختار الأقرب أو يكتب ما يريد؛ فريق المحل يؤكد المتوفر فعلاً)
export const FABRICS: Record<ProductType, string[]> = {
  curtains: ["شيفون (شفاف)", "كتان", "قطيفة / مخمل", "بلاك أوت", "جاكار", "غير متأكد — اقترحوا عليّ"],
  ceiling: ["قماش ساتان", "قماش مطفي", "قماش لامع", "غير متأكد — اقترحوا عليّ"],
  mattress: ["قطن", "جاكار", "مبطّن (كوِلت)", "قماش مقاوم للماء", "غير متأكد — اقترحوا عليّ"],
  other: ["قطن", "كتان", "قطيفة / مخمل", "جلد صناعي", "غير متأكد — اقترحوا عليّ"],
};
export const BLACKOUT = [
  { id: "none", label: "شفافة (بدون تعتيم)" },
  { id: "partial", label: "تعتيم جزئي" },
  { id: "full", label: "تعتيم كامل" },
  { id: "unknown", label: "غير متأكد" },
] as const;
export const CURTAIN_STYLES = ["كسرات عادية", "حلقات (إيليت)", "مزدوجة (شفاف + تعتيم)", "رومانية", "غير متأكد"];
export const CEILING_DESIGNS = [
  { id: "plain", label: "مشدودة سادة" },
  { id: "pleated", label: "مكسّرة (كسرات)" },
  { id: "panels", label: "مربعات مبطّنة" },
] as const;
export const MATTRESS_COVERS = [
  { id: "zipper", label: "بسحاب من كل الجهات" },
  { id: "fitted", label: "مطاطي (يلبس على الفرشة)" },
  { id: "quilted", label: "مبطّن بخياطة (كوِلت)" },
] as const;

// ألوان مقترحة (تُعرض كدوائر للمعاينة؛ ويمكن كتابة لون آخر)
export const COLORS = [
  { name: "عاجي", hex: "#efe9dc" }, { name: "بيج", hex: "#d9c7a7" }, { name: "رملي", hex: "#c2a77f" },
  { name: "رمادي فاتح", hex: "#c9c9c4" }, { name: "رمادي غامق", hex: "#6e6e6a" }, { name: "بني", hex: "#7a5a43" },
  { name: "كحلي", hex: "#2f3a52" }, { name: "أخضر زيتي", hex: "#5d6447" }, { name: "عنابي", hex: "#6e2f37" }, { name: "أبيض", hex: "#f7f6f2" },
];
export const colorHex = (name: string) => COLORS.find((c) => c.name === name)?.hex ?? "#d9c7a7";

// ---------------------------------------------------------------------
// بيانات الطلب
// ---------------------------------------------------------------------
export type CurtainWindow = { width: string; height: string; count: string; panels: string };
export type Draft = {
  type: ProductType | null;
  curtains: { windows: CurtainWindow[]; fabric: string; color: string; blackout: string; style: string; notes: string };
  ceiling: { width: string; length: string; quantity: string; fabric: string; color: string; design: string; notes: string };
  mattress: { width: string; length: string; height: string; quantity: string; fabric: string; color: string; cover: string; notes: string };
  other: { name: string; width: string; length: string; height: string; unit: Unit; quantity: string; fabric: string; color: string; description: string };
  customer: { name: string; phone: string; area: string; notes: string };
};

export const emptyWindow = (): CurtainWindow => ({ width: "", height: "", count: "1", panels: "2" });
export const emptyDraft = (): Draft => ({
  type: null,
  curtains: { windows: [emptyWindow()], fabric: "", color: "بيج", blackout: "partial", style: CURTAIN_STYLES[0], notes: "" },
  ceiling: { width: "", length: "", quantity: "1", fabric: "", color: "عاجي", design: "plain", notes: "" },
  mattress: { width: "", length: "", height: "", quantity: "1", fabric: "", color: "عاجي", cover: "zipper", notes: "" },
  other: { name: "", width: "", length: "", height: "", unit: "cm", quantity: "1", fabric: "", color: "بيج", description: "" },
  customer: { name: "", phone: "", area: "", notes: "" },
});

// قراءة رقم عشري: يقبل الأرقام العربية والفاصلة العشرية «٫» أو «,» (مثل 2,75)، ويرفض غير ذلك
export function parseNum(raw: string): number | null {
  const s = String(raw ?? "").trim()
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[٫,]/g, ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
const parseInt10 = (raw: string) => { const n = parseNum(raw); return n !== null && Number.isInteger(n) ? n : null; };

export type Errors = Record<string, string>;
const fmt = (n: number) => String(n);

function num(errors: Errors, key: string, raw: string, [min, max]: readonly [number, number], unit: Unit, label: string) {
  if (!String(raw ?? "").trim()) { errors[key] = `أدخل ${label}`; return null; }
  const n = parseNum(raw);
  if (n === null) { errors[key] = `${label}: رقم غير صحيح (حتى منزلتين عشريتين)`; return null; }
  if (n <= 0) { errors[key] = `${label} يجب أن يكون أكبر من صفر`; return null; }
  if (n < min || n > max) { errors[key] = `${label} بين ${fmt(min)} و${fmt(max)} ${UNIT_LABEL[unit]}`; return null; }
  return n;
}
function int(errors: Errors, key: string, raw: string, [min, max]: readonly [number, number], label: string) {
  const n = parseInt10(raw);
  if (n === null || n < min || n > max) { errors[key] = `${label}: رقم صحيح من ${min} إلى ${max}`; return null; }
  return n;
}
const text = (s: string, max: number) => String(s ?? "").trim().slice(0, max);

// تحقق خطوة المقاسات لكل نوع، ويعيد المواصفات النظيفة (أرقام + وحدات منفصلة) إن كانت صحيحة
export function validateSpecs(d: Draft): { errors: Errors; specs: Record<string, unknown> | null } {
  const e: Errors = {};
  if (!d.type) return { errors: { type: "اختر نوع المنتج" }, specs: null };
  if (d.type === "curtains") {
    const L = LIMITS.curtains;
    if (d.curtains.windows.length < 1 || d.curtains.windows.length > L.windows[1]) e.windows = `من 1 إلى ${L.windows[1]} شباكاً`;
    const windows = d.curtains.windows.map((w, i) => ({
      width: num(e, `w${i}.width`, w.width, L.width, "m", "عرض الشباك"),
      height: num(e, `w${i}.height`, w.height, L.height, "m", "ارتفاع الشباك"),
      count: int(e, `w${i}.count`, w.count, L.count, "عدد الشبابيك بهذا المقاس"),
      panels: int(e, `w${i}.panels`, w.panels, L.panels, "عدد القطع"),
      unit: "m",
    }));
    if (Object.keys(e).length) return { errors: e, specs: null };
    return { errors: e, specs: { windows, fabric: text(d.curtains.fabric, 60), color: text(d.curtains.color, 40), blackout: d.curtains.blackout, style: text(d.curtains.style, 40), notes: text(d.curtains.notes, 500) } };
  }
  if (d.type === "ceiling") {
    const L = LIMITS.ceiling, c = d.ceiling;
    const width = num(e, "width", c.width, L.width, "m", "عرض السقف");
    const length = num(e, "length", c.length, L.length, "m", "طول السقف");
    const quantity = int(e, "quantity", c.quantity, L.quantity, "الكمية");
    if (Object.keys(e).length) return { errors: e, specs: null };
    return { errors: e, specs: { width, length, unit: "m", quantity, fabric: text(c.fabric, 60), color: text(c.color, 40), design: c.design, notes: text(c.notes, 500) } };
  }
  if (d.type === "mattress") {
    const L = LIMITS.mattress, m = d.mattress;
    const width = num(e, "width", m.width, L.width, "cm", "عرض الفرشة");
    const length = num(e, "length", m.length, L.length, "cm", "طول الفرشة");
    const height = num(e, "height", m.height, L.height, "cm", "ارتفاع الفرشة");
    const quantity = int(e, "quantity", m.quantity, L.quantity, "الكمية");
    if (width !== null && length !== null && width > length) e.width = "العرض عادةً أصغر من الطول — تأكد أنك لم تبدّل بينهما";
    if (Object.keys(e).length) return { errors: e, specs: null };
    return { errors: e, specs: { width, length, height, unit: "cm", quantity, fabric: text(m.fabric, 60), color: text(m.color, 40), cover: m.cover, notes: text(m.notes, 500) } };
  }
  const o = d.other, L = LIMITS.other, range = L[o.unit];
  if (text(o.name, 60).length < 2) e.name = "اكتب اسم المنتج";
  const width = num(e, "width", o.width, range, o.unit, "العرض");
  const length = num(e, "length", o.length, range, o.unit, "الطول");
  const height = String(o.height ?? "").trim() ? num(e, "height", o.height, range, o.unit, "الارتفاع") : null;
  const quantity = int(e, "quantity", o.quantity, L.quantity, "الكمية");
  if (Object.keys(e).length) return { errors: e, specs: null };
  return { errors: e, specs: { name: text(o.name, 60), width, length, height, unit: o.unit, quantity, fabric: text(o.fabric, 60), color: text(o.color, 40), description: text(o.description, 1000) } };
}

// بيانات العميل: الاسم والجوال والمنطقة إلزامية (الجوال للتواصل فقط، لا للتحقق من الهوية)
export function validateCustomer(c: Draft["customer"], canonical: (p: string) => string | null): { errors: Errors; phone: string | null } {
  const e: Errors = {};
  if (text(c.name, 80).length < 2) e.name = "اكتب الاسم";
  const phone = canonical(c.phone);
  if (!phone) e.phone = "رقم جوال غير صحيح (مثال: 0599123456)";
  if (text(c.area, 80).length < 2) e.area = "اكتب المدينة أو المنطقة";
  return { errors: e, phone };
}

// ملخص نصي للمواصفات (للمراجعة ورسالة WhatsApp ولوحة الإدارة)
export function specLines(type: ProductType, s: Record<string, unknown>): string[] {
  const v = (k: string) => s[k] as string | number | null | undefined;
  const opt = (label: string, x: unknown) => (x ? [`${label}: ${x}`] : []);
  if (type === "curtains") {
    const ws = (s.windows as { width: number; height: number; count: number; panels: number }[]) ?? [];
    return [
      ...ws.map((w, i) => `الشباك ${i + 1}: عرض ${w.width} م × ارتفاع ${w.height} م — العدد ${w.count} — ${w.panels} قطعة`),
      ...opt("القماش", v("fabric")), ...opt("اللون", v("color")),
      ...opt("التعتيم", BLACKOUT.find((b) => b.id === v("blackout"))?.label), ...opt("التصميم", v("style")), ...opt("ملاحظات", v("notes")),
    ];
  }
  if (type === "ceiling") {
    return [`عرض السقف ${v("width")} م × طول ${v("length")} م`, `الكمية: ${v("quantity")}`,
      ...opt("القماش", v("fabric")), ...opt("اللون", v("color")), ...opt("التصميم", CEILING_DESIGNS.find((x) => x.id === v("design"))?.label), ...opt("ملاحظات", v("notes"))];
  }
  if (type === "mattress") {
    return [`عرض ${v("width")} سم × طول ${v("length")} سم × ارتفاع ${v("height")} سم`, `الكمية: ${v("quantity")}`,
      ...opt("القماش", v("fabric")), ...opt("اللون", v("color")), ...opt("نوع الوجه", MATTRESS_COVERS.find((x) => x.id === v("cover"))?.label), ...opt("ملاحظات", v("notes"))];
  }
  const u = UNIT_LABEL[(v("unit") as Unit) ?? "cm"];
  return [`المنتج: ${v("name")}`, `عرض ${v("width")} ${u} × طول ${v("length")} ${u}${v("height") ? ` × ارتفاع ${v("height")} ${u}` : ""}`, `الكمية: ${v("quantity")}`,
    ...opt("القماش", v("fabric")), ...opt("اللون", v("color")), ...opt("الوصف", v("description"))];
}

export const STATUSES = ["new", "reviewing", "awaiting_customer", "confirmed", "in_progress", "ready", "completed", "cancelled"] as const;
export type CustomStatus = (typeof STATUSES)[number];
