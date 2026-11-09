import { Languages } from "lucide-react";
import { cairo, inter } from "@/app/admin/fonts";
import type { Locale } from "@/lib/admin/i18n";

// إطار صفحات الدخول والتحقق: نفس هوية لوحة الإدارة، مع تبديل لغة بسيط (يُحفظ في كوكي)
export function AuthCard({ title, children, locale = "ar", brand, switchLabel, switchHref }: {
  title: string; children: React.ReactNode; locale?: Locale; brand?: string; switchLabel?: string; switchHref?: string;
}) {
  return (
    <main lang={locale} dir={locale === "en" ? "ltr" : "rtl"} className={`admin-ui ${cairo.variable} ${inter.variable} flex flex-1 items-center justify-center px-4 py-12`}>
      <div className="w-full max-w-md">
        <div className="a-card p-8">
          <div className="mb-6 flex flex-col items-center gap-3">
            <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-[12px] bg-gradient-to-br from-[var(--a-accent-2)] to-[var(--a-accent)] text-lg font-bold text-[var(--a-sidebar)]">{locale === "en" ? "A" : "ع"}</span>
            <p className="text-sm font-semibold text-[var(--a-accent-ink)]">{brand ?? "مفروشات العصار"}</p>
            <h1 className="text-center text-2xl">{title}</h1>
          </div>
          {children}
        </div>
        {switchHref && <a href={switchHref} className="mx-auto mt-4 flex w-fit items-center gap-1.5 text-sm text-[var(--a-muted-ink)] hover:text-[var(--a-text)]"><Languages aria-hidden="true" className="h-4 w-4" />{switchLabel}</a>}
      </div>
    </main>
  );
}
