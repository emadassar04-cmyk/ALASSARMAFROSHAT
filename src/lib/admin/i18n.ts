// لغة لوحة الإدارة: القاموس + تنسيق الأرقام والتواريخ حسب اللغة (أرقام لاتينية في الحالتين)
import { ar, type Dict } from "./dict/ar";
import { en } from "./dict/en";

export type Locale = "ar" | "en";
export const LOCALES: Locale[] = ["ar", "en"];
export const LOCALE_COOKIE = "admin-locale";
export const isLocale = (v: unknown): v is Locale => v === "ar" || v === "en";

export function getDict(locale: Locale): Dict {
  return locale === "en" ? en : ar;
}

// استبدال {n} و{amount} في النصوص
export function fill(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

const TZ = "Asia/Gaza";
const tag = (l: Locale) => (l === "en" ? "en-US" : "ar");

export function fmt(locale: Locale) {
  const nf = new Intl.NumberFormat(tag(locale), { numberingSystem: "latn", maximumFractionDigits: 0 });
  const money0 = new Intl.NumberFormat(tag(locale), { style: "currency", currency: "ILS", numberingSystem: "latn", maximumFractionDigits: 0 });
  const money2 = new Intl.NumberFormat(tag(locale), { style: "currency", currency: "ILS", numberingSystem: "latn", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const compact = new Intl.NumberFormat(tag(locale), { notation: "compact", numberingSystem: "latn", maximumFractionDigits: 1 });
  const date = new Intl.DateTimeFormat(tag(locale), { timeZone: TZ, numberingSystem: "latn", day: "numeric", month: "short", year: "numeric" });
  const dateTime = new Intl.DateTimeFormat(tag(locale), { timeZone: TZ, numberingSystem: "latn", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const dayMonth = new Intl.DateTimeFormat(tag(locale), { timeZone: "UTC", numberingSystem: "latn", day: "numeric", month: "short" });
  const monthYear = new Intl.DateTimeFormat(tag(locale), { timeZone: "UTC", numberingSystem: "latn", month: "short", year: "2-digit" });
  return {
    number: (v: number | string | null | undefined) => nf.format(Number(v ?? 0)),
    money: (v: number | string | null | undefined) => {
      const n = Number(v ?? 0);
      return Number.isInteger(n) ? money0.format(n) : money2.format(n);
    },
    compactMoney: (v: number) => `${compact.format(v)} ₪`,
    date: (iso: string | null | undefined) => (iso ? date.format(new Date(iso)) : "—"),
    dateTime: (iso: string | null | undefined) => (iso ? dateTime.format(new Date(iso)) : "—"),
    // مفاتيح السلاسل الزمنية من قاعدة البيانات: YYYY-MM-DD أو YYYY-MM أو YYYY-MM-DDTHH
    bucket: (t: string, unit: "hour" | "day" | "month") =>
      unit === "hour" ? `${Number(t.slice(11, 13))}:00`
        : unit === "month" ? monthYear.format(new Date(`${t}-01T00:00:00Z`))
        : dayMonth.format(new Date(`${t}T00:00:00Z`)),
  };
}
export type Fmt = ReturnType<typeof fmt>;
