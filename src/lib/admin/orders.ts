// فلاتر قائمة الطلبات: من معاملات الرابط إلى معاملات admin_orders (تُستخدم في الصفحة والتصدير)
export const ORDER_STATUSES = ["received", "awaiting_confirmation", "confirmed", "preparing", "ready_for_pickup", "out_for_delivery", "delivered", "cancelled"] as const;
export const PAYMENTS = ["cash_on_delivery", "cash_in_store", "bank_transfer"] as const;
const SORTS = ["created_at", "total", "order_number", "customer_name"];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export type OrderListRow = {
  id: string; order_number: string; customer_name: string; customer_phone: string; status: string; fulfillment: string;
  payment_method: string; payment_status: string; subtotal: number; discount_total: number; delivery_fee: number; total: number;
  created_at: string; reservation_expires_at: string | null; source: string | null; items_count: number; first_item: string | null; lines: number;
};

export function orderFilters(sp: Record<string, string | string[] | undefined>) {
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  return {
    q: s("q").trim().slice(0, 60),
    status: (ORDER_STATUSES as readonly string[]).includes(s("status")) ? s("status") : "",
    payment_method: (PAYMENTS as readonly string[]).includes(s("payment")) ? s("payment") : "",
    from: ISO.test(s("from")) ? s("from") : "",
    to: ISO.test(s("to")) ? s("to") : "",
    sort: SORTS.includes(s("sort")) ? s("sort") : "created_at",
    dir: (s("dir") === "asc" ? "asc" : "desc") as "asc" | "desc",
  };
}

// وصف الخيار (اللون/المقاس…) دون «افتراضي»
export const variantText = (v: Record<string, string> | null) =>
  Object.entries(v ?? {}).filter(([k, x]) => x && !(k === "name" && x === "افتراضي")).map(([, x]) => x).join(" · ");
