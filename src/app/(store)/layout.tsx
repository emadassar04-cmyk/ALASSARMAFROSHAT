import Link from "next/link";
import { Suspense } from "react";
import { MessageCircle, Ruler } from "lucide-react";
import { Logo } from "@/components/store/Logo";
import { SearchBox } from "@/components/store/SearchBox";
import { HeaderCounters } from "@/components/store/HeaderCounters";
import { MobileMenu } from "@/components/store/MobileMenu";
import { WhatsAppFloat } from "@/components/store/WhatsAppFloat";
import { SourceTracker } from "@/components/store/SourceTracker";
import { Toaster } from "@/components/store/Toaster";
import { Analytics } from "@/components/store/Analytics";
import { getBranches, getCategories, getPolicies, getStoreSettings } from "@/lib/catalog";
import { whatsappLink } from "@/lib/format";
import { POLICY_PATHS } from "@/lib/site";

async function topCategories() {
  return (await getCategories()).filter((c) => !c.parent_id);
}

// شريط الأقسام (للشاشات الكبيرة): يمرر أفقياً عند الحاجة ولا يلتصق بالأعلى
async function CategoryNav() {
  const categories = await topCategories();
  return (
    <ul className="no-scrollbar flex items-center gap-7 overflow-x-auto whitespace-nowrap text-[0.9rem]">
      <li><Link href="/products" className="block py-3 font-medium text-charcoal transition-colors hover:text-gold-ink">كل المنتجات</Link></li>
      {categories.map((c) => (
        <li key={c.id}>
          <Link href={`/category/${encodeURIComponent(c.slug)}`} className="block py-3 text-muted-ink transition-colors hover:text-charcoal">{c.name}</Link>
        </li>
      ))}
      <li className="ms-auto">
        <Link href="/special-order" className="flex items-center gap-1.5 py-3 text-gold-ink transition-colors hover:text-charcoal">
          <Ruler aria-hidden="true" strokeWidth={1.6} className="h-4 w-4" />طلب حسب المقاس
        </Link>
      </li>
    </ul>
  );
}

async function MobileMenuLoader() {
  const categories = await topCategories();
  return <MobileMenu categories={categories.map(({ slug, name, product_count }) => ({ slug, name, product_count }))} />;
}

async function FooterCategories() {
  const categories = await topCategories();
  return (
    <ul className="space-y-2.5">
      {categories.map((c) => (
        <li key={c.id}><Link href={`/category/${encodeURIComponent(c.slug)}`} className="transition-colors hover:text-warm-white">{c.name}</Link></li>
      ))}
    </ul>
  );
}

// روابط السياسات: التوصيل دائماً (فيه المناطق والرسوم الفعلية)، والباقي بعد نشره من الإدارة
async function PolicyLinks() {
  const published = await getPolicies();
  const links = [
    { href: POLICY_PATHS.delivery, title: published.find((p) => p.slug === "delivery")?.title ?? "التوصيل والدفع" },
    ...published.filter((p) => p.slug !== "delivery").map((p) => ({ href: POLICY_PATHS[p.slug], title: p.title })),
  ];
  return (
    <ul className="space-y-2.5">
      {links.map((l) => <li key={l.href}><Link href={l.href} className="transition-colors hover:text-warm-white">{l.title}</Link></li>)}
      <li><Link href="/special-order" className="transition-colors hover:text-warm-white">طلب حسب المقاس</Link></li>
      <li><Link href="/track" className="transition-colors hover:text-warm-white">طلباتي</Link></li>
    </ul>
  );
}

