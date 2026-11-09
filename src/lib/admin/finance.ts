// أنواع وأدوات التقارير المالية (تطابق finance_report / admin_dashboard في قاعدة البيانات)
export type Kpis = {
  orders: number; revenue: number; products_net: number; delivery_fees: number; discounts: number;
  cogs: number; items_missing_cost: number; manager_profit: number; store_due: number;
  items_missing_profit: number; store_due_pending: number; expenses: number; manager_net: number;
  units: number; avg_order: number; created_orders: number; created_cancelled: number; created_delivered: number;
};

export type Report = {
  from: string; to: string; days: number;
  kpis: Kpis; previous: Kpis;
  daily: { day: string; orders: number; revenue: number; profit: number }[];
  products: { product_id: string | null; name: string; qty: number; revenue: number; profit: number | null; store_due: number | null; cogs: number | null }[];
  categories: { name: string; qty: number; revenue: number }[];
  unsold: { id: string; name: string }[];
  expenses: { category: string; amount: number; n: number }[];
  sources: { source: string; orders: number; revenue: number }[];
};

export const EXPENSE_LABEL: Record<string, string> = {
  delivery: "توصيل (أجرة المندوب)", packaging: "تغليف وتجهيز", marketing: "إعلانات وتسويق",
  payment_fees: "عمولات تحويل ودفع", discounts: "خصومات خارج الطلبات", refunds: "مبالغ مستردة", other: "أخرى",
};

const SOURCE_LABEL: Record<string, string> = {
  instagram: "Instagram", facebook: "Facebook", whatsapp: "WhatsApp", google: "Google", direct: "مباشر", "غير معروف": "غير معروف",
};
export const sourceLabel = (s: string) => SOURCE_LABEL[s] ?? s;

// تاريخ اليوم بتوقيت فلسطين بصيغة YYYY-MM-DD
export function gazaToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Gaza" }).format(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type Preset = "today" | "yesterday" | "7d" | "30d" | "month" | "last_month" | "year";
export const PRESET_LABEL: Record<Preset, string> = {
  today: "اليوم", yesterday: "أمس", "7d": "آخر 7 أيام", "30d": "آخر 30 يوماً", month: "هذا الشهر", last_month: "الشهر الماضي", year: "هذا العام",
};

export function presetRange(p: Preset, today = gazaToday()): { from: string; to: string } {
  const [y, m] = today.split("-").map(Number);
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  switch (p) {
    case "today": return { from: today, to: today };
    case "yesterday": return { from: addDays(today, -1), to: addDays(today, -1) };
    case "7d": return { from: addDays(today, -6), to: today };
    case "30d": return { from: addDays(today, -29), to: today };
    case "month": return { from: monthStart, to: today };
    case "last_month": return { from: addDays(monthStart, -1).slice(0, 8) + "01", to: addDays(monthStart, -1) };
    case "year": return { from: `${y}-01-01`, to: today };
  }
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export function parseRange(sp: Record<string, string | string[] | undefined>, fallback: Preset = "month"): { from: string; to: string; preset?: Preset } {
  const preset = typeof sp.preset === "string" && sp.preset in PRESET_LABEL ? (sp.preset as Preset) : undefined;
  if (preset) return { ...presetRange(preset), preset };
  const from = typeof sp.from === "string" && ISO.test(sp.from) ? sp.from : undefined;
  const to = typeof sp.to === "string" && ISO.test(sp.to) ? sp.to : undefined;
  // فترة مخصصة: حتى سنة كحد أقصى (نفس حد قاعدة البيانات)
  if (from && to && from <= to && (Date.parse(to) - Date.parse(from)) / 86_400_000 <= 366) return { from, to };
  return { ...presetRange(fallback), preset: fallback };
}

// نسبة التغير مقارنة بالفترة السابقة (null إن لم توجد قيمة سابقة)
export function change(cur: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((cur - prev) / Math.abs(prev)) * 100);
}
