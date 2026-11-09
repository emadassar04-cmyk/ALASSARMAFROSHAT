import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { IdleLogout } from "@/components/admin/IdleLogout";
import { signOut } from "../actions";

// صفحات الإدارة تقرأ الجلسة: تُعرض على الخادم في كل طلب ولا تُحضَّر مسبقاً
export const instant = false;

export const metadata: Metadata = { title: "لوحة الإدارة", robots: { index: false, follow: false } };

const NAV: { href: string; label: string; perm?: string; strong?: boolean }[] = [
  { href: "/admin", label: "الرئيسية", perm: "orders.read" },
  { href: "/admin/sales", label: "تسجيل بيع", perm: "sales.record", strong: true },
  { href: "/admin/orders", label: "الطلبات", perm: "orders.read" },
  { href: "/admin/purchases", label: "المشتريات", perm: "sales.review" },
  { href: "/admin/products", label: "المنتجات", perm: "catalog.manage" },
  { href: "/admin/inventory", label: "المخزون والجرد", perm: "inventory.manage" },
  { href: "/admin/reports", label: "التقارير", perm: "finance.read" },
  { href: "/admin/expenses", label: "المصروفات", perm: "finance.manage" },
  { href: "/admin/coupons", label: "الكوبونات", perm: "catalog.manage" },
  { href: "/admin/customers", label: "العملاء", perm: "orders.read" },
  { href: "/admin/campaigns", label: "حملة السحب", perm: "campaigns.manage" },
  { href: "/admin/staff", label: "الموظفون", perm: "staff.manage" },
  { href: "/admin/settings/delivery", label: "التوصيل والدفع", perm: "settings.manage" },
  { href: "/admin/settings/branches", label: "الفروع", perm: "settings.manage" },
  { href: "/admin/settings/marketing", label: "التسويق والسياسات", perm: "settings.manage" },
  { href: "/admin/settings/integrations", label: "التكاملات", perm: "settings.manage" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const staff = await requireStaff();
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <IdleLogout />
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gold/30 bg-white px-6 py-4">
        <div>
          <p className="font-bold text-gold-dark">مفروشات العصار – الإدارة</p>
          <p className="text-xs opacity-70">{staff.full_name ?? staff.email} · {staff.role_name}</p>
        </div>
        <nav aria-label="أقسام الإدارة" className="flex flex-wrap gap-x-4 gap-y-1 text-sm print:hidden">
          {/* كل موظف يرى ما تسمح به صلاحياته فقط (والتحقق الفعلي في الخادم وقاعدة البيانات) */}
          {NAV.filter((l) => !l.perm || staff.permissions.includes(l.perm)).map((l) => (
            <Link key={l.href} href={l.href} className={`hover:text-gold-dark ${l.strong ? "font-bold text-gold-dark" : ""}`}>{l.label}</Link>
          ))}
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
