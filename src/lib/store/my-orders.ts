"use client";
// طلبات هذا الجهاز (رقم الطلب + رمز التتبع) حتى يعود الزبون إليها دون حساب
const KEY = "alassar-my-orders";
export type MyOrder = { number: string; token: string; at: string };

export function saveMyOrder(o: MyOrder) {
  try {
    const list: MyOrder[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    localStorage.setItem(KEY, JSON.stringify([o, ...list.filter((x) => x.number !== o.number)].slice(0, 20)));
  } catch { /* تجاهل */ }
}
export function readMyOrders(): MyOrder[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}

// مصدر الزيارة (Instagram/Facebook/WhatsApp/Google/...) لتتبع مصدر الطلب
const SRC = "alassar-source";
export function rememberSource() {
  try {
    if (sessionStorage.getItem(SRC)) return;
    const params = new URLSearchParams(location.search);
    const utm = params.get("utm_source");
    let src = utm ?? "";
    if (!src && document.referrer) {
      const host = new URL(document.referrer).hostname;
      if (host !== location.hostname) {
        src = /instagram/.test(host) ? "instagram" : /facebook|fb\./.test(host) ? "facebook"
          : /whatsapp|wa\.me/.test(host) ? "whatsapp" : /google\./.test(host) ? "google" : host;
      }
    }
    sessionStorage.setItem(SRC, (src || "direct").slice(0, 50));
  } catch { /* تجاهل */ }
}
export function readSource(): string | undefined {
  try { return sessionStorage.getItem(SRC) ?? undefined; } catch { return undefined; }
}
