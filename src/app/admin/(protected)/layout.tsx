import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { IdleLogout } from "@/components/admin/IdleLogout";
import { signOut } from "../actions";

// صفحات الإدارة تقرأ الجلسة: تُعرض على الخادم في كل طلب ولا تُحضَّر مسبقاً
export const instant = false;

export const metadata: Metadata = { title: "لوحة الإدارة", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const staff = await requireStaff();
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <IdleLogout />
      <header className="flex items-center justify-between border-b border-gold/30 bg-white px-6 py-4">
        <div>
          <p className="font-bold text-gold-dark">مفروشات العصار – الإدارة</p>
          <p className="text-xs opacity-70">{staff.full_name ?? staff.email} · {staff.role_name}</p>
        </div>
        <nav aria-label="أقسام الإدارة" className="flex gap-4 text-sm">
          <Link href="/admin" className="hover:text-gold-dark">الرئيسية</Link>
          <Link href="/admin/products" className="hover:text-gold-dark">المنتجات</Link>
          <Link href="/" target="_blank" className="hover:text-gold-dark">المتجر ↗</Link>
        </nav>
        <form action={signOut}>
          <button className="rounded-lg border border-gold/40 px-3 py-1.5 text-sm hover:bg-beige">تسجيل الخروج</button>
        </form>
      </header>
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
