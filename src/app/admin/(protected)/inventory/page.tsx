import Link from "next/link";
import { Boxes, PackageCheck, PackageX, Search, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, can } from "@/lib/staff";
import { getDict, fmt, fill } from "@/lib/admin/i18n";
import { Card, EmptyState, PageHeader, StatCard, withParams } from "@/components/admin/ui";
import { CountInput, SaleForm, StartStocktake, StocktakeActions } from "./Forms";

export const instant = false;

type Row = { id: string; name: string; color: string | null; size: string | null; is_active: boolean;
  products: { id: string; name: string; status: string; availability_mode: string; low_stock_threshold: number };
  inventory: { on_hand: number; reserved: number }[] };

export default async function InventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  const staff = await requireStaff();
  const t = getDict(staff.locale), f = fmt(staff.locale);
  const canManage = can(staff, "inventory.manage");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  const filter = sp.low === "1" || sp.filter === "low" ? "low" : sp.filter === "out" ? "out" : "";
  const supabase = await createClient();

  const [{ data: variants }, { data: openTake }, { data: movements }] = await Promise.all([
    supabase.from("product_variants").select("id, name, color, size, is_active, products!inner(id, name, status, availability_mode, low_stock_threshold), inventory(on_hand, reserved)")
      .neq("products.status", "archived").eq("products.availability_mode", "stock").order("created_at").limit(1000),
    supabase.from("stocktakes").select("id, created_at, note").eq("status", "open").maybeSingle(),
    supabase.from("inventory_movements").select("id, kind, on_hand_delta, reserved_delta, on_hand_after, note, created_at, actor_id, product_variants(name, products(name))")
      .order("id", { ascending: false }).limit(40),
  ]);
  const all = ((variants ?? []) as unknown as Row[]).map((v) => {
    const inv = v.inventory[0] ?? { on_hand: 0, reserved: 0 };
    const label = [v.name !== "افتراضي" ? v.name : null, v.color, v.size].filter(Boolean).join(" · ");
    return { ...v, label, on_hand: inv.on_hand, reserved: inv.reserved, available: inv.on_hand - inv.reserved };
  });
  const isLow = (r: (typeof all)[number]) => r.available > 0 && r.available <= r.products.low_stock_threshold;
  let rows = all;
  if (q) rows = rows.filter((r) => r.products.name.includes(q) || r.label.includes(q));
  if (filter === "low") rows = rows.filter((r) => r.available <= r.products.low_stock_threshold);
  if (filter === "out") rows = rows.filter((r) => r.available <= 0);

  let items: { id: number; variant_id: string; expected_on_hand: number; counted: number | null }[] = [];
  if (openTake) {
    const { data } = await supabase.from("stocktake_items").select("id, variant_id, expected_on_hand, counted").eq("stocktake_id", openTake.id);
    items = data ?? [];
  }
  const byVariant = new Map(all.map((r) => [r.id, r]));
  const countedN = items.filter((i) => i.counted !== null).length;
  const ico = "h-[1.1rem] w-[1.1rem]";

  return (
    <div className="mx-auto max-w-[90rem] space-y-6">
      <PageHeader title={t.inv.title} subtitle={t.inv.subtitle} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard t={t} f={f} label={t.inv.skus} value={f.number(all.length)} icon={<Boxes className={ico} />} href="/admin/inventory" />
        <StatCard t={t} f={f} label={t.inv.totalUnits} value={f.number(all.reduce((a, r) => a + Math.max(0, r.available), 0))} icon={<PackageCheck className={ico} />} />
        <StatCard t={t} f={f} label={t.inv.lowCount} value={f.number(all.filter(isLow).length)} icon={<TriangleAlert className={ico} />} tone={all.some(isLow) ? "warn" : undefined} href="/admin/inventory?filter=low" />
        <StatCard t={t} f={f} label={t.inv.outCount} value={f.number(all.filter((r) => r.available <= 0).length)} icon={<PackageX className={ico} />} tone={all.some((r) => r.available <= 0) ? "warn" : undefined} href="/admin/inventory?filter=out" />
      </div>

      <Card title={t.inv.stocktake}>
        {openTake ? (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-[var(--a-muted-ink)]">{fill(t.inv.openSince, { d: f.dateTime(openTake.created_at) })}</p>
            <div className="overflow-x-auto rounded-[10px] border border-[var(--a-line)]">
              <table className="a-table min-w-[32rem]">
                <thead><tr><th scope="col">{t.inv.product}</th><th scope="col">{t.inv.recorded}</th><th scope="col">{t.inv.counted}</th></tr></thead>
                <tbody>{items.map((i) => { const v = byVariant.get(i.variant_id); return (
                  <tr key={i.id}><td>{v?.products.name ?? "—"} {v?.label && <span className="text-[var(--a-muted-ink)]">({v.label})</span>}</td>
                    <td className="tabular-nums">{f.number(i.expected_on_hand)}</td><td><CountInput itemId={i.id} counted={i.counted} expected={i.expected_on_hand} /></td></tr>); })}
                </tbody>
              </table>
            </div>
            {canManage && <StocktakeActions id={openTake.id} counted={countedN} />}
          </div>
        ) : canManage ? (
          <div className="space-y-3"><p className="text-sm text-[var(--a-muted-ink)]">{t.inv.startHint}</p><StartStocktake /></div>
        ) : <p className="text-sm text-[var(--a-muted-ink)]">{t.inv.noOpen}</p>}
      </Card>

      <Card title={t.inv.current} bodyClass="" action={
        <form className="flex flex-wrap items-center gap-2">
          {filter && <input type="hidden" name="filter" value={filter} />}
          <label className="relative block">
            <span className="sr-only">{t.common.search}</span>
            <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--a-muted)]" />
            <input name="q" defaultValue={q} placeholder={t.inv.searchPlaceholder} className="a-input h-9 min-h-0 w-52 ps-9" />
          </label>
          <button className="a-btn a-btn-ghost h-9 min-h-0">{t.common.search}</button>
        </form>
      }>
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--a-line)] px-5 py-3">
          {([["", t.inv.all], ["low", t.inv.onlyLow], ["out", t.inv.onlyOut]] as const).map(([k, l]) => (
            <Link key={k || "all"} href={withParams("/admin/inventory", sp, { filter: k || null, low: null })} aria-current={filter === k ? "true" : undefined} className="a-chip">{l}</Link>
          ))}
          <p className="w-full text-xs text-[var(--a-muted-ink)]">{t.inv.saleHint}</p>
        </div>
        {rows.length === 0 ? <EmptyState icon={<Boxes className="h-5 w-5" />} title={t.common.noData} /> : (
          <div className="overflow-x-auto">
            <table className="a-table min-w-[46rem]">
              <thead><tr><th scope="col">{t.inv.product}</th><th scope="col">{t.inv.onHand}</th><th scope="col">{t.inv.reserved}</th><th scope="col">{t.inv.available}</th>{canManage && <th scope="col">{t.inv.sellInStore}</th>}</tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/admin/products/${r.products.id}`} className="font-medium hover:text-[var(--a-accent-ink)]">{r.products.name}</Link>{r.label && <span className="text-[var(--a-muted-ink)]"> ({r.label})</span>}
                    {r.products.status !== "active" && <span className="ms-1.5 rounded bg-[#f1eee8] px-1.5 text-xs">{t.inv.draft}</span>}</td>
                  <td className="tabular-nums">{f.number(r.on_hand)}</td><td className="tabular-nums">{f.number(r.reserved)}</td>
                  <td className={`font-semibold tabular-nums ${r.available <= 0 ? "text-[var(--a-danger-ink)]" : isLow(r) ? "text-[var(--a-warning)]" : ""}`}>{f.number(r.available)}</td>
                  {canManage && <td><SaleForm variantId={r.id} available={r.available} /></td>}
                </tr>))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={t.inv.movements} bodyClass="">
        <ul className="divide-y divide-[var(--a-line)] text-sm">
          {(movements ?? []).map((m) => {
            const pv = m.product_variants as unknown as { name: string; products: { name: string } } | null;
            const delta = m.on_hand_delta || 0;
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <span className="min-w-0"><b className="font-medium">{pv?.products.name}</b> <span className="text-[var(--a-muted-ink)]">· {t.inv.kind[m.kind] ?? m.kind}{m.note ? ` (${m.note})` : ""}</span></span>
                <span className="flex items-center gap-3 tabular-nums text-[var(--a-muted-ink)]">
                  {delta ? <b className={delta > 0 ? "text-[var(--a-success)]" : "text-[var(--a-danger-ink)]"}>{delta > 0 ? "+" : ""}{delta}</b>
                    : m.reserved_delta ? <span>{t.inv.reserve} {m.reserved_delta > 0 ? "+" : ""}{m.reserved_delta}</span> : null}
                  <span>{t.inv.after} {f.number(m.on_hand_after)}</span><span>{f.dateTime(m.created_at)}</span>
                </span>
              </li>);
          })}
        </ul>
      </Card>
    </div>
  );
}
