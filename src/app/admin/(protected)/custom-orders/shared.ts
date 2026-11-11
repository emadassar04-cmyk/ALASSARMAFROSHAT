// ربط حالات طلبات التفصيل بألوان شارات الحالة الموجودة
export const CO_TONE: Record<string, string> = {
  new: "received", reviewing: "confirmed", awaiting_customer: "awaiting_review", confirmed: "confirmed",
  in_progress: "preparing", ready: "ready_for_pickup", completed: "delivered", cancelled: "cancelled",
};
export type CustomOrderRow = {
  id: string; number: string; product_type: "curtains" | "ceiling" | "mattress" | "other"; customer_name: string; phone: string; area: string;
  status: string; final_price: number | null; created_at: string; updated_at: string; specs: Record<string, unknown>;
};
