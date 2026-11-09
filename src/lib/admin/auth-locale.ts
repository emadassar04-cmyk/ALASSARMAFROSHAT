import "server-only";
import { cookies, headers } from "next/headers";
import { isLocale, LOCALE_COOKIE, type Locale } from "./i18n";

// لغة صفحات ما قبل الدخول: الكوكي المحفوظ، وإلا لغة المتصفح (العربية افتراضياً)
export async function authLocale(): Promise<Locale> {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  const al = (await headers()).get("accept-language") ?? "";
  return /^en\b/i.test(al.trim()) ? "en" : "ar";
}
