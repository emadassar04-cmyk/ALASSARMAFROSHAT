import type { Metadata } from "next";
import { AuthCard } from "@/components/admin/AuthCard";
import { GoogleButton } from "./GoogleButton";

// صفحات الإدارة تقرأ الجلسة: تُعرض على الخادم في كل طلب ولا تُحضَّر مسبقاً
export const instant = false;

export const metadata: Metadata = { title: "دخول الإدارة", robots: { index: false, follow: false } };

const ERRORS: Record<string, string> = {
  not_staff: "هذا الحساب ليس له صلاحية دخول لوحة الإدارة.",
  callback: "لم يكتمل تسجيل الدخول. حاول مرة أخرى.",
  context: "تعذر التحقق من الصلاحيات. حاول مرة أخرى.",
  idle: "تم تسجيل خروجك تلقائياً بسبب عدم النشاط.",
};

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;
  return (
    <AuthCard title="دخول لوحة الإدارة">
      {message && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-center text-sm text-red-800">{message}</p>}
      <GoogleButton />
      <p className="mt-6 text-center text-xs opacity-70">بعد Google ستُطلب منك خطوة تحقق ثانية من تطبيق المصادقة.</p>
    </AuthCard>
  );
}
