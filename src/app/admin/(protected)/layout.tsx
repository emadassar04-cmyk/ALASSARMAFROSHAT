import type { Metadata } from "next";
import { cookies } from "next/headers";
import { after } from "next/server";
import { flushTelegram } from "@/lib/notify/telegram";
import { requireStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { getDict } from "@/lib/admin/i18n";
import { navFor } from "@/lib/admin/nav";
import { IdleLogout } from "@/components/admin/IdleLogout";
import { AdminI18nProvider } from "@/components/admin/I18nProvider";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import type { Notice } from "./shell-actions";


// صفحات الإدارة تقرأ الجلسة: تُعرض على الخادم في كل طلب ولا تُحضَّر مسبقاً
export const instant = false;

export const metadata: Metadata = { title: "لوحة الإدارة", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const staff = await requireStaff();
  // بعد الدخول وفي أثناء استخدام اللوحة: إرسال إشعارات Telegram المعلّقة (مرة كل 15 ثانية كحد أقصى لكل خادم)
  after(() => flushTelegram());
  const t = getDict(staff.locale);
  const supabase = await createClient();
  const [{ data: notices }, jar] = await Promise.all([supabase.rpc("admin_notifications"), cookies()]);
  const items = navFor(staff.permissions).map((n) => ({ href: n.href, label: t.nav[n.key], icon: n.icon, group: n.group, strong: n.strong }));
  const role = (staff.locale === "en" ? staff.role_name_en : staff.role_name) ?? staff.role ?? "";

  return (
    <div lang={staff.locale} dir={t.meta.dir} className={`admin-ui flex min-h-full flex-1 flex-col`}>
      <IdleLogout />
      <AdminI18nProvider locale={staff.locale} dict={t}>
        <AdminShell items={items} groups={t.nav.groups} collapsed={jar.get("admin-nav")?.value === "collapsed"}
          user={{ name: staff.full_name ?? staff.email ?? "", email: staff.email ?? "", role }} notices={(notices ?? []) as Notice[]}>
          {children}
        </AdminShell>
      </AdminI18nProvider>
    </div>
  );
}
