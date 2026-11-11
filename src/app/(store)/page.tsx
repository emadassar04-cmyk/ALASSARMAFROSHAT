import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, CreditCard, Gift, MapPin, MessageCircle, Ruler, RotateCcw, Truck } from "lucide-react";
import { getBestSellers, getBranches, getCampaign, getCategories, getCheckoutOptions, getOffers, getPolicies, getStoreSettings, searchProducts } from "@/lib/catalog";
import type { Category, ProductCard as Card } from "@/lib/catalog-types";
import { categoryImage } from "@/lib/category-images";
import { whatsappLink } from "@/lib/format";
import { JsonLd } from "@/components/store/JsonLd";
import { BranchCards, branchLd } from "@/components/store/Branches";
import { ProductCard, ProductGrid, ProductGridSkeleton } from "@/components/store/ProductCard";
import { Countdown } from "@/components/store/Countdown";
import heroImage from "@/assets/home/hero-living-room.webp";
import editorialImage from "@/assets/home/editorial-living.webp";
import aboutImage from "@/assets/home/about-living.webp";

export const metadata: Metadata = {
  title: { absolute: "مفروشات العصار – سجاد وستائر ومفروشات منزلية في دير البلح والنصيرات" },
  description: "تسوّق المفروشات المنزلية من مفروشات العصار: السجاد والموكيت، الستائر، المراتب، البطانيات واللحف، الشراشف والمخدات، مع التفصيل حسب المقاس والتوصيل داخل قطاع غزة.",
  alternates: { canonical: "/" },
};

// بيانات المحل لمحركات البحث: من إعدادات المتجر والفروع في قاعدة البيانات فقط
async function StoreJsonLd() {
  const [s, branches] = await Promise.all([getStoreSettings(), getBranches()]);
  const phone = s.contact_phone ?? s.whatsapp_number;
  const url = `${s.site_url}/`;
  return (
    <>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "مفروشات العصار",
        url,
        inLanguage: "ar",
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${s.site_url}/search?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "HomeGoodsStore",
        name: s.store_name,
        url,
        ...(phone && { telephone: `+${phone.replace(/\D/g, "")}` }),
        currenciesAccepted: "ILS",
        areaServed: { "@type": "Place", name: "قطاع غزة" },
        department: branches.map(branchLd),
      }} />
    </>
  );
}

