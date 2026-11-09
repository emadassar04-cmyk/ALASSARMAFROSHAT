"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Languages } from "lucide-react";
import { setAdminLocale } from "@/app/admin/(protected)/shell-actions";
import { useI18n } from "../I18nProvider";
import { iconBtn } from "./usePopover";

// تبديل اللغة يغيّر الاتجاه بالكامل (RTL/LTR) ويُحفظ في حساب الموظف
export function LanguageToggle() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = locale === "ar" ? "en" : "ar";
  return (
    <button type="button" disabled={pending} aria-label={t.header.languageLabel} lang={next}
      onClick={() => start(async () => { const r = await setAdminLocale(next); if (r.ok) router.refresh(); })}
      className={`${iconBtn} sm:w-auto sm:gap-1.5 sm:px-3 sm:text-[0.8125rem] sm:font-semibold`}>
      <Languages aria-hidden="true" strokeWidth={1.8} className="h-[1.1rem] w-[1.1rem]" />
      <span className="hidden sm:inline">{t.header.language}</span>
    </button>
  );
}
