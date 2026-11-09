import { Suspense } from "react";
import { PageSkeleton } from "@/components/admin/PageSkeleton";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { getDict, fmt } from "@/lib/admin/i18n";
import { Card, PageHeader, StatusBadge } from "@/components/admin/ui";
import { SaleForm } from "./SaleForm";

export const instant = false;


async function SalesPageContent() {
  const staff = await requireStaff();
  if (!staff.permissions.includes("sales.record")) redirect("/admin");
  const t = getDict(staff.locale), f = fmt(staff.locale);
  const supabase = await createClient();
  const [{ data: branches }, { data: mine }] = await Promise.all([
    supabase.from("branches").select("id, name").eq("is_active", true).order("is_default", { ascending: false }).order("sort_order"),
    // آخر عمليات هذا الموظف فقط (الصلاحيات في قاعدة البيانات تمنع رؤية غيرها)
    supabase.from("store_purchases").select("id, amount, status, created_at, branch:branches(name)")
      .eq("created_by", (await supabase.auth.getClaims()).data?.claims.sub ?? "").order("created_at", { ascending: false }).limit(8),
  ]);
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader title={t.sale.title} />
      <SaleForm branches={branches ?? []} />
      {(mine ?? []).length > 0 && (
        <Card title={t.sale.mine} bodyClass="">
          <ul className="divide-y divide-[var(--a-line)] text-sm">
            {(mine ?? []).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 px-5 py-3">
                <b className="tabular-nums">{f.money(m.amount)}</b>
                <span className="text-[var(--a-muted-ink)]">{(m.branch as unknown as { name: string } | null)?.name}</span>
                <StatusBadge status={m.status} label={t.pur.st[m.status] ?? m.status} />
                <span className="text-xs text-[var(--a-muted-ink)]">{f.dateTime(m.created_at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

// الصفحة تُعرض فوراً بهيكل تحميل، ثم يتدفق المحتوى (تنقل سلس دون انتظار الخادم)
export default function SalesPage() {
  return <Suspense fallback={<PageSkeleton variant="form" />}><SalesPageContent /></Suspense>;
}
