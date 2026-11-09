import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { getDict } from "@/lib/admin/i18n";
import { orderFilters, type OrderListRow } from "@/lib/admin/orders";
import { csvResponse } from "@/lib/admin/csv";

// تصدير الطلبات بالتصفية الحالية (حتى 5000). الصلاحية تُفحص داخل admin_orders، والتصدير يُسجَّل في سجل النشاط
export async function GET(request: NextRequest) {
  const staff = await requireStaff();
  const t = getDict(staff.locale);
  const flt = orderFilters(Object.fromEntries(request.nextUrl.searchParams));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_orders", { p: { ...flt, export: true, page_size: 5000 } });
  if (error || !data) return NextResponse.json({ error: "forbidden_or_invalid" }, { status: 403 });
  const rows = (data as { rows: OrderListRow[] }).rows;
  const date = new Intl.DateTimeFormat("sv", { timeZone: "Asia/Gaza", dateStyle: "short", timeStyle: "short" });
  return csvResponse(`alassar-orders-${new Date().toISOString().slice(0, 10)}`,
    [t.orders.number, t.orders.date, t.orders.customer, t.customers.phone, t.orders.product, t.common.items, t.orders.status,
     t.orders.fulfillment, t.orders.payment, t.common.status, t.invoice.subtotal, t.invoice.discount, t.invoice.delivery, t.invoice.total],
    rows.map((o) => [o.order_number, date.format(new Date(o.created_at)), o.customer_name, o.customer_phone, o.first_item ?? "", o.items_count,
      t.status[o.status as keyof typeof t.status] ?? o.status, t.fulfillment[o.fulfillment as keyof typeof t.fulfillment] ?? o.fulfillment,
      t.payment[o.payment_method as keyof typeof t.payment] ?? o.payment_method,
      t.paymentStatus[o.payment_status as keyof typeof t.paymentStatus] ?? o.payment_status,
      o.subtotal, o.discount_total, o.delivery_fee, o.total]));
}
