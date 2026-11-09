// توحيد رقم الجوال (مطابق لـ private.canonical_phone في قاعدة البيانات):
// 0599123456 / +970599123456 / 00972 59-912-3456 / ٠٥٩٩١٢٣٤٥٦ ← 0599123456
// رقم لا يطابق صيغة جوال مدعومة ← null (لا تخمين)
export function canonicalPhone(input: string | null | undefined): string | null {
  let d = String(input ?? "")
    .replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)))
    .replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
    .replace(/\D/g, "")
    .replace(/^00/, "");
  if (/^(970|972)5\d{8}$/.test(d)) d = `0${d.slice(3)}`;
  else if (/^5\d{8}$/.test(d)) d = `0${d}`;
  return /^05\d{8}$/.test(d) ? d : null;
}

// للروابط الدولية (WhatsApp): 059/056 فلسطينية ← 970، وباقي 05 ← 972
export function internationalPhone(input: string | null | undefined): string | null {
  const raw = String(input ?? "").replace(/\D/g, "").replace(/^00/, "");
  if (/^(970|972)\d{9}$/.test(raw)) return raw;
  const local = canonicalPhone(input);
  if (!local) return raw || null;
  return /^05[69]/.test(local) ? `970${local.slice(1)}` : `972${local.slice(1)}`;
}

// 0599 123 456 (للعرض)
export function formatPhone(input: string | null | undefined): string {
  const p = canonicalPhone(input);
  return p ? `${p.slice(0, 4)} ${p.slice(4, 7)} ${p.slice(7)}` : String(input ?? "");
}

// إخفاء جزئي: 059****456
export function maskPhone(input: string | null | undefined): string {
  const p = canonicalPhone(input) ?? String(input ?? "");
  return p.length >= 7 ? `${p.slice(0, 3)}****${p.slice(-3)}` : p;
}
