"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check, ChevronDown, Languages } from "lucide-react";
import { setAdminLocale } from "@/app/admin/(protected)/shell-actions";
import { useI18n } from "../I18nProvider";
import { popPanel, usePopover } from "./usePopover";

const LANGS = [{ code: "ar", name: "العربية" }, { code: "en", name: "English" }] as const;

// قائمة اللغة: تغيّر الاتجاه بالكامل (RTL/LTR) وتُحفظ في حساب الموظف
export function LanguageToggle() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { open, setOpen, ref, button } = usePopover();
  const [pending, start] = useTransition();
  const current = LANGS.find((l) => l.code === locale) ?? LANGS[0];
  return (
    <div ref={ref} className="relative">
      <button ref={button} type="button" disabled={pending} onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`${t.header.languageMenu}: ${current.name}`}
        className="flex h-10 items-center gap-1.5 rounded-full border border-[var(--a-line)] bg-white px-3 text-[0.8125rem] font-semibold hover:border-[#d5cfc2] hover:bg-[#faf8f4]">
        <Languages aria-hidden="true" strokeWidth={1.8} className="h-[1.05rem] w-[1.05rem] text-[var(--a-accent-ink)]" />
        <span className="hidden sm:inline">{current.name}</span>
        <ChevronDown aria-hidden="true" className="hidden h-3.5 w-3.5 text-[var(--a-muted)] sm:block" />
      </button>
      {open && (
        <ul role="menu" className={`${popPanel} w-40 p-1.5`}>
          {LANGS.map((l) => (
            <li key={l.code} role="none">
              <button type="button" role="menuitemradio" aria-checked={l.code === locale} lang={l.code}
                onClick={() => { setOpen(false); if (l.code !== locale) start(async () => { const r = await setAdminLocale(l.code); if (r.ok) router.refresh(); }); }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-[#f7f5f0]">
                {l.name}{l.code === locale && <Check aria-hidden="true" className="h-4 w-4 text-[var(--a-accent-ink)]" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