// رأس قسم تحريري: سطر ذهبي صغير، عنوان كبير بوزنين (خفيف + كلمة ذهبية بارزة)، ووصف اختياري، ورابط بخط سفلي
function SectionHead({ id, kicker, title, accent, lead, href, linkLabel = "عرض الكل", tone = "light" }: {
  id: string; kicker: string; title: string; accent?: string; lead?: string; href?: string; linkLabel?: string; tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <div className="reveal mb-12 flex flex-wrap items-end justify-between gap-6 md:mb-16">
      <div className="max-w-3xl">
        <p className={`kicker ${dark ? "text-gold-light" : ""}`}>{kicker}</p>
        <h2 id={id} className={`mt-5 text-title font-light ${dark ? "text-ivory" : ""}`}>
          {title}{accent && <>{" "}<span className={`font-medium ${dark ? "text-gold-light" : "text-gold-ink"}`}>{accent}</span></>}
        </h2>
        {lead && <p className={`mt-5 max-w-xl text-[1.02rem] leading-8 ${dark ? "text-on-dark-muted" : "text-muted-ink"}`}>{lead}</p>}
      </div>
      {href && (
        <Link href={href} className={`link-line ${dark ? "text-ivory" : ""}`}>
          {linkLabel}<ArrowLeft aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

function countLabel(n: number) {
  if (n <= 0) return "تصفّح القسم";
  if (n === 1) return "منتج واحد";
  if (n === 2) return "منتجان";
  if (n <= 10) return `${n} منتجات`;
  return `${n} منتجاً`;
}

// ---------------------------------------------------------------------
// الواجهة: صورة سينمائية تملأ الشاشة، عنوان ضخم بوزنين (خفيف + ذهبي بارز)، وفهرس أقسام زجاجي في الأسفل
// ---------------------------------------------------------------------
async function HeroIndex() {
  const categories = (await getCategories()).filter((c) => !c.parent_id).slice(0, 5);
  if (!categories.length) return null;
  return (
    <nav aria-label="أقسام سريعة" className="absolute inset-x-0 bottom-0 hidden border-t border-ivory/15 bg-charcoal/35 backdrop-blur-md md:block">
      <ul className="shell grid" style={{ gridTemplateColumns: `repeat(${categories.length}, minmax(0, 1fr))` }}>
        {categories.map((c, i) => (
          <li key={c.id} className="[&:not(:first-child)]:border-s [&:not(:first-child)]:border-ivory/15">
            <Link href={`/category/${encodeURIComponent(c.slug)}`} className="group flex items-center gap-3 px-5 py-5 text-ivory/80 transition-colors hover:bg-ivory/[0.06] hover:text-ivory">
              <span className="index-num text-gold-light">{String(i + 1).padStart(2, "0")}</span>
              <span className="truncate text-[0.95rem]">{c.name}</span>
              <ArrowLeft aria-hidden="true" strokeWidth={1.4} className="ms-auto h-4 w-4 shrink-0 opacity-0 transition-all duration-300 group-hover:-translate-x-1 group-hover:opacity-100" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-charcoal">
      <div className="relative h-[calc(100svh-7.75rem)] max-h-[960px] min-h-[600px] lg:h-[calc(100svh-10.5rem)]">
        <Image src={heroImage} alt="غرفة معيشة دافئة بكنبة ووسائد وسجادة وستائر خفيفة"
          fill preload fetchPriority="high" placeholder="blur" quality={75}
          sizes="100vw" className="hero-zoom object-cover object-[30%_center]" />
        {/* تعتيم متدرج قوي من جهة النص ومن الأسفل لضمان وضوح الكتابة وإبراز الصورة */}
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-l from-charcoal/95 via-charcoal/60 to-charcoal/10" />
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-charcoal via-charcoal/30 to-transparent" />
        <div className="shell relative flex h-full flex-col justify-end pb-28 sm:pb-20 md:pb-36 lg:justify-center lg:pb-24">
          <div className="max-w-[46rem] text-ivory">
            <p className="hero-rise kicker text-gold-light">مفروشات العصار · دير البلح والنصيرات</p>
            <h1 id="hero-title" className="hero-rise-2 mt-7 text-hero font-light text-ivory">
              كل تفاصيل بيتك{" "}<span className="block font-medium text-gold-light">تبدأ من هنا</span>
            </h1>
            <p className="hero-rise-3 mt-7 max-w-lg text-lead text-ivory/80">
              سجاد وستائر ومراتب ولحف وشراشف مختارة بعناية، تمنح كل غرفة دفئاً وهدوءاً، مع تفصيل ما تحتاجه حسب مقاساتك.
            </p>
            <div className="hero-rise-3 mt-10 flex flex-wrap gap-3">
              <Link href="/products" className="btn btn-gold min-w-44 text-base">تسوّق المجموعة<ArrowLeft aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" /></Link>
              <a href="#categories" className="btn btn-ghost-light">اكتشف الأقسام</a>
            </div>
          </div>
        </div>
        <Suspense fallback={null}><HeroIndex /></Suspense>
      </div>
    </section>
  );
}

// شريط الخدمات أسفل الواجهة (داكن يكمل الواجهة): حقائق فعلية فقط
function ServiceStrip() {
  const items = [
    { icon: Truck, title: "توصيل داخل قطاع غزة", text: "رسوم التوصيل واضحة قبل التأكيد" },
    { icon: Ruler, title: "تفصيل حسب المقاس", text: "للستائر والموكيت حسب مقاساتك" },
    { icon: MapPin, title: "فرعان قريبان منك", text: "دير البلح والنصيرات" },
  ];
  return (
    <div className="bg-[#1a1b19] text-ivory">
      <ul className="shell grid sm:grid-cols-3">
        {items.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-center gap-4 py-6 max-sm:border-b max-sm:border-white/10 max-sm:last:border-0 sm:justify-center sm:px-6 sm:py-8 sm:[&:not(:first-child)]:border-s sm:[&:not(:first-child)]:border-white/10">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-gold/40">
              <Icon aria-hidden="true" strokeWidth={1.25} className="h-6 w-6 text-gold-light" />
            </span>
            <span>
              <span className="block text-[0.98rem] font-medium">{title}</span>
              <span className="block text-[0.8125rem] text-on-dark-muted">{text}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// شريط كلمات متحرك (بحجم هادئ) بأسماء الأقسام (زخرفي: مخفي عن قارئات الشاشة، ويتوقف مع «تقليل الحركة»)
async function CategoryBand() {
  const names = [...(await getCategories()).filter((c) => !c.parent_id).map((c) => c.name), "تفصيل حسب المقاس"];
  const row = (key: string) => (
    <ul key={key} className="flex shrink-0 items-center gap-6 pe-6 md:gap-8 md:pe-8">
      {names.map((n, i) => (
        <li key={n} className="flex items-center gap-6 whitespace-nowrap md:gap-8">
          <span className={i % 2 ? "text-ivory" : "text-gold-light"}>{n}</span>
          <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0 text-gold md:h-3.5 md:w-3.5"><path d="M8 0C8.6 4.6 11.4 7.4 16 8C11.4 8.6 8.6 11.4 8 16C7.4 11.4 4.6 8.6 0 8C4.6 7.4 7.4 4.6 8 0Z" fill="currentColor" /></svg>
        </li>
      ))}
    </ul>
  );
  return (
    <div aria-hidden="true" className="marquee overflow-hidden bg-charcoal py-5 text-[clamp(1.05rem,0.9rem+0.6vw,1.4rem)] font-light leading-none md:py-6">
      <div className="marquee-track flex w-max">{row("a")}{row("b")}</div>
    </div>
  );
}

// ---------------------------------------------------------------------
// تسوّق حسب القسم: تركيب تحريري غير متماثل (قسم رئيسي طويل + قسمان + صف أصغر)، الأعداد من قاعدة البيانات
// ---------------------------------------------------------------------
const TILE_LAYOUT = [
  "col-span-2 aspect-[5/4] md:col-span-7 md:row-span-2 md:aspect-auto",
  "aspect-[4/5] md:col-span-5 md:aspect-auto",
  "aspect-[4/5] md:col-span-5 md:aspect-auto",
];

function CategoryTile({ c, i }: { c: Category; i: number }) {
  const big = i === 0;
  const layout = TILE_LAYOUT[i] ?? "aspect-[4/5] md:col-span-3 md:aspect-auto";
  return (
    <li className={`reveal ${layout}`}>
      <Link href={`/category/${encodeURIComponent(c.slug)}`} className="group relative block h-full overflow-hidden rounded-[var(--radius-card)] bg-surface-soft">
        <Image src={categoryImage(c.name, c.image_url)} alt="" fill
          sizes={big ? "(min-width: 768px) 58vw, 100vw" : i < 3 ? "(min-width: 768px) 42vw, 50vw" : "(min-width: 768px) 25vw, 50vw"}
          className="img-zoom object-cover" />
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-charcoal/85 via-charcoal/25 to-transparent via-45%" />
        <span aria-hidden="true" className="absolute inset-x-5 bottom-0 h-px origin-right scale-x-0 bg-gold-light transition-transform duration-700 ease-[var(--ease-luxe)] group-hover:scale-x-100 sm:inset-x-7" />
        <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 sm:p-7">
          <span>
            <span className="index-num block text-gold-light">{String(i + 1).padStart(2, "0")}</span>
            <span className={`mt-2 block text-ivory ${big ? "text-[clamp(1.9rem,1.3rem+2.2vw,3.2rem)] font-light leading-tight" : "text-[1.2rem] sm:text-[1.5rem] font-light"}`}>{c.name}</span>
            <span className="mt-1 block text-[0.8rem] text-ivory/75">{countLabel(c.product_count)}</span>
          </span>
          <span aria-hidden="true" className={`hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ivory/40 text-ivory transition-all duration-500 group-hover:border-ivory group-hover:bg-ivory group-hover:text-charcoal ${i < 3 ? "sm:flex" : ""}`}>
            <ArrowLeft strokeWidth={1.4} className="h-4 w-4" />
          </span>
        </span>
      </Link>
    </li>
  );
}

async function CategoriesSection() {
  const categories = (await getCategories()).filter((c) => !c.parent_id);
  if (!categories.length) return null;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:auto-rows-[minmax(16rem,auto)] md:grid-cols-12 md:gap-5 lg:auto-rows-[21rem]">
      {categories.map((c, i) => <CategoryTile key={c.id} c={c} i={i} />)}
    </ul>
  );
}

// ---------------------------------------------------------------------
// مختارات: عمود نصي ثابت بجانب شبكة منتجات (تركيب غير متكرر)
// ---------------------------------------------------------------------
function FeaturedBlock({ items }: { items: Card[] }) {
  if (!items.length) return null;
  const shown = items.slice(0, items.length >= 6 ? 6 : items.length >= 3 ? 3 : items.length);
  return (
    <section aria-labelledby="s-featured" className="py-20 md:py-28">
      <div className="shell grid gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,9fr)] lg:gap-16">
        <div className="reveal lg:sticky lg:top-40 lg:self-start">
          <p className="kicker">مختارات العصار</p>
          <h2 id="s-featured" className="mt-5 text-title font-light">قطع مختارة{" "}<span className="font-medium text-gold-ink">لبيت أكثر هدوءاً</span></h2>
          <p className="mt-5 max-w-sm leading-8 text-muted-ink">
            منتجات ننصح بها من أقسام المتجر المختلفة، تتناسق مع بعضها لتمنح كل غرفة طابعاً واحداً.
          </p>
          <Link href="/products" className="link-line mt-8">تسوّق كل المنتجات<ArrowLeft aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" /></Link>
        </div>
        <ProductGrid products={shown} cols="m-rail grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 md:grid-cols-3 lg:gap-x-8" />
      </div>
    </section>
  );
}

// وصل حديثاً: شريط أفقي بتمرير ناعم (إيقاع مختلف عن الشبكة)
function NewArrivals({ items }: { items: Card[] }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="s-new" className="overflow-hidden py-20 md:py-28">
      <div className="shell">
        <SectionHead id="s-new" kicker="جديد المتجر" title="وصل" accent="حديثاً" href="/products?sort=newest" />
      </div>
      <div className="shell">
        <ul className="no-scrollbar -mx-[clamp(1.125rem,0.3rem+3.4vw,3rem)] flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-[clamp(1.125rem,0.3rem+3.4vw,3rem)] px-[clamp(1.125rem,0.3rem+3.4vw,3rem)] pb-4 sm:gap-6 lg:gap-8">
          {items.map((p) => (
            <li key={p.id} className="w-[68vw] shrink-0 snap-start sm:w-[40vw] md:w-[30vw] lg:w-[calc((100%-6rem)/4)] xl:w-[calc((1320px-6rem-6rem)/4)]">
              <ProductCard product={p} sizes="(min-width: 1024px) 300px, (min-width: 640px) 40vw, 68vw" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

async function FeaturedAndNew() {
  const [featured, newest] = await Promise.all([
    searchProducts({ featured: true, page_size: 6 }),
    searchProducts({ sort: "newest", page_size: 14 }),
  ]);
  const shown = new Set(featured.items.map((p) => p.id));
  const fresh = newest.items.filter((p) => !shown.has(p.id)).slice(0, 10);
  return (
    <>
      <FeaturedBlock items={featured.items} />
      <EditorialSection />
      <NewArrivals items={fresh} />
    </>
  );
}

// عروض: منتجات عليها خصم فعلي الآن فقط (لا عروض مخترعة) — قسم داكن: عمود نصي + شبكة تتكيف مع عدد العروض
async function OffersSection() {
  const items = await getOffers(6);
  if (!items.length) return null;
  const shown = items.slice(0, items.length >= 6 ? 6 : items.length >= 3 ? 3 : items.length);
  const cols = shown.length === 1 ? "lg:grid-cols-2" : shown.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3";
  return (
    <section aria-labelledby="s-offers" className="bg-charcoal py-20 md:py-28">
      <div className="shell grid gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,9fr)] lg:gap-16">
        <div className="reveal lg:sticky lg:top-40 lg:self-start">
          <p className="kicker text-gold-light">خصومات حقيقية</p>
          <h2 id="s-offers" className="mt-5 text-title font-light text-ivory">عروض{" "}<span className="font-medium text-gold-light">مختارة</span></h2>
          <p className="mt-5 max-w-sm leading-8 text-on-dark-muted">أسعار مخفّضة فعلياً على منتجات من المتجر، لفترة محدودة. السعر قبل الخصم ظاهر بجانب كل منتج.</p>
          <Link href="/products?sort=price_asc" className="link-line mt-8 text-ivory">كل المنتجات<ArrowLeft aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" /></Link>
        </div>
        <div className={`m-rail grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 md:grid-cols-3 lg:gap-x-8 ${cols}`}>
          {shown.map((p) => <ProductCard key={p.id} product={p} tone="dark" />)}
        </div>
      </div>
    </section>
  );
}

// حملة السحب: تظهر فقط إن وُجدت حملة منشورة حالية/قادمة، أو فائز سابق
async function CampaignSection() {
  const { current, last_winner } = await getCampaign();
  if (!current && !last_winner) return null;
  return (
    <section aria-labelledby="s-campaign" className="py-16 md:py-24">
      <div className="shell">
        <div className="reveal relative overflow-hidden rounded-[var(--radius-card)] bg-[#1a1b19] px-6 py-14 text-ivory sm:px-12 md:py-20">
          <span aria-hidden="true" className="pointer-events-none absolute -end-24 -top-24 h-80 w-80 rounded-full border border-gold/25" />
          <span aria-hidden="true" className="pointer-events-none absolute -end-10 -top-10 h-52 w-52 rounded-full border border-gold/20" />
          <div className="grid items-center gap-10 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <p className="kicker text-gold-light"><Gift aria-hidden="true" strokeWidth={1.4} className="h-4 w-4" />{current ? "حملة هذا الشهر" : "الفائز السابق"}</p>
              <h2 id="s-campaign" className="mt-5 text-title font-light text-ivory">{current?.title ?? last_winner!.title}</h2>
              {current ? (
                <>
                  <p className="mt-5 text-[1.35rem] font-medium text-gold-light">الجائزة: {current.prize}</p>
                  <p className="mt-3 max-w-xl leading-8 text-on-dark-muted">
                    {current.description ?? "اشترِ من متجرنا الإلكتروني أو من أحد فرعينا برقم جوالك، وكل شراء مؤهل يمنحك فرصة في السحب."}
                  </p>
                </>
              ) : (
                <p className="mt-5 text-lg text-on-dark-muted">مبروك لـ <strong className="font-medium text-ivory">{last_winner!.winner}</strong> — الجائزة: {last_winner!.prize}</p>
              )}
              <Link href="/campaign" className="btn btn-gold mt-9">{current ? "التفاصيل والشروط" : "تفاصيل الحملة"}</Link>
            </div>
            {current && (
              <div className="space-y-4">
                <Countdown start={current.start_at} end={current.end_at} tone="light" />
                {current.entries > 0 && <p className="text-sm text-on-dark-muted">{current.entries} مشاركة حتى الآن</p>}
                {last_winner && <p className="text-sm text-on-dark-muted">الفائز السابق: {last_winner.winner}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// الأكثر مبيعاً: يظهر فقط بعد وجود مبيعات مؤكدة فعلية، مع رقم ترتيب تحريري
async function BestSellers() {
  const items = await getBestSellers(8);
  if (!items.length) return null;
  const shown = items.slice(0, items.length >= 8 ? 8 : items.length >= 4 ? 4 : items.length);
  return (
    <section aria-labelledby="s-best" className="py-20 md:py-28">
      <div className="shell">
        <SectionHead id="s-best" kicker="اختيار زبائننا" title="الأكثر" accent="مبيعاً" href="/products?sort=best_selling" />
        <div className="m-rail grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-8">
          {shown.map((p, i) => <ProductCard key={p.id} product={p} rank={i + 1} />)}
        </div>
      </div>
    </section>
  );
}

async function EmptyCatalogNotice() {
  const { total } = await searchProducts({ page_size: 1 });
  if (total > 0) return null;
  return (
    <div className="shell py-16">
      <p className="rounded-[var(--radius-card)] border border-dashed border-gold/50 bg-white p-12 text-center text-muted-ink">
        نعمل على إضافة منتجاتنا إلى المتجر. تابعونا قريباً.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------
// قسم تحريري داكن بعرض الشاشة: صورة تملأ النصف + نص كبير + صورة صغيرة متراكبة (لا عروض أو نسب مخترعة)
// ---------------------------------------------------------------------
function EditorialSection() {
  return (
    <section aria-labelledby="s-editorial" className="grid bg-charcoal text-ivory lg:grid-cols-2">
      <div className="relative min-h-[22rem] sm:min-h-[30rem] lg:min-h-[44rem]">
        <Image src={editorialImage} alt="غرفة معيشة بكنبة وسجادة ووسائد وستائر متناسقة" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" placeholder="blur" />
        <div className="absolute -bottom-12 end-8 hidden w-[34%] overflow-hidden rounded-[var(--radius-card)] border-[6px] border-charcoal shadow-lift sm:block lg:-end-16 lg:bottom-16 lg:w-[38%]">
          <div className="relative aspect-[4/5]">
            <Image src={aboutImage} alt="" fill sizes="(min-width: 1024px) 19vw, 34vw" className="object-cover" placeholder="blur" />
          </div>
        </div>
      </div>
      <div className="reveal flex flex-col justify-center px-[clamp(1.125rem,0.3rem+3.4vw,3rem)] py-20 sm:py-24 lg:px-20 lg:ps-28 xl:px-28 xl:ps-36">
        <p className="kicker text-gold-light">مجموعة متكاملة</p>
        <h2 id="s-editorial" className="mt-5 text-display font-light text-ivory">بيت متناسق،{" "}<span className="block font-medium text-gold-light">غرفة بعد غرفة</span></h2>
        <p className="mt-7 max-w-md text-[1.02rem] leading-8 text-on-dark-muted">
          نسّق السجادة مع الستائر، والوسائد مع الشراشف واللحف، واختر ما يناسب كل غرفة في بيتك من مكان واحد.
          وإن احتجت مقاساً خاصاً للستائر أو الموكيت، نفصّله لك حسب مقاساتك.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/products" className="btn btn-gold">تسوّق المجموعة</Link>
          <Link href="/special-order" className="btn btn-ghost-light">
            <Ruler aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />اطلب حسب المقاس
          </Link>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// تعريف بالمحل: محتوى من بيانات المتجر الفعلية فقط (لا سنوات خبرة أو إنجازات مخترعة)
// ---------------------------------------------------------------------
async function BrandIntro() {
  const categories = (await getCategories()).filter((c) => !c.parent_id);
  return (
    <section aria-labelledby="s-about" className="border-t border-border py-20 md:py-28">
      <div className="shell grid gap-12 lg:grid-cols-12 lg:gap-8">
        <div className="reveal lg:col-span-5">
          <p className="kicker">عن مفروشات العصار</p>
          <h2 id="s-about" className="mt-5 text-display font-light">العناية بتفاصيل منزلك{" "}<span className="font-medium text-gold-ink">تبدأ من الاختيار الصحيح</span></h2>
        </div>
        <div className="reveal lg:col-span-6 lg:col-start-7">
          <p className="text-lead text-muted-ink">
            مفروشات العصار متجر مفروشات منزلية في دير البلح والنصيرات. نجمع لك في مكان واحد
            {categories.length > 0 ? ` ${categories.length} أقسام ` : " "}
            تغطي احتياجات البيت: من السجاد والموكيت والستائر، إلى المراتب والبطانيات واللحف والشراشف والمخدات.
          </p>
          <ul className="mt-10 border-t border-border">
            {categories.slice(0, 7).map((c, i) => (
              <li key={c.id}>
                <Link href={`/category/${encodeURIComponent(c.slug)}`} className="group flex items-center gap-5 border-b border-border py-4 text-charcoal transition-colors hover:text-gold-ink">
                  <span className="index-num w-6">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex-1 text-[1.05rem]">{c.name}</span>
                  <span className="text-[0.8rem] text-muted-ink">{countLabel(c.product_count)}</span>
                  <ArrowLeft aria-hidden="true" strokeWidth={1.4} className="h-4 w-4 text-gold transition-transform duration-300 group-hover:-translate-x-1" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// الخدمة والثقة: من الإعدادات الفعلية فقط (مناطق التوصيل، طرق الدفع المفعلة، WhatsApp، السياسات المنشورة)
// ---------------------------------------------------------------------
async function TrustSection() {
  const [{ zones, methods }, settings, policies] = await Promise.all([getCheckoutOptions(), getStoreSettings(), getPolicies()]);
  const wa = whatsappLink(settings.whatsapp_number, "مرحباً، لدي استفسار عن منتجات مفروشات العصار");
  const returns = policies.find((p) => p.slug === "returns");
  const items = [
    zones.length > 0 && {
      icon: Truck, title: "التوصيل داخل قطاع غزة",
      text: `نوصل إلى ${zones.length === 1 ? "منطقة واحدة" : zones.length === 2 ? "منطقتين" : `${zones.length} مناطق`}، وتظهر رسوم التوصيل قبل تأكيد الطلب.`,
      href: "/policies/delivery", link: "مناطق التوصيل ورسومها",
    },
    methods.length > 0 && {
      icon: CreditCard, title: "طرق الدفع", text: methods.map((m) => m.name_ar).join("، ") + ".", href: "/policies/delivery", link: "التفاصيل",
    },
    {
      icon: Ruler, title: "تفصيل حسب المقاس", text: "أرسل مقاسات الستائر أو الموكيت ونرد عليك بالسعر النهائي.", href: "/special-order", link: "اطلب حسب المقاس",
    },
    wa && { icon: MessageCircle, title: "خدمة العملاء", text: "نجيب على استفساراتك ونؤكد طلبك عبر WhatsApp.", href: wa, link: "راسلنا الآن", external: true },
    returns && { icon: RotateCcw, title: returns.title, text: "اطّلع على شروط الاستبدال والإرجاع قبل الطلب.", href: "/policies/returns", link: "قراءة السياسة" },
  ].filter(Boolean) as { icon: typeof Truck; title: string; text: string; href: string; link: string; external?: boolean }[];

  return (
    <section aria-labelledby="s-trust" className="bg-surface py-16 md:py-20">
      <div className="shell">
        <h2 id="s-trust" className="sr-only">خدماتنا</h2>
        <ul className="m-rail m-rail-wide grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-border bg-border max-md:rounded-none max-md:border-0 max-md:bg-transparent sm:grid-cols-2 lg:grid-cols-4">
          {items.slice(0, 4).map(({ icon: Icon, title, text, href, link, external }) => (
            <li key={title} className="reveal flex flex-col gap-4 bg-surface p-7 max-md:rounded-[var(--radius-card)] max-md:border max-md:border-border max-md:p-6 lg:p-8">
              <Icon aria-hidden="true" strokeWidth={1.25} className="h-7 w-7 text-gold" />
              <h3 className="text-[1rem] font-medium">{title}</h3>
              <p className="text-sm leading-7 text-muted-ink">{text}</p>
              {external
                ? <a href={href} target="_blank" rel="noopener noreferrer" className="link-line mt-auto self-start text-sm">{link}</a>
                : <Link href={href} className="link-line mt-auto self-start text-sm">{link}</Link>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// فروعنا: بطاقات بخرائط Google مباشرة (تحميل كسول عند الاقتراب من القسم)
async function BranchesSection() {
  const branches = await getBranches();
  if (!branches.length) return null;
  return (
    <section aria-labelledby="s-branches" className="bg-champagne py-20 md:py-28">
      <div className="shell">
        <SectionHead id="s-branches" kicker="زورونا" title="فروعنا" accent="قريبة منك" href="/branches" linkLabel="كل التفاصيل والخرائط" />
        <BranchCards branches={branches} />
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Suspense fallback={null}><StoreJsonLd /></Suspense>
      <Hero />
      <ServiceStrip />

      <section id="categories" aria-labelledby="cats" className="pt-20 md:pt-28">
        <div className="shell">
          <SectionHead id="cats" kicker="أقسام المتجر" title="تسوّق حسب" accent="القسم" href="/products" linkLabel="كل المنتجات"
            lead="من السجاد والستائر إلى المراتب واللحف والشراشف: كل ما يحتاجه البيت في مكان واحد." />
          <Suspense fallback={<div className="grid grid-cols-2 gap-4 md:grid-cols-12">{Array.from({ length: 3 }, (_, i) => <div key={i} className={`skeleton aspect-[4/5] rounded-[var(--radius-card)] ${i === 0 ? "col-span-2 md:col-span-7" : "md:col-span-5"}`} />)}</div>}>
            <CategoriesSection />
          </Suspense>
        </div>
      </section>

      <div className="h-20 md:h-28" aria-hidden="true" />
      <Suspense fallback={<div className="h-40 bg-charcoal" />}><CategoryBand /></Suspense>

      <Suspense fallback={<div className="shell py-20"><ProductGridSkeleton count={4} /></div>}>
        <EmptyCatalogNotice />
        <FeaturedAndNew />
      </Suspense>
      <Suspense fallback={null}><OffersSection /></Suspense>
      <Suspense fallback={null}><BestSellers /></Suspense>
      <Suspense fallback={null}><CampaignSection /></Suspense>
      <Suspense fallback={null}><TrustSection /></Suspense>
      <Suspense fallback={null}><BrandIntro /></Suspense>
      <Suspense fallback={null}><BranchesSection /></Suspense>
    </>
  );
}
