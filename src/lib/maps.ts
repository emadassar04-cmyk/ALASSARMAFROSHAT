import type { Branch } from "./catalog-types";

// روابط Google Maps لكل فرع: دبوس دقيق إن توفرت الإحداثيات، وإلا بحث بالعنوان
function query(b: Pick<Branch, "name" | "city" | "address">) {
  return ["مفروشات العصار", b.address, b.city].filter(Boolean).join("، ");
}

// رابط الفتح في تطبيق/موقع Google Maps (الرابط الذي ألصقه المدير له الأولوية)
export function directionsUrl(b: Branch): string {
  if (b.map_url) return b.map_url;
  if (b.lat !== null && b.lng !== null) return `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query(b))}`;
}

// خريطة مضمّنة دون مفتاح API
export function embedUrl(b: Branch): string {
  const q = b.lat !== null && b.lng !== null ? `${b.lat},${b.lng}` : query(b);
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&hl=ar&z=16&output=embed`;
}

export function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

// +970594793301 ← 0594 793 301 (للعرض)
export function displayPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  const local = d.startsWith("970") || d.startsWith("972") ? `0${d.slice(3)}` : d;
  return local.length === 10 ? `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}` : phone;
}

// استخراج الإحداثيات من رابط Google Maps الكامل (الرابط المختصر يُحلّ في الخادم أولاً)
export function coordsFromMapsUrl(url: string): { lat: number; lng: number } | null {
  const tries = [
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,                       // موقع المكان نفسه
    /[?&](?:q|query|ll|destination|daddr)=(-?\d{1,2}\.\d+),\s*\+?(-?\d{1,3}\.\d+)/,
    /\/maps\/(?:search|place|dir)\/(?:[^/]*\/)?(-?\d{1,2}\.\d+),[\s+]*(-?\d{1,3}\.\d+)/, // ‎/maps/search/31.41,+34.34 (الروابط المختصرة من التطبيق)
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,                          // مركز الخريطة
  ];
  const decoded = decodeURIComponent(url);
  for (const re of tries) {
    const m = decoded.match(re);
    if (m) {
      const lat = Number(m[1]), lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
    }
  }
  return null;
}

// روابط Google Maps المقبولة فقط (google.com أو نطاق دولة مثل google.ps / google.co.il)
export const MAPS_HOSTS = /^https:\/\/(maps\.app\.goo\.gl|goo\.gl|(www\.|maps\.)?google\.(com|[a-z]{2}|com\.[a-z]{2}|co\.[a-z]{2}))\//i;
