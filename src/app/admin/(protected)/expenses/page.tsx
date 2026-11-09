import { Receipt, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, can } from "@/lib/staff";
import { getDict, fmt } from "@/lib/admin/i18n";
import { gazaToday, parseRange } from "@/lib/admin/finance";
import { Card, EmptyState, PageHeader, PeriodPicker, StatCard, StatusBadge, rangeLabel } from "@/components/admin/ui";
import { ExpenseForm, VoidButton } from "./Forms";

export const instant = false;

export default async function ExpensesPage({ searchParams }: PageProps<"/admin/expenses">) {
  const staff = await requireStaff();
  const t = getDict(staff.locale), f = fmt(staff.locale);
  if (!can(staff, "finance.read")) return <p className="a-card p-4">{t.exp.needFinance}</p>;
  const range = parseRange(await searchParams);
  const supabase = await createClient();
  const { data } = await supabase.from("expenses").select("id, category, amount, spent_on, description, voided_at, void_reason, order_id, created_by")
    .gte("spent_on", range.from).lte("spent_on", range.to).order("spent_on", { ascending: false }).order("created_at", { ascending: false }).limit(500);
  const rows = data ?? [];
  const live = rows.filter((r) => !r.voided_at);
  const total = live.reduce((s, r) => s + Number(r.amount), 0);
  const byCat = Object.entries(live.reduce<Record<string, number>>((a, r) => ({ ...a, [r.category]: (a[r.category] ?? 0) + Number(r.amount) }), {})).sort((a, b) => b[1] - a[1]);
  const manage = can(staff, "finance.manage");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title={t.exp.title} subtitle={`${t.exp.subtitle} · ${rangeLabel(range, f)}`} actions={<PeriodPicker base="/admin/expenses" range={range} t={t} />} />
      {manage && <Card title={t.exp.add}><p className="mb-4 text-sm text-[var(--a-muted-ink)]">{t.exp.hint}</p><ExpenseForm today={gazaToday()} /></Card>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_2fr]">
        <StatCard t={t} f={f} label={t.exp.total} value={f.money(total)} icon={<Wallet className="h-[1.1rem] w-[1.1rem]" />} />
        <StatCard t={t} f={f} label={t.exp.count} value={f.number(live.length)} icon={<Receipt className="h-[1.1rem] w-[1.1rem]" />} />
        {byCat.length > 0 && (
          <div className="a-card space-y-2 p-4 sm:col-span-2 lg:col-span-1">
            {byCat.map(([c, v]) => (
              <div key={c}>
                <div className="flex justify-between text-sm"><span>{t.exp.cat[c] ?? c}</span><b className="tabular-nums">{f.money(v)}</b></div>
                <div className="mt-1 h-1.5 rounded-full bg-[#f3f0ea]"><div className="h-1.5 rounded-full bg-[#c8b48c]" style={{ width: `${(v / total) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Card bodyClass="">
        {rows.length === 0 ? <EmptyState icon={<Wallet className="h-5 w-5" />} title={t.exp.empty} /> : (
          <div className="overflow-x-auto">
            <table className="a-table min-w-[40rem]">
              <thead><tr><th scope="col">{t.exp.date}</th><th scope="col">{t.exp.category}</th><th scope="col">{t.exp.description}</th><th scope="col">{t.exp.amount}</th><th scope="col"><span className="sr-only">{t.common.actions}</span></th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id} className={r.voided_at ? "opacity-60" : ""}>
                  <td className="whitespace-nowrap tabular-nums">{f.date(`${r.spent_on}T12:00:00Z`)}</td><td>{t.exp.cat[r.category] ?? r.category}</td>
                  <td>{r.description}{r.voided_at && <span className="mt-1 flex items-center gap-2 text-xs"><StatusBadge status="voided" label={t.exp.voided} />{r.void_reason}</span>}</td>
                  <td className={`font-semibold tabular-nums ${r.voided_at ? "line-through" : ""}`}>{f.money(r.amount)}</td>
                  <td className="text-end">{!r.voided_at && manage && <VoidButton id={r.id} />}</td>
                </tr>))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
