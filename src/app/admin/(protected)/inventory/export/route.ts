import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, can } from "@/lib/staff";
import { getDict } from "@/lib/admin/i18n";
import { csvResponse } from "@/lib/admin/csv";

// تقرير الجرد: الكميات الحالية لكل صنف (القراءة محكومة بسياسات RLS للموظفين)
export async function GET() {
  const staff = await requireStaff();
  if (!can(staff, "inventory.manage") && !can(staff, "finance.read")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const t = getDict(staff.locale);
  const supabase = await createClient();
  const { data, error } = await supabase.from("product_variants")
    .select("name, sku, color, size, is_active, products!inner(name, status, availability_mode, low_stock_threshold), inventory(on_hand, reserved)")
    .eq("products.availability_mode", "stock").neq("products.status", "archived").order("created_at").limit(5000);
  if (error) return NextResponse.json({ error: "failed" }, { status: 500 });
  type V = { name: string; sku: string | null; color: string | null; size: string | null; is_active: boolean;
    products: { name: string; status: string; low_stock_threshold: number }; inventory: { on_hand: number; reserved: number }[] };
  const rows = (data ?? []) as unknown as V[];
  return csvResponse(`alassar-inventory-${new Date().toISOString().slice(0, 10)}`,
    [t.inv.product, t.invoice.variant, "SKU", t.inv.onHand, t.inv.reserved, t.inv.available, t.products.lowStock, t.products.status],
    rows.map((v) => {
      const on = v.inventory.reduce((a, i) => a + i.on_hand, 0), res = v.inventory.reduce((a, i) => a + i.reserved, 0);
      return [v.products.name, [v.name !== "افتراضي" ? v.name : null, v.color, v.size].filter(Boolean).join(" · "), v.sku ?? "", on, res, on - res,
        on - res <= v.products.low_stock_threshold ? t.common.yes : t.common.no, t.products.statuses[v.products.status] ?? v.products.status];
    }));
}
