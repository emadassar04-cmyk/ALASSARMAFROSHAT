"use client";
export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="rounded-lg border border-gold/40 bg-white px-3 py-2 text-sm hover:bg-beige">طباعة / حفظ PDF</button>;
}
