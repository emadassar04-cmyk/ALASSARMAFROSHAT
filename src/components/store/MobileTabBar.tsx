"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, House, LayoutGrid, Ruler, ShoppingBag } from "lucide-react";
import { useStore } from "@/lib/store/local-store";

// صفحات لها شريط سفلي خاص بها (إتمام الطلب، صفحة الطلب، استوديو التفصيل) فلا نزاحمها
const HIDDEN_ON = /^\/(checkout|order|special-order)(\/|$)/;

// حدث يفتح درج الأقسام (MobileMenu) من زر «الأقسام»
export const OPEN_MENU_EVENT = "store:open-menu";

function Badge({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span aria-hidden="true" className="absolute -top-1.5 start-[55%] min-w-[1.1rem] rounded-full bg-gold px-1 text-center text-[0.65rem] font-semibold leading-[1.1rem] text-charcoal tabular-nums">
      {n > 99 ? "99+" : n}
    </span>
  );
}

// شريط تنقل سفلي للهاتف بنمط التطبيقات: أهداف لمس كبيرة (64px) وتمييز واضح للصفحة الحالية
export function MobileTabBar() {
  const pathname = usePathname();
  const s = useStore();
  if (HIDDEN_ON.test(pathname)) return null;

  const cartCount = s.cart.reduce((n, i) => n + i.qty, 0);
  const isCatalog = /^\/(products|category|search|product)(\/|$)/.test(pathname);
  const item = "relative flex flex-1 flex-col items-center justify-center gap-1 text-[0.68rem] transition-colors";
  const tone = (on: boolean) => (on ? "font-medium text-charcoal" : "text-muted-ink");
  const icon = "h-[1.35rem] w-[1.35rem]";

  return (
    <nav aria-label="التنقل السريع"
      className="m-tabbar fixed inset-x-0 bottom-0 z-40 border-t border-border bg-ivory/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-18px_rgb(34_35_33/0.35)] backdrop-blur-xl md:hidden">
      <ul className="flex h-16 items-stretch">
        <li className="flex flex-1">
          <Link href="/" aria-current={pathname === "/" ? "page" : undefined} className={`${item} ${tone(pathname === "/")}`}>
            <House aria-hidden="true" strokeWidth={pathname === "/" ? 1.9 : 1.5} className={icon} />الرئيسية
          </Link>
        </li>
        <li className="flex flex-1">
          <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_MENU_EVENT))} aria-haspopup="dialog"
            className={`${item} ${tone(isCatalog)}`}>
            <LayoutGrid aria-hidden="true" strokeWidth={isCatalog ? 1.9 : 1.5} className={icon} />الأقسام
          </button>
        </li>
        <li className="flex flex-1">
          {/* الزر الأوسط: خدمة التفصيل حسب المقاس (ميزة المحل الأساسية) */}
          <Link href="/special-order" className={`${item} text-gold-ink`}>
            <span className="-mt-6 grid h-12 w-12 place-items-center rounded-full bg-charcoal text-gold-light shadow-lift ring-4 ring-ivory">
              <Ruler aria-hidden="true" strokeWidth={1.6} className="h-5 w-5" />
            </span>
            حسب المقاس
          </Link>
        </li>
        <li className="flex flex-1">
          <Link href="/wishlist" aria-current={pathname === "/wishlist" ? "page" : undefined} aria-label={`المفضلة (${s.wishlist.length})`}
            className={`${item} ${tone(pathname === "/wishlist")}`}>
            <span className="relative"><Heart aria-hidden="true" strokeWidth={pathname === "/wishlist" ? 1.9 : 1.5} className={icon} /><Badge n={s.wishlist.length} /></span>
            <span aria-hidden="true">المفضلة</span>
          </Link>
        </li>
        <li className="flex flex-1">
          <Link href="/cart" aria-current={pathname === "/cart" ? "page" : undefined} aria-label={`السلة (${cartCount})`}
            className={`${item} ${tone(pathname === "/cart")}`}>
            <span className="relative"><ShoppingBag aria-hidden="true" strokeWidth={pathname === "/cart" ? 1.9 : 1.5} className={icon} /><Badge n={cartCount} /></span>
            <span aria-hidden="true">السلة</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
