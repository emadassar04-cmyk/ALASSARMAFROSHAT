"use client";
import { useState } from "react";
import { compare, useStore, wishlist, type SavedProduct, MAX_COMPARE } from "@/lib/store/local-store";

// أزرار المفضلة والمقارنة (فوق رابط البطاقة، لذا z-10)
export function SaveButtons({ product, name, compact = false }: { product: SavedProduct; name: string; compact?: boolean }) {
  const s = useStore();
  const [msg, setMsg] = useState<string | null>(null);
  const inWish = s.wishlist.some((p) => p.id === product.id);
  const inCompare = s.compare.some((p) => p.id === product.id);

  const base = "relative z-10 inline-flex items-center justify-center rounded-full border bg-white/90 backdrop-blur transition";
  const size = compact ? "h-8 w-8" : "h-10 gap-1.5 px-3 text-sm";
  return (
    <div className={`flex ${compact ? "flex-col" : "flex-row flex-wrap"} gap-1.5`}>
      <button
        type="button"
        onClick={() => wishlist.toggle(product)}
        aria-pressed={inWish}
        aria-label={inWish ? `إزالة ${name} من المفضلة` : `إضافة ${name} إلى المفضلة`}
        className={`${base} ${size} ${inWish ? "border-gold text-gold-dark" : "border-gold/30 text-stone-500 hover:text-gold-dark"}`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill={inWish ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
        </svg>
        {!compact && <span>{inWish ? "في المفضلة" : "المفضلة"}</span>}
      </button>
      <button
        type="button"
        onClick={() => {
          const ok = compare.toggle(product);
          setMsg(ok ? null : `يمكن مقارنة ${MAX_COMPARE} منتجات كحد أقصى`);
        }}
        aria-pressed={inCompare}
        aria-label={inCompare ? `إزالة ${name} من المقارنة` : `إضافة ${name} إلى المقارنة`}
        className={`${base} ${size} ${inCompare ? "border-gold text-gold-dark" : "border-gold/30 text-stone-500 hover:text-gold-dark"}`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M8 4v16M16 4v16M4 8h8M12 16h8" />
        </svg>
        {!compact && <span>{inCompare ? "في المقارنة" : "قارن"}</span>}
      </button>
      {msg && <span role="status" className="relative z-10 rounded bg-white px-2 py-1 text-xs text-red-700 shadow">{msg}</span>}
    </div>
  );
}
