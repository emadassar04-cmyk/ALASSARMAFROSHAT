"use client";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useStore } from "@/lib/store/local-store";
import { useProducts } from "@/lib/store/use-catalog";
import { ProductGrid } from "@/components/store/ProductCard";

export function SavedList() {
  const { wishlist } = useStore();
  const products = useProducts(wishlist.map((p) => p.slug));
  if (!wishlist.length) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cream text-gold-ink"><Heart aria-hidden="true" strokeWidth={1.4} className="h-7 w-7" /></span>
        <p className="mt-5 font-display text-xl">لم تضف أي منتج إلى المفضلة بعد</p>
        <p className="mt-2 text-sm text-muted-ink">اضغط على أيقونة القلب في أي منتج لحفظه والعودة إليه لاحقاً.</p>
        <Link href="/products" className="btn btn-primary mt-6">تصفح المنتجات</Link>
      </div>
    );
  }
  if (!products) return <div className="skeleton h-40 rounded-[var(--radius-card)]" aria-busy="true" />;
  return <ProductGrid products={products} />;
}
