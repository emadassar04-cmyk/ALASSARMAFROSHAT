import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { CountInput, SaleForm, StartStocktake, StocktakeActions } from "./Forms";

export const instant = false;

type Row = { id: string; name: string; color: string | null; size: string | null; is_active: boolean;
  products: { id: string; name: string; status: string; availability_mode: string; low_stock_threshold: number };
  inventory: { on_hand: number; reserved: number }[] };

const KIND: Record<string, string> = {
  initial: "كمية أولية", adjustment: "تعديل", reserve: "حجز طلب", release: "تحرير حجز", sale_online: "بيع أونلاين",
  sale_in_store: "بيع في المحل", stocktake: "جرد", cancellation_restock: "إرجاع بعد إلغاء", return_restock: "إرجاع",
};
const dt = (s: string) => new Date(s).toLocaleString("ar", { numberingSystem: "latn", timeZone: "Asia/Gaza", dateStyle: "short", timeStyle: "short" });

export default async function InventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  const staff = await requireStaff();
  const canManage = staff.permissions.includes("inventory.manage");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const onlyLow = sp.low === "1";
  const supabase = await createClient();

  const [{ data: variants }, { data: openTake }, { data: movements }] = await Promise.all([
    supabase.from("product_variants").select("id, name, color, size, is_active, products!inner(id, name, status, availability_mode, low_stock_threshold), inventory(on_hand, reserved)")
      .neq("products.status", "archived").eq("products.availability_mode", "stock").order("created_at").limit(1000),
    supabase.from("stocktakes").select("id, created_at, note").eq("status", "open").maybeSingle(),
    supabase.from("inventory_movements").select("id, kind, on_hand_delta, reserved_delta, on_hand_after, note, created_at, product_variants(name, products(name))")
      .order("id", { ascending: false }).limit(30),
  ]);
  let rows = ((variants ?? []) as unknown as Row[]).map((v) => {
    const inv = v.inventory[0] ?? { on_hand: 0, reserved: 0 };
    const label = [v.name !== "افتراضي" ? v.name : null, v.color, v.size].filter(Boolean).join(" · ");
    return { ...v, label, on_hand: inv.on_hand, reserved: inv.reserved, available: inv.on_hand - inv.reserved };
  });
  if (q) rows = rows.filter((r) => r.products.name.includes(q) || r.label.includes(q));
  if (onlyLow) rows = rows.filter((r) => r.available <= r.products.low_stock_threshold);

  let items: { id: number; variant_id: string; expected_on_hand: number; counted: number | null }[] = [];
  if (openTake) {
    const { data } = await supabase.from("stocktake_items").select("id, variant_id, expected_on_hand, counted").eq("stocktake_id", openTake.id);
    items = data ?? [];
  }
  const byVariant = new Map(rows.map((r) => [r.id, r]));
  const countedN = items.filter((i) => i.counted !== null).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-2xl font-bold">المخزون والجرد</h1>

      <section className="space-y-3 rounded-2xl border border-gold/20 bg-white p-4">
        <h2 className="font-bold">الجرد الفعلي</h2>
        {openTake ? (
          <>
            <p className="text-sm">جرد مفتوح منذ {dt(openTake.created_at)}. اكتب الكمية المعدودة لكل صنف (تُحفظ تلقائياً). عند الاعتماد يُطبَّق الفرق على الكمية الحالية، فلا تضيع المبيعات التي تحدث أثناء العد. الأصناف الفارغة لا تتغير.</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <thead className="bg-beige/60"><tr><th className="p-2 text-start">المنتج</th><th className="p-2 text-start">المسجّل عند البدء</th><th className="p-2 text-start">المعدود فعلاً</th></tr></thead>
                <tbody>{items.map((i) => { const v = byVariant.get(i.variant_id); return (
                  <tr key={i.id} className="border-t border-gold/10"><td className="p-2">{v?.products.name ?? "—"} {v?.label && <span className="opacity-60">({v.label})</span>}</td>
                    <td className="p-2">{i.expected_on_hand}</td><td className="p-2"><CountInput itemId={i.id} counted={i.counted} expected={i.expected_on_hand} /></td></tr>); })}
                </tbody>
              </table>
            </div>
            {canManage && <StocktakeActions id={openTake.id} counted={countedN} />}
          </>
        ) : canManage ? (
          <><p className="text-sm opacity-80">ابدأ جرداً لمقارنة الكميات الفعلية في المحل بالمسجلة، وتسوية الفروقات (تُسجَّل كحركات «جرد»).</p><StartStocktake /></>
        ) : <p className="text-sm opacity-70">لا يوجد جرد مفتوح.</p>}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-bold">الكميات الحالية</h2>
          <form className="flex gap-2 text-sm">
            <input name="q" defaultValue={q} placeholder="ابحث باسم المنتج" className="rounded-lg border border-gold/30 px-3 py-1.5" />
            <label className="flex items-center gap-1"><input type="checkbox" name="low" value="1" defaultChecked={onlyLow} />المنخفض فقط</label>
            <button className="rounded-lg border border-gold/30 bg-white px-3 py-1.5">عرض</button>
          </form>
        </div>
        <p className="text-xs opacity-70">«بيع في المحل» يخصم من المتاح فقط ولا يمس الكميات المحجوزة لطلبات الموقع. لتعديل الكمية يدوياً افتح صفحة المنتج.</p>
        <div className="overflow-x-auto rounded-2xl border border-gold/20 bg-white">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="bg-beige/60"><tr><th className="p-2 text-start">المنتج</th><th className="p-2">الكمية</th><th className="p-2">محجوز</th><th className="p-2">متاح</th>{canManage && <th className="p-2 text-start">بيع في المحل</th>}</tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className="border-t border-gold/10">
                <td className="p-2"><Link href={`/admin/products/${r.products.id}`} className="hover:text-gold-dark">{r.products.name}</Link>{r.label && <span className="opacity-60"> ({r.label})</span>}
                  {r.products.status !== "active" && <span className="ms-1 text-xs opacity-60">[مسودة]</span>}</td>
                <td className="p-2 text-center">{r.on_hand}</td><td className="p-2 text-center">{r.reserved}</td>
                <td className={`p-2 text-center font-medium ${r.available <= 0 ? "text-red-700" : r.available <= r.products.low_stock_threshold ? "text-amber-700" : ""}`}>{r.available}</td>
                {canManage && <td className="p-2"><SaleForm variantId={r.id} available={r.available} /></td>}
              </tr>))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">آخر حركات المخزون</h2>
        <ul className="divide-y divide-gold/10 rounded-2xl border border-gold/20 bg-white text-sm">
          {(movements ?? []).map((m) => {
            const pv = m.product_variants as unknown as { name: string; products: { name: string } } | null;
            return (
              <li key={m.id} className="flex flex-wrap justify-between gap-2 p-2">
                <span>{pv?.products.name} — {KIND[m.kind] ?? m.kind}{m.note ? ` (${m.note})` : ""}</span>
                <span className="opacity-70">{m.on_hand_delta ? `${m.on_hand_delta > 0 ? "+" : ""}${m.on_hand_delta}` : m.reserved_delta ? `حجز ${m.reserved_delta > 0 ? "+" : ""}${m.reserved_delta}` : ""} · الكمية بعدها {m.on_hand_after} · {dt(m.created_at)}</span>
              </li>);
          })}
        </ul>
      </section>
    </div>
  );
}
