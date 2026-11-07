import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/store/Logo";
import { SearchBox } from "@/components/store/SearchBox";
import { HeaderCounters } from "@/components/store/HeaderCounters";
import { WhatsAppFloat } from "@/components/store/WhatsAppFloat";
import { SourceTracker } from "@/components/store/SourceTracker";
import { getCategories, getStoreSettings } from "@/lib/catalog";

async function CategoryNav() {
  const categories = (await getCategories()).filter((c) => !c.parent_id);
  return (
    <ul className="flex gap-5 overflow-x-auto whitespace-nowrap py-2 text-sm [scrollbar-width:none]">
      <li><Link href="/products" className="hover:text-gold-dark">كل المنتجات</Link></li>
      {categories.map((c) => (
        <li key={c.id}><Link href={`/category/${encodeURIComponent(c.slug)}`} className="hover:text-gold-dark">{c.name}</Link></li>
      ))}
    </ul>
  );
}

async function FloatingWhatsApp() {
  const s = await getStoreSettings();
  return <WhatsAppFloat number={s.whatsapp_number} />;
}

export default function StoreLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-2">تخطَّ إلى المحتوى</a>
      <header className="sticky top-0 z-30 border-b border-gold/20 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 pt-3 md:flex-nowrap">
          <Link href="/" aria-label="الصفحة الرئيسية"><Logo /></Link>
          <div className="order-last w-full md:order-none md:mx-6 md:flex-1"><SearchBox /></div>
          <div className="ms-auto md:ms-0"><HeaderCounters /></div>
        </div>
        <nav aria-label="التصنيفات" className="mx-auto max-w-6xl px-4">
          <Suspense fallback={<div className="h-9" />}><CategoryNav /></Suspense>
        </nav>
      </header>
      <main id="main" className="flex-1">{children}</main>
      <footer className="mt-16 border-t border-gold/20 bg-beige/60">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-2">
          <div className="space-y-2">
            <Logo />
            <p className="opacity-70">مفروشات منزلية فاخرة: سجاد، ستائر، مراتب، بطانيات، شراشف ومخدات.</p>
          </div>
          <div>
            <h2 className="mb-2 font-bold">تسوّق</h2>
            <ul className="space-y-1.5">
              <li><Link href="/products" className="hover:text-gold-dark">كل المنتجات</Link></li>
              <li><Link href="/wishlist" className="hover:text-gold-dark">المفضلة</Link></li>
              <li><Link href="/compare" className="hover:text-gold-dark">المقارنة</Link></li>
              <li><Link href="/cart" className="hover:text-gold-dark">السلة</Link></li>
              <li><Link href="/track" className="hover:text-gold-dark">طلباتي</Link></li>
            </ul>
          </div>
        </div>
        <p className="pb-6 text-center text-xs opacity-60">© مفروشات العصار – دير البلح – النصيرات</p>
      </footer>
      <Suspense fallback={null}><FloatingWhatsApp /></Suspense>
      <SourceTracker />
    </>
  );
}
