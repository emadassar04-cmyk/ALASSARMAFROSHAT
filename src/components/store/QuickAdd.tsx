"use client";
import { ShoppingBag } from "lucide-react";
import { cart } from "@/lib/store/local-store";
import { toast } from "@/lib/toast";
import { trackEvent } from "@/lib/analytics";

// إضافة سريعة من البطاقة (للمنتج ذي الخيار الواحد فقط). الأسعار والتوفر يُتحقق منها في السلة من الخادم كالعادة.
export function QuickAdd({ variantId, productId, name, price }: { variantId: string; productId: string; name: string; price: number | null }) {
  return (
    <button type="button" aria-label={`إضافة ${name} للسلة`}
      onClick={() => {
        cart.add(variantId, 1);
        toast("أُضيف إلى السلة");
        trackEvent("add_to_cart", { value: price, items: [{ id: productId, name, price, quantity: 1 }] });
      }}
      className="relative z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-charcoal text-warm-white shadow-lift transition-transform duration-200 hover:scale-105 active:scale-95">
      <ShoppingBag aria-hidden="true" strokeWidth={1.7} className="h-[1.1rem] w-[1.1rem]" />
    </button>
  );
}
