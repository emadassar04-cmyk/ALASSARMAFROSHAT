"use client";
import { createContext, useContext, useEffect, useMemo } from "react";
import type { Dict } from "@/lib/admin/dict/ar";
import { fmt, type Locale } from "@/lib/admin/i18n";

type Ctx = { locale: Locale; t: Dict; f: ReturnType<typeof fmt>; tx: (m: string | null | undefined) => string };
const I18n = createContext<Ctx | null>(null);

// يوفر القاموس واللغة لمكونات المتصفح، ويضبط lang/dir على <html> نفسه (شريط التمرير والنوافذ الأصلية)
export function AdminI18nProvider({ locale, dict, children }: { locale: Locale; dict: Dict; children: React.ReactNode }) {
  // tx: يترجم رسائل الخادم العربية الثابتة (والرسائل ذات الأرقام بنمط {n}) إلى لغة الواجهة
  const value = useMemo(() => {
    const tx = (m: string | null | undefined) => {
      if (!m) return "";
      if (locale === "ar") return m;
      if (dict.server[m]) return dict.server[m];
      for (const [k, v] of Object.entries(dict.server)) {
        if (!k.includes("{n}")) continue;
        const re = new RegExp("^" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace("\\{n\\}", "(.+)") + "$");
        const hit = m.match(re);
        if (hit) return v.replace("{n}", hit[1]);
      }
      return m;
    };
    return { locale, t: dict, f: fmt(locale), tx };
  }, [locale, dict]);
  useEffect(() => {
    const html = document.documentElement;
    const prev = { lang: html.lang, dir: html.dir };
    html.lang = locale;
    html.dir = dict.meta.dir;
    return () => { html.lang = prev.lang; html.dir = prev.dir; };
  }, [locale, dict.meta.dir]);
  return <I18n.Provider value={value}>{children}</I18n.Provider>;
}

export function useI18n(): Ctx {
  const v = useContext(I18n);
  if (!v) throw new Error("useI18n outside AdminI18nProvider");
  return v;
}
