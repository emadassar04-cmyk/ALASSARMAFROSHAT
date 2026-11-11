import Link from "next/link";
import { Suspense } from "react";
import { Gift, MapPin, MessageCircle, Ruler, Truck } from "lucide-react";
import { Logo } from "@/components/store/Logo";
import { SearchBox } from "@/components/store/SearchBox";
import { HeaderCounters } from "@/components/store/HeaderCounters";
import { MobileMenu } from "@/components/store/MobileMenu";
import { WhatsAppFloat } from "@/components/store/WhatsAppFloat";
import { SourceTracker } from "@/components/store/SourceTracker";
import { Toaster } from "@/components/store/Toaster";
import { QuickViewHost } from "@/components/store/QuickView";
import { ChatWidget } from "@/components/store/ChatWidget";
import { chatEnabled } from "@/lib/ai/providers";
import { Analytics } from "@/components/store/Analytics";
import { getBranches, getCampaign, getCategories, getPolicies, getStoreSettings } from "@/lib/catalog";
import { whatsappLink } from "@/lib/format";
import { POLICY_PATHS } from "@/lib/site";
import { displayPhone, telHref } from "@/lib/maps";

async function topCategories() {
  return (await getCategories()).filter((c) => !c.parent_id);
}

// شريط الأقسام (للشاشات الكبيرة): في المنتصف بخط هادئ وخط سفلي ينمو عند المرور، ويمرر أفقياً عند الحاجة
const navLink = "relative block py-3.5 transition-colors after:absolute after:inset-x-0 after:bottom-2 after:h-px after:origin-center after:scale-x-0 after:bg-gold after:transition-transform after:duration-300 hover:text-charcoal hover:after:scale-x-100";
async function CategoryNav() {
  const [categories, campaign] = await Promise.all([topCategories(), getCampaign()]);
  return (
    <ul className="no-scrollbar flex items-center justify-center gap-8 overflow-x-auto whitespace-nowrap text-[0.875rem] text-muted-ink xl:gap-10">
      <li><Link href="/products" className={`${navLink} font-medium text-charcoal`}>كل المنتجات</Link></li>
      {categories.map((c) => (
        <li key={c.id}>
          <Link href={`/category/${encodeURIComponent(c.slug)}`} className={navLink}>{c.name}</Link>
        </li>
      ))}
      {campaign.current && (
        <li>
          <Link href="/campaign" className={`${navLink} flex items-center gap-1.5 text-gold-ink`}>
            <Gift aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />تسوّق واربح
          </Link>
        </li>
      )}
      <li>
        <Link href="/special-order" className={`${navLink} flex items-center gap-1.5 text-gold-ink`}>
          <Ruler aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />حسب المقاس
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
    <ul className="space-y-3">
      {categories.map((c) => (
        <li key={c.id}><Link href={`/category/${encodeURIComponent(c.slug)}`} className="transition-colors hover:text-ivory">{c.name}</Link></li>
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
    <ul className="space-y-3">
      {links.map((l) => <li key={l.href}><Link href={l.href} className="transition-colors hover:text-ivory">{l.title}</Link></li>)}
      <li><Link href="/branches" className="transition-colors hover:text-ivory">فروعنا</Link></li>
      <li><Link href="/campaign" className="transition-colors hover:text-ivory">تسوّق واربح</Link></li>
      <li><Link href="/special-order" className="transition-colors hover:text-ivory">طلب حسب المقاس</Link></li>
      <li><Link href="/track" className="transition-colors hover:text-ivory">طلباتي</Link></li>
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
        <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-white/15 px-4 py-2.5 text-ivory transition-colors hover:border-gold-light">
          <MessageCircle aria-hidden="true" strokeWidth={1.5} className="h-5 w-5 text-gold-light" />
          تواصل عبر WhatsApp
        </a>
      )}
      {branches.length > 0 && (
        <ul className="space-y-3">
          {branches.map((b) => (
            <li key={b.id} className="leading-6">
              <Link href="/branches" className="font-medium text-ivory hover:text-gold-light">{b.name}{b.is_main ? " (الرئيسي)" : ""}</Link>
              {(b.city || b.address) && <span className="block">{[b.city, b.address].filter(Boolean).join(" – ")}</span>}
              {b.phone && <a href={telHref(b.phone)} dir="ltr" className="tabular-nums hover:text-ivory">{displayPhone(b.phone)}</a>}
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

// مساعد العصار: يظهر فقط إذا ضُبط مفتاح مزود واحد على الأقل في Vercel
async function FloatingChat() {
  if (!chatEnabled()) return null;
  const s = await getStoreSettings();
  return <ChatWidget whatsapp={s.whatsapp_number} />;
}

export default function StoreLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:right-2 focus:z-[80] focus:rounded-md focus:bg-white focus:p-3">تخطَّ إلى المحتوى</a>

      {/* شريط خدمات رفيع: حقائق فعلية فقط */}
      <div className="bg-charcoal text-[0.75rem] text-on-dark-muted">
        <div className="shell flex h-9 items-center justify-between gap-4">
          <p className="flex items-center gap-2 truncate">
            <Truck aria-hidden="true" strokeWidth={1.5} className="h-3.5 w-3.5 shrink-0 text-gold-light" />
            <span className="truncate">توصيل داخل قطاع غزة<span className="max-sm:hidden"> · تفصيل الستائر والموكيت حسب المقاس</span></span>
          </p>
          <ul className="flex shrink-0 items-center gap-5">
            <li><Link href="/branches" className="flex items-center gap-1.5 transition-colors hover:text-ivory"><MapPin aria-hidden="true" strokeWidth={1.5} className="h-3.5 w-3.5" />فروعنا</Link></li>
            <li className="max-sm:hidden"><Link href="/track" className="transition-colors hover:text-ivory">طلباتي</Link></li>
          </ul>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-border/80 bg-ivory/90 backdrop-blur-xl supports-[backdrop-filter]:bg-ivory/75">
        <div className="shell flex h-[4.5rem] items-center gap-3 sm:h-20 lg:gap-10">
          <Suspense fallback={<span className="h-11 w-11 lg:hidden" />}><MobileMenuLoader /></Suspense>
          <Link href="/" aria-label="مفروشات العصار — الصفحة الرئيسية" className="shrink-0"><Logo /></Link>
          <div className="hidden flex-1 md:block md:max-w-lg md:ms-auto lg:mx-auto"><SearchBox /></div>
          <div className="ms-auto md:ms-0"><HeaderCounters /></div>
        </div>
        <nav aria-label="التصنيفات" className="hidden border-t border-border/70 lg:block">
          <div className="shell">
            <Suspense fallback={<div className="h-[3.1rem]" />}><CategoryNav /></Suspense>
          </div>
        </nav>
      </header>
      {/* بحث الجوال: خارج الشريط اللاصق حتى يبقى الرأس مضغوطاً أثناء التمرير */}
      <div className="shell border-b border-border bg-ivory py-3 md:hidden"><SearchBox /></div>

      <main id="main" className="flex-1 pb-20">{children}</main>

      <footer className="bg-charcoal text-[0.9rem] text-on-dark-muted">
        {/* خاتمة تحريرية */}
        <div className="shell grid items-end gap-8 border-b border-white/10 py-16 md:grid-cols-[1.4fr_1fr] md:py-20">
          <div>
            <p className="kicker text-gold-light">مفروشات العصار</p>
            <p className="mt-5 max-w-2xl text-[clamp(1.6rem,1.2rem+1.6vw,2.6rem)] font-light leading-[1.35] text-ivory">
              تفاصيل هادئة، وخامات مختارة، وبيت يشبهك.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 md:justify-end">
            <Link href="/products" className="btn btn-gold">تسوّق المجموعة</Link>
            <Link href="/special-order" className="btn btn-ghost-light"><Ruler aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />حسب المقاس</Link>
          </div>
        </div>
        <div className="shell grid grid-cols-2 gap-x-6 gap-y-12 py-14 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
          <div className="col-span-2 space-y-5 lg:col-span-1">
            <Logo tone="light" />
            <p className="max-w-xs leading-7">
              مفروشات منزلية متكاملة: سجاد وموكيت، ستائر، مراتب، بطانيات ولحف، شراشف ومخدات، مع تفصيل حسب المقاس.
            </p>
          </div>
          <div>
            <h2 className="mb-5 text-[0.75rem] font-medium tracking-[0.12em] text-gold-light">الأقسام</h2>
            <Suspense fallback={null}><FooterCategories /></Suspense>
          </div>
          <div>
            <h2 className="mb-5 text-[0.75rem] font-medium tracking-[0.12em] text-gold-light">معلومات</h2>
            <Suspense fallback={null}><PolicyLinks /></Suspense>
          </div>
          <div className="col-span-2 lg:col-span-1">
            <h2 className="mb-5 text-[0.75rem] font-medium tracking-[0.12em] text-gold-light">تواصل معنا</h2>
            <Suspense fallback={null}><FooterContact /></Suspense>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="shell flex flex-wrap items-center justify-between gap-3 py-6 text-xs">
            <p>© مفروشات العصار. جميع الحقوق محفوظة.</p>
            <ul className="flex gap-6">
              <li><Link href="/products" className="hover:text-ivory">كل المنتجات</Link></li>
              <li><Link href="/wishlist" className="hover:text-ivory">المفضلة</Link></li>
              <li><Link href="/compare" className="hover:text-ivory">المقارنة</Link></li>
              <li><Link href="/cart" className="hover:text-ivory">السلة</Link></li>
            </ul>
          </div>
        </div>
      </footer>

      <Suspense fallback={null}><FloatingWhatsApp /></Suspense>
      <Suspense fallback={null}><FloatingChat /></Suspense>
      <Toaster />
      <QuickViewHost />
      <SourceTracker />
      <Suspense fallback={null}><Analytics /></Suspense>
    </>
  );
}
