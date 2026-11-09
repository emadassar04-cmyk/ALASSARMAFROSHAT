// CSV آمن: UTF-8 مع BOM (يفتح بالعربية في Excel)، ومنع حقن الصيغ (خلية تبدأ بـ = + - @ تُسبق بعلامة ')
const esc = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};
export function csvResponse(name: string, header: string[], rows: unknown[][]) {
  const body = "﻿" + [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}.csv"`,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex",
    },
  });
}
