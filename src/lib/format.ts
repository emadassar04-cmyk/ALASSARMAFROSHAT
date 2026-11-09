import { internationalPhone } from "./phone";

const ils = new Intl.NumberFormat("ar", {
  style: "currency",
  currency: "ILS",
  numberingSystem: "latn",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const ils2 = new Intl.NumberFormat("ar", {
  style: "currency", currency: "ILS", numberingSystem: "latn", minimumFractionDigits: 2, maximumFractionDigits: 2,
});

// أرقام صحيحة بلا كسور (450 ₪)، وغير الصحيحة بمنزلتين دائماً (4,210.50 ₪)
export function formatPrice(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  return Number.isInteger(n) ? ils.format(n) : ils2.format(n);
}

// رابط WhatsApp بنص مسبق. يقبل الرقم المحلي (0599…) أو الدولي ويحوّله للصيغة الدولية
export function whatsappLink(number: string | null | undefined, text: string): string | null {
  const digits = internationalPhone(number);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
