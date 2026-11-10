"use client";
import { ShoppingBag } from "lucide-react";
import { cart } from "@/lib/store/local-store";
import { toast } from "@/lib/toast";
import { trackEvent } from "@/lib/analytics";

// إضافة سريعة (للمنتج ذي الخيار الواحد فقط). الأسعار والتوفر يُتحقق منها في السلة من الخادم كالعادة.
// compact: كبسولة صغيرة فوق صورة البطاقة؛ wide: زر كامل العرض (نافذة العرض السريع)
export function QuickAdd({ variantId, productId, name, price, wide = false }: { variantId: string; productId: string; name: string; price: number | null; wide?: boolean }) {
  return (
    <button type="button" aria-label={`إضافة ${name} للسلة`}
      onClick={() => {
        cart.add(variantId, 1);
        toast("أُضيف إلى السلة");
        trackEvent("add_to_cart", { value: price, items: [{ id: productId, name, price, quantity: 1 }] });
      }}
      className={wide
        ? "btn btn-primary w-full"
        : "relative z-10 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-charcoal px-3.5 text-[0.8125rem] font-medium text-ivory shadow-soft transition-[background-color,transform] duration-300 hover:bg-[#36372f] active:scale-95"}>
      <ShoppingBag aria-hidden="true" strokeWidth={1.5} className="h-[1.05rem] w-[1.05rem]" />
      <span className={wide ? "" : "max-sm:sr-only"}>أضف إلى السلة</span>
    </button>
  );
}
