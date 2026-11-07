"use client";
import Link from "next/link";
import { useStore } from "@/lib/store/local-store";

function Badge({ n }: { n: number }) {
  if (!n) return null;
  return <span className="absolute -top-1 -left-1 min-w-5 rounded-full bg-gold px-1 text-center text-xs leading-5 text-white">{n}</span>;
}

export function HeaderCounters() {
  const s = useStore();
  const cartCount = s.cart.reduce((n, i) => n + i.qty, 0);
  const icon = "relative inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-beige";
  return (
    <nav aria-label="روابط سريعة" className="flex items-center gap-1">
      <Link href="/wishlist" className={icon} aria-label={`المفضلة (${s.wishlist.length})`}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
        <Badge n={s.wishlist.length} />
      </Link>
      <Link href="/compare" className={icon} aria-label={`المقارنة (${s.compare.length})`}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M8 4v16M16 4v16M4 8h8M12 16h8" /></svg>
        <Badge n={s.compare.length} />
      </Link>
      <Link href="/cart" className={icon} aria-label={`السلة (${cartCount})`}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 4h2l2.4 11h11L21 7H6" /><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /></svg>
        <Badge n={cartCount} />
      </Link>
    </nav>
  );
}