// بيانات التواصل من إعدادات المتجر والفروع في قاعدة البيانات فقط
async function FooterContact() {
  const [s, branches] = await Promise.all([getStoreSettings(), getBranches()]);
  const wa = whatsappLink(s.whatsapp_number, "مرحباً، أود الاستفسار عن منتجات مفروشات العصار");
  return (
    <div className="space-y-4">
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-white/15 px-4 py-2.5 text-warm-white transition-colors hover:border-gold-soft">
          <MessageCircle aria-hidden="true" strokeWidth={1.6} className="h-5 w-5 text-gold-soft" />
          تواصل عبر WhatsApp
        </a>
      )}
      {branches.length > 0 && (
        <ul className="space-y-1.5">
          {branches.map((b) => (
            <li key={b.name}>
              {b.name}{b.address ? ` — ${b.address}` : ""}
              {b.phone && <> · <a href={`tel:${b.phone.replace(/[^\d+]/g, "")}`} dir="ltr" className="hover:text-warm-white">{b.phone}</a></>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function FloatingWhatsApp() {
  const s = await getStoreSettings();
  return <WhatsAppFloat number={s.whatsapp_number} />;
}

export default function StoreLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:right-2 focus:z-[80] focus:rounded-md focus:bg-white focus:p-3">تخطَّ إلى المحتوى</a>

      <header className="sticky top-0 z-40 border-b border-border bg-warm-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-warm-white/85">
        <div className="shell flex h-[4.25rem] items-center gap-3 sm:h-[4.75rem] lg:gap-8">
          <Suspense fallback={<span className="h-11 w-11 lg:hidden" />}><MobileMenuLoader /></Suspense>
          <Link href="/" aria-label="مفروشات العصار — الصفحة الرئيسية" className="shrink-0"><Logo /></Link>
          <div className="hidden flex-1 md:block md:max-w-xl md:ms-auto lg:mx-auto"><SearchBox /></div>
          <div className="ms-auto md:ms-0"><HeaderCounters /></div>
        </div>
      </header>
      {/* بحث الجوال: خارج الشريط اللاصق حتى يبقى الرأس مضغوطاً أثناء التمرير */}
      <div className="shell border-b border-border bg-warm-white py-3 md:hidden"><SearchBox /></div>

      <nav aria-label="التصنيفات" className="hidden border-b border-border bg-warm-white lg:block">
        <div className="shell">
          <Suspense fallback={<div className="h-[2.85rem]" />}><CategoryNav /></Suspense>
        </div>
      </nav>

      <main id="main" className="flex-1 pb-20">{children}</main>

      <footer className="bg-charcoal text-[0.9rem] text-on-dark-muted">
        <div className="shell grid grid-cols-2 gap-x-6 gap-y-10 py-14 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
          <div className="col-span-2 space-y-4 lg:col-span-1">
            <Logo tone="light" />
            <p className="max-w-xs leading-7">
              متجر مفروشات منزلية متكامل: سجاد وموكيت، ستائر، مراتب، بطانيات ولحف، شراشف ومخدات، مع تفصيل حسب المقاس.
            </p>
          </div>
          <div>
            <h2 className="mb-4 font-sans text-sm font-semibold text-warm-white">الأقسام</h2>
            <Suspense fallback={null}><FooterCategories /></Suspense>
          </div>
          <div>
            <h2 className="mb-4 font-sans text-sm font-semibold text-warm-white">معلومات</h2>
            <Suspense fallback={null}><PolicyLinks /></Suspense>
          </div>
          <div className="col-span-2 lg:col-span-1">
            <h2 className="mb-4 font-sans text-sm font-semibold text-warm-white">تواصل معنا</h2>
            <Suspense fallback={null}><FooterContact /></Suspense>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="shell flex flex-wrap items-center justify-between gap-3 py-5 text-xs">
            <p>© مفروشات العصار. جميع الحقوق محفوظة.</p>
            <ul className="flex gap-5">
              <li><Link href="/products" className="hover:text-warm-white">كل المنتجات</Link></li>
              <li><Link href="/wishlist" className="hover:text-warm-white">المفضلة</Link></li>
              <li><Link href="/compare" className="hover:text-warm-white">المقارنة</Link></li>
              <li><Link href="/cart" className="hover:text-warm-white">السلة</Link></li>
            </ul>
          </div>
        </div>
      </footer>

      <Suspense fallback={null}><FloatingWhatsApp /></Suspense>
      <Toaster />
      <SourceTracker />
      <Suspense fallback={null}><Analytics /></Suspense>
    </>
  );
}
