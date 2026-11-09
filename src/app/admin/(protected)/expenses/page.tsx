import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { formatPrice } from "@/lib/format";
import { EXPENSE_LABEL, gazaToday, parseRange, PRESET_LABEL, type Preset } from "@/lib/admin/finance";
import { ExpenseForm, VoidButton } from "./Forms";

export const instant = false;

export default async function ExpensesPage({ searchParams }: PageProps<"/admin/expenses">) {
  const staff = await requireStaff();
  if (!staff.permissions.includes("finance.read")) return <p className="rounded-lg bg-amber-50 p-4">تحتاج صلاحية المالية.</p>;
  const range = parseRange(await searchParams);
  const supabase = await createClient();
  const { data } = await supabase.from("expenses").select("id, category, amount, spent_on, description, voided_at, void_reason, order_id")
    .gte("spent_on", range.from).lte("spent_on", range.to).order("spent_on", { ascending: false }).order("created_at", { ascending: false }).limit(500);
  const rows = data ?? [];
  const total = rows.filter((r) => !r.voided_at).reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <h1 className="text-2xl font-bold">المصروفات</h1>
      <p className="text-sm opacity-80">
        سجّل هنا ما تدفعه أنت: أجرة المندوب، التغليف، الإعلانات، عمولات التحويل. خصومات الكوبونات <b>لا تُسجَّل</b> هنا لأنها مخصومة من المبيعات أصلاً.
        لا يُحذف أي مصروف: يمكن إلغاؤه مع السبب ويبقى في السجل.
      </p>
      {staff.permissions.includes("finance.manage") && <ExpenseForm today={gazaToday()} />}
      <nav className="flex flex-wrap gap-2">
        {(Object.keys(PRESET_LABEL) as Preset[]).map((p) => (
          <Link key={p} href={`/admin/expenses?preset=${p}`} className={`rounded-full px-3 py-1.5 text-sm ${range.preset === p ? "bg-charcoal text-white" : "border border-gold/30 bg-white"}`}>{PRESET_LABEL[p]}</Link>
        ))}
      </nav>
      <p className="font-medium">الإجمالي ({range.from} ← {range.to}): {formatPrice(total)}</p>
      {rows.length === 0 ? <p className="rounded-2xl border border-dashed border-gold/40 bg-white p-8 text-center">لا مصروفات في هذه الفترة.</p> : (
        <div className="overflow-x-auto rounded-2xl border border-gold/20 bg-white">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="bg-beige/60"><tr><th className="p-2 text-start">التاريخ</th><th className="p-2 text-start">النوع</th><th className="p-2 text-start">الوصف</th><th className="p-2 text-start">المبلغ</th><th className="p-2" /></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className={`border-t border-gold/10 ${r.voided_at ? "opacity-50" : ""}`}>
                <td className="p-2">{r.spent_on}</td><td className="p-2">{EXPENSE_LABEL[r.category]}</td>
                <td className="p-2">{r.description}{r.voided_at && <span className="block text-xs">ملغى: {r.void_reason}</span>}</td>
                <td className={`p-2 ${r.voided_at ? "line-through" : ""}`}>{formatPrice(r.amount)}</td>
                <td className="p-2">{!r.voided_at && staff.permissions.includes("finance.manage") && <VoidButton id={r.id} />}</td>
              </tr>))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
