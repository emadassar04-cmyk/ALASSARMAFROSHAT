import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { formatPrice } from "@/lib/format";
import { SaleForm } from "./SaleForm";

export const instant = false;

const STATUS: Record<string, string> = { submitted: "بانتظار الاعتماد", approved: "معتمدة", rejected: "مرفوضة", voided: "ملغاة" };

export default async function SalesPage() {
  const staff = await requireStaff();
  if (!staff.permissions.includes("sales.record")) redirect("/admin");
  const supabase = await createClient();
  const [{ data: branches }, { data: mine }] = await Promise.all([
    supabase.from("branches").select("id, name").eq("is_active", true).order("is_default", { ascending: false }).order("sort_order"),
    // آخر عمليات هذا الموظف فقط (الصلاحيات في قاعدة البيانات تمنع رؤية غيرها)
    supabase.from("store_purchases").select("id, amount, status, created_at, branch:branches(name)")
      .eq("created_by", (await supabase.auth.getClaims()).data?.claims.sub ?? "").order("created_at", { ascending: false }).limit(8),
  ]);
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">تسجيل عملية بيع في الفرع</h1>
      <SaleForm branches={branches ?? []} />
      {(mine ?? []).length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold">آخر عملياتك</h2>
          <ul className="divide-y divide-gold/15 rounded-2xl border border-gold/20 bg-white text-sm">
            {(mine ?? []).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                <span className="tabular-nums">{formatPrice(m.amount)}</span>
                <span className="opacity-70">{(m.branch as unknown as { name: string } | null)?.name}</span>
                <span className="text-xs">{STATUS[m.status] ?? m.status}</span>
                <span className="text-xs opacity-60" dir="ltr">{new Date(m.created_at).toLocaleTimeString("ar", { timeZone: "Asia/Gaza", numberingSystem: "latn", hour: "2-digit", minute: "2-digit" })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
