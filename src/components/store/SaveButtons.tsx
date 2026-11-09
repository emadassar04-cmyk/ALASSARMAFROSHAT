"use client";
import { useState } from "react";
import { GitCompareArrows, Heart } from "lucide-react";
import { compare, useStore, wishlist, type SavedProduct, MAX_COMPARE } from "@/lib/store/local-store";
import { toast } from "@/lib/toast";

// أزرار المفضلة والمقارنة (فوق رابط البطاقة، لذا z-10)
export function SaveButtons({ product, name, compact = false }: { product: SavedProduct; name: string; compact?: boolean }) {
  const s = useStore();
  const [msg, setMsg] = useState<string | null>(null);
  const inWish = s.wishlist.some((p) => p.id === product.id);
  const inCompare = s.compare.some((p) => p.id === product.id);

  const base = "relative z-10 inline-flex items-center justify-center transition-colors";
  const shape = compact
    ? "h-9 w-9 rounded-full bg-white/90 shadow-soft backdrop-blur hover:bg-white"
    : "h-11 gap-2 rounded-[var(--radius-control)] border px-4 text-sm";
  const state = (on: boolean) => compact
    ? (on ? "text-gold-ink" : "text-charcoal")
    : (on ? "border-gold bg-cream text-charcoal" : "border-border bg-white text-charcoal hover:border-[#ddd2bf]");

  return (
    <div className={`flex ${compact ? "flex-col" : "flex-row flex-wrap"} gap-2`}>
      <button
        type="button"
        onClick={() => {
          wishlist.toggle(product);
          toast(inWish ? "أُزيل من المفضلة" : "أُضيف إلى المفضلة", inWish ? "info" : "success");
        }}
        aria-pressed={inWish}
        aria-label={inWish ? `إزالة ${name} من المفضلة` : `إضافة ${name} إلى المفضلة`}
        className={`${base} ${shape} ${state(inWish)}`}
      >
        <Heart aria-hidden="true" strokeWidth={1.7} className="h-[1.1rem] w-[1.1rem]" fill={inWish ? "currentColor" : "none"} />
        {!compact && <span>{inWish ? "في المفضلة" : "المفضلة"}</span>}
      </button>
      <button
        type="button"
        onClick={() => {
          const ok = compare.toggle(product);
          setMsg(ok ? null : `يمكن مقارنة ${MAX_COMPARE} منتجات كحد أقصى`);
          if (ok) toast(inCompare ? "أُزيل من المقارنة" : "أُضيف إلى المقارنة", inCompare ? "info" : "success");
        }}
        aria-pressed={inCompare}
        aria-label={inCompare ? `إزالة ${name} من المقارنة` : `إضافة ${name} إلى المقارنة`}
        className={`${base} ${shape} ${state(inCompare)}`}
      >
        <GitCompareArrows aria-hidden="true" strokeWidth={1.7} className="h-[1.1rem] w-[1.1rem]" />
        {!compact && <span>{inCompare ? "في المقارنة" : "قارن"}</span>}
      </button>
      {msg && <span role="status" className="relative z-10 rounded-md bg-white px-2 py-1 text-xs text-danger shadow-soft">{msg}</span>}
    </div>
  );
}
