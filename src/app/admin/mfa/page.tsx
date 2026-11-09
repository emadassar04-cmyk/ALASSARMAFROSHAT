import type { Metadata } from "next";
import { AuthCard } from "@/components/admin/AuthCard";
import { authLocale } from "@/lib/admin/auth-locale";
import { getDict } from "@/lib/admin/i18n";
import { MfaForm } from "./MfaForm";
import { signOut } from "../actions";

export const instant = false;

export const metadata: Metadata = { title: "التحقق بخطوتين · Two-step verification", robots: { index: false, follow: false } };

export default async function MfaPage() {
  const locale = await authLocale();
  const t = getDict(locale), A = t.auth;
  return (
    <AuthCard title={A.mfaTitle} locale={locale} brand={t.meta.brand} switchLabel={A.other} switchHref={`/admin/locale?l=${locale === "ar" ? "en" : "ar"}&next=/admin/mfa`}>
      <MfaForm L={A} />
      <form action={signOut} className="mt-6 text-center">
        <button className="text-sm text-[var(--a-muted-ink)] underline">{A.signOut}</button>
      </form>
    </AuthCard>
  );
}
