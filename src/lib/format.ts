const ils = new Intl.NumberFormat("ar", {
  style: "currency",
  currency: "ILS",
  numberingSystem: "latn",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export function formatPrice(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return ils.format(Number(value));
}

// رابط WhatsApp بنص مسبق (الرقم بصيغة دولية بلا رموز)
export function whatsappLink(number: string | null | undefined, text: string): string | null {
  const digits = (number ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
