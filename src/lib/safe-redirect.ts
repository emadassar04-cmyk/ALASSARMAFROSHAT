// يمنع إعادة التوجيه المفتوح (open redirect): نقبل مسارات داخلية فقط
export function safeNextPath(next: string | null | undefined, fallback = "/admin"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
