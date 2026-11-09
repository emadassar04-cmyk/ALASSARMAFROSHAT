"use client";
import Link from "next/link";
import { GitCompareArrows, Heart, ShoppingBag } from "lucide-react";
import { useStore } from "@/lib/store/local-store";

function Count({ n }: { n: number }) {
  if (!n) return null;
  return <span aria-hidden="true" className="absolute -top-0.5 -left-0.5 min-w-[1.15rem] rounded-full bg-gold px-1 text-center text-[0.7rem] font-semibold leading-[1.15rem] text-charcoal">{n}</span>;
}

// أيقونات المفضلة والمقارنة والسلة مع العدادات (من التخزين المحلي)
export function HeaderCounters() {
  const s = useStore();
  const cartCount = s.cart.reduce((n, i) => n + i.qty, 0);
  const icon = "relative inline-flex h-11 w-11 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-cream";
  return (
    <nav aria-label="روابط سريعة" className="flex items-center">
      <Link href="/wishlist" className={`${icon} max-sm:hidden`} aria-label={`المفضلة (${s.wishlist.length})`}>
        <Heart aria-hidden="true" strokeWidth={1.6} className="h-[1.3rem] w-[1.3rem]" />
        <Count n={s.wishlist.length} />
      </Link>
      <Link href="/compare" className={`${icon} max-sm:hidden`} aria-label={`المقارنة (${s.compare.length})`}>
        <GitCompareArrows aria-hidden="true" strokeWidth={1.6} className="h-[1.3rem] w-[1.3rem]" />
        <Count n={s.compare.length} />
      </Link>
      <Link href="/cart" className={icon} aria-label={`السلة (${cartCount})`}>
        <ShoppingBag aria-hidden="true" strokeWidth={1.6} className="h-[1.3rem] w-[1.3rem]" />
        <Count n={cartCount} />
      </Link>
    </nav>
  );
}
