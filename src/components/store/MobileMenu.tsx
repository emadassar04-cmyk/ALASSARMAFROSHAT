"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, GitCompareArrows, Heart, MapPin, Menu, PackageCheck, Ruler, X } from "lucide-react";
import { useStore } from "@/lib/store/local-store";
import { OPEN_MENU_EVENT } from "./MobileTabBar";

type Cat = { slug: string; name: string; product_count: number };

// قائمة الجوال: درج جانبي مبني على <dialog> (حبس التركيز وزر Esc من المتصفح)
export function MobileMenu({ categories }: { categories: Cat[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const s = useStore();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // إغلاق القائمة عند الانتقال لصفحة أخرى
  useEffect(() => { ref.current?.close(); }, [pathname]);

  // فتح القائمة من زر «الأقسام» في شريط التنقل السفلي
  useEffect(() => {
    const open = () => setOpen(true);
    window.addEventListener(OPEN_MENU_EVENT, open);
    return () => window.removeEventListener(OPEN_MENU_EVENT, open);
  }, []);

  const item = "flex items-center justify-between gap-3 border-b border-border py-3.5 text-[0.95rem]";
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="القائمة" aria-haspopup="dialog"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-charcoal hover:bg-cream lg:hidden">
        <Menu aria-hidden="true" strokeWidth={1.6} className="h-6 w-6" />
      </button>
      <dialog ref={ref} aria-label="قائمة المتجر" onClose={() => setOpen(false)}
        onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        className="m-0 ms-0 me-auto h-dvh max-h-dvh w-[min(86vw,22rem)] max-w-none bg-warm-white p-0 text-charcoal backdrop:bg-charcoal/45 open:animate-fade-up">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <span className="font-display text-lg">تسوّق</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق القائمة" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-cream">
              <X aria-hidden="true" strokeWidth={1.6} className="h-5 w-5" />
            </button>
          </div>
          <nav aria-label="أقسام المتجر" className="flex-1 overflow-y-auto px-5 pb-6">
            <ul>
              <li><Link href="/products" className={`${item} font-medium`}>كل المنتجات <ChevronLeft aria-hidden="true" className="h-4 w-4 text-muted" /></Link></li>
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={`/category/${encodeURIComponent(c.slug)}`} className={item}>
                    <span>{c.name}</span><ChevronLeft aria-hidden="true" className="h-4 w-4 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="mt-6 space-y-1 text-[0.95rem]">
              <li><Link href="/branches" className="flex items-center gap-3 py-2.5"><MapPin aria-hidden="true" strokeWidth={1.6} className="h-5 w-5 text-gold-ink" />فروعنا</Link></li>
              <li><Link href="/special-order" className="flex items-center gap-3 py-2.5"><Ruler aria-hidden="true" strokeWidth={1.6} className="h-5 w-5 text-gold-ink" />طلب حسب المقاس</Link></li>
              <li><Link href="/wishlist" className="flex items-center gap-3 py-2.5"><Heart aria-hidden="true" strokeWidth={1.6} className="h-5 w-5 text-gold-ink" />المفضلة{s.wishlist.length > 0 && ` (${s.wishlist.length})`}</Link></li>
              <li><Link href="/compare" className="flex items-center gap-3 py-2.5"><GitCompareArrows aria-hidden="true" strokeWidth={1.6} className="h-5 w-5 text-gold-ink" />المقارنة{s.compare.length > 0 && ` (${s.compare.length})`}</Link></li>
              <li><Link href="/track" className="flex items-center gap-3 py-2.5"><PackageCheck aria-hidden="true" strokeWidth={1.6} className="h-5 w-5 text-gold-ink" />طلباتي</Link></li>
            </ul>
          </nav>
        </div>
      </dialog>
    </>
  );
}
