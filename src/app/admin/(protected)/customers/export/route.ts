import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { getDict } from "@/lib/admin/i18n";
import { csvResponse } from "@/lib/admin/csv";

// تصدير العملاء (حتى 2000 صفحة × 100). الصلاحية (orders.read) داخل admin_customers
export async function GET() {
  const staff = await requireStaff();
  const t = getDict(staff.locale);
  const supabase = await createClient();
  type Row = { name: string; phone: string; tier: string; marketing_consent: boolean; created_at: string; orders_count: number; delivered_count: number;
    store_count: number; online_spent: number; store_spent: number; total_spent: number; last_purchase_at: string | null };
  const rows: Row[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.rpc("admin_customers", { p: { sort: "spent", page, page_size: 100 } });
    if (error || !data) return NextResponse.json({ error: "forbidden_or_invalid" }, { status: 403 });
    const d = data as { total: number; rows: Row[] };
    rows.push(...d.rows);
    if (rows.length >= d.total || d.rows.length === 0) break;
  }
  const day = (s: string | null) => (s ? new Date(s).toLocaleDateString("sv", { timeZone: "Asia/Gaza" }) : "");
  const tier = (k: string) => t.customers.tiers[k as keyof typeof t.customers.tiers] ?? k;
  return csvResponse(`alassar-customers-${new Date().toISOString().slice(0, 10)}`,
    [t.customers.name, t.customers.phone, t.customers.tier, t.customers.consent, t.customers.joined, t.customers.orders, t.customers.delivered,
     t.customers.store, t.customers.online, t.customers.store, t.customers.spent, t.customers.lastPurchase],
    rows.map((c) => [c.name, c.phone, tier(c.tier), c.marketing_consent ? t.common.yes : t.common.no, day(c.created_at), c.orders_count, c.delivered_count,
      c.store_count, c.online_spent, c.store_spent, c.total_spent, day(c.last_purchase_at)]));
}
