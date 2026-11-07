import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { signOutEverywhere } from "../actions";

// صفحات الإدارة تقرأ الجلسة: تُعرض على الخادم في كل طلب ولا تُحضَّر مسبقاً
export const instant = false;

export default async function AdminHome() {
  const staff = await requireStaff();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">مرحباً {staff.full_name ?? ""}</h1>
      <section className="rounded-xl border border-gold/30 bg-white p-5">
        <h2 className="mb-3 font-bold">حالة الجلسة</h2>
        <ul className="space-y-1 text-sm">
          <li>الحساب: <span dir="ltr">{staff.email}</span></li>
          <li>الدور: {staff.role_name}</li>
          <li>التحقق بخطوتين: مفعّل ✓</li>
          <li>الصلاحيات: {staff.permissions.length}</li>
        </ul>
        <form action={signOutEverywhere} className="mt-4">
          <button className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-800 hover:bg-red-50">
            إنهاء كل الجلسات على كل الأجهزة
          </button>
        </form>
      </section>
      <Link href="/admin/products" className="block rounded-xl border border-gold/30 bg-white p-5 hover:border-gold">
        <h2 className="font-bold">المنتجات</h2>
        <p className="text-sm opacity-70">أضف منتجاتك وصورها وأسعارها وكمياتها.</p>
      </Link>
      <p className="text-sm opacity-70">أقسام الطلبات والمخزون والتقارير تُبنى في المراحل القادمة.</p>
    </div>
  );
}
