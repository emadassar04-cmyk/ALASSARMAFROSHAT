"use client";
import Link from "next/link";
import { useStore } from "@/lib/store/local-store";
import { useProducts } from "@/lib/store/use-catalog";
import { ProductGrid } from "@/components/store/ProductCard";

export function SavedList() {
  const { wishlist } = useStore();
  const products = useProducts(wishlist.map((p) => p.slug));
  if (!wishlist.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gold/40 bg-white p-10 text-center">
        <p>لم تضف أي منتج إلى المفضلة بعد. اضغط ♡ على أي منتج لحفظه.</p>
        <Link href="/products" className="mt-4 inline-block text-gold-dark underline">تصفح المنتجات</Link>
      </div>
    );
  }
  if (!products) return <div className="h-40 animate-pulse rounded-2xl bg-white" aria-busy="true" />;
  return <ProductGrid products={products} />;
}
