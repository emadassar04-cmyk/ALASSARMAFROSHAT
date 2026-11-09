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

// أدوات القياس تُحمَّل بعد تفاعل الصفحة؛ إن وقع الحدث قبل جاهزية أداة ننتظرها قليلاً (حتى 5 ثوانٍ) بدل أن يضيع.
// كل أداة تُنتظر وحدها، وإن لم تكن مفعّلة من الإدارة أصلاً تنتهي المحاولات بصمت.
function whenDefined(key: "gtag" | "fbq", fn: (f: (...args: unknown[]) => void) => void, tries = 0) {
  const f = window[key];
  if (f) {
    try { fn(f); } catch { /* التحليلات لا يجب أن تكسر المتجر أبداً */ }
    return;
  }
  if (tries < 20) window.setTimeout(() => whenDefined(key, fn, tries + 1), 250);
}

export function trackEvent(name: EventName, data: { items?: Item[]; value?: number | null; transaction_id?: string } = {}) {
  if (typeof window === "undefined") return;
  const value = data.value ?? undefined;
  whenDefined("gtag", (gtag) => gtag("event", name, {
    currency: "ILS",
    value,
    transaction_id: data.transaction_id,
    items: data.items?.map((i) => ({ item_id: i.id, item_name: i.name, price: i.price ?? undefined, quantity: i.quantity ?? 1 })),
  }));
  whenDefined("fbq", (fbq) => fbq("track", PIXEL_NAME[name], {
    currency: "ILS",
    value,
    content_type: "product",
    content_ids: data.items?.map((i) => i.id),
    num_items: data.items?.reduce((n, i) => n + (i.quantity ?? 1), 0),
  }, data.transaction_id ? { eventID: data.transaction_id } : undefined));
}

