import type { Metadata } from "next";
import { AuthCard } from "@/components/admin/AuthCard";
import { authLocale } from "@/lib/admin/auth-locale";
import { getDict } from "@/lib/admin/i18n";
import { GoogleButton } from "./GoogleButton";

// صفحات الإدارة تقرأ الجلسة: تُعرض على الخادم في كل طلب ولا تُحضَّر مسبقاً
export const instant = false;

export const metadata: Metadata = { title: "دخول الإدارة · Admin sign-in", robots: { index: false, follow: false } };

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  const [{ error }, locale] = await Promise.all([searchParams, authLocale()]);
  const t = getDict(locale), A = t.auth;
  const message = typeof error === "string" ? A.err[error] : undefined;
  return (
    <AuthCard title={A.loginTitle} locale={locale} brand={t.meta.brand} switchLabel={A.other} switchHref={`/admin/locale?l=${locale === "ar" ? "en" : "ar"}&next=/admin/login`}>
      {message && <p role="alert" className="mb-4 rounded-[10px] bg-[#fdf3f3] p-3 text-center text-sm text-[var(--a-danger-ink)]">{message}</p>}
      <GoogleButton labels={{ google: A.google, redirecting: A.redirecting, failed: A.startFailed }} />
      <p className="mt-6 text-center text-xs text-[var(--a-muted-ink)]">{A.afterGoogle}</p>
    </AuthCard>
  );
}
