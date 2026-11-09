"use client";
// أحداث التحليلات: تُرسل إلى Google Analytics وMeta Pixel إن كانا مفعّلين من الإدارة، وإلا لا تفعل شيئاً.
// لا تُرسل أي بيانات شخصية (لا اسم ولا هاتف ولا عنوان) — فقط المنتج والمبلغ.

type Item = { id: string; name: string; price?: number | null; quantity?: number };
type EventName = "view_item" | "add_to_cart" | "begin_checkout" | "purchase" | "contact";

const PIXEL_NAME: Record<EventName, string> = {
  view_item: "ViewContent",
  add_to_cart: "AddToCart",
  begin_checkout: "InitiateCheckout",
  purchase: "Purchase",
  contact: "Contact",
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

export function trackEvent(name: EventName, data: { items?: Item[]; value?: number | null; transaction_id?: string } = {}) {
  if (typeof window === "undefined") return;
  const value = data.value ?? undefined;
  try {
    window.gtag?.("event", name, {
      currency: "ILS",
      value,
      transaction_id: data.transaction_id,
      items: data.items?.map((i) => ({ item_id: i.id, item_name: i.name, price: i.price ?? undefined, quantity: i.quantity ?? 1 })),
    });
    window.fbq?.("track", PIXEL_NAME[name], {
      currency: "ILS",
      value,
      content_type: "product",
      content_ids: data.items?.map((i) => i.id),
      num_items: data.items?.reduce((n, i) => n + (i.quantity ?? 1), 0),
    }, data.transaction_id ? { eventID: data.transaction_id } : undefined);
  } catch {
    // التحليلات لا يجب أن تكسر المتجر أبداً
  }
}
