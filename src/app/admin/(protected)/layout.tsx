import type { Metadata } from "next";
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
        <form action={signOut}>
          <button className="rounded-lg border border-gold/40 px-3 py-1.5 text-sm hover:bg-beige">تسجيل الخروج</button>
        </form>
      </header>
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
