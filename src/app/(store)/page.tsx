import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, CreditCard, MessageCircle, Ruler, RotateCcw, Store, Truck } from "lucide-react";
import { getBestSellers, getBranches, getCategories, getCheckoutOptions, getPolicies, getStoreSettings, searchProducts } from "@/lib/catalog";
import type { Category, ProductCard as Card } from "@/lib/catalog-types";
import { categoryImage } from "@/lib/category-images";
import { whatsappLink } from "@/lib/format";
import { JsonLd } from "@/components/store/JsonLd";
import { ProductGrid, ProductGridSkeleton } from "@/components/store/ProductCard";
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
        department: branches.map((b) => ({
          "@type": "HomeGoodsStore",
          name: b.name,
          ...(b.phone && { telephone: b.phone }),
          ...(b.map_url && { hasMap: b.map_url }),
          address: { "@type": "PostalAddress", addressCountry: "PS", ...(b.address && { streetAddress: b.address }) },
        })),
      }} />
    </>
  );
}

function SectionHead({ id, kicker, title, href, linkLabel = "عرض الكل" }: { id: string; kicker: string; title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 md:mb-10">
      <div>
        <p className="kicker mb-3">{kicker}</p>
        <h2 id={id} className="text-title text-charcoal">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="group inline-flex items-center gap-2 border-b border-charcoal/25 pb-1 text-sm font-medium text-charcoal transition-colors hover:border-charcoal">
          {linkLabel}
          <ArrowLeft aria-hidden="true" strokeWidth={1.6} className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
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
// تسوّق حسب القسم: شبكة غير متماثلة (القسم الأول بارز)، الأعداد من قاعدة البيانات
// ---------------------------------------------------------------------
function CategoryTile({ c, featured }: { c: Category; featured: boolean }) {
  return (
    <li className={featured ? "col-span-2 md:col-span-3 lg:col-span-1 lg:row-span-2" : ""}>
      <Link href={`/category/${encodeURIComponent(c.slug)}`}
        className={`group relative block h-full overflow-hidden rounded-[var(--radius-card)] bg-cream ${featured ? "aspect-[16/10] md:aspect-[21/9] lg:aspect-auto" : "aspect-[4/5] sm:aspect-[5/4]"}`}>
        <Image src={categoryImage(c.name, c.image_url)} alt="" fill
          sizes={featured ? "(min-width: 1024px) 25vw, 100vw" : "(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"}
          className="object-cover transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:scale-[1.05]" />
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-charcoal/75 via-charcoal/10 to-transparent" />
        <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4 sm:p-5">
          <span>
            <span className={`block font-display text-warm-white ${featured ? "text-2xl" : "text-[1.05rem] sm:text-lg"}`}>{c.name}</span>
            <span className="mt-1 block text-[0.8rem] text-warm-white/85">{countLabel(c.product_count)}</span>
          </span>
          <span aria-hidden="true" className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warm-white/90 text-charcoal transition-transform duration-300 group-hover:-translate-x-1 sm:flex">
            <ArrowLeft strokeWidth={1.6} className="h-4 w-4" />
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
    <ul className="grid grid-flow-dense grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:grid-rows-2">
      {categories.map((c, i) => <CategoryTile key={c.id} c={c} featured={i === 0} />)}
    </ul>
  );
}

// ---------------------------------------------------------------------
// أقسام المنتجات: لا يظهر القسم إن كان فارغاً، ولا يتكرر المنتج بين «مميزة» و«وصل حديثاً»
// ---------------------------------------------------------------------
function ProductsBlock({ id, kicker, title, href, items, tinted = false }: { id: string; kicker: string; title: string; href: string; items: Card[]; tinted?: boolean }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby={id} className={tinted ? "bg-cream/60 py-16 md:py-20" : "py-16 md:py-20"}>
      <div className="shell">
        <SectionHead id={id} kicker={kicker} title={title} href={href} />
        <ProductGrid products={items} />
      </div>
    </section>
  );
}

async function FeaturedAndNew() {
  const [featured, newest] = await Promise.all([
    searchProducts({ featured: true, page_size: 8 }),
    searchProducts({ sort: "newest", page_size: 12 }),
  ]);
  const shown = new Set(featured.items.map((p) => p.id));
  // صف كامل أو صفّان (4 أو 8) حتى لا يبقى منتج وحيد في صف
  const rest = newest.items.filter((p) => !shown.has(p.id));
  const fresh = rest.slice(0, rest.length >= 8 ? 8 : rest.length >= 4 ? 4 : rest.length);
  return (
    <>
      <ProductsBlock id="s-featured" kicker="مختارات" title="منتجات مميزة" href="/products" items={featured.items} />
      <EditorialSection />
      <ProductsBlock id="s-new" kicker="جديد المتجر" title="وصل حديثاً" href="/products?sort=newest" items={fresh} />
    </>
  );
}

// يظهر فقط بعد وجود مبيعات مؤكدة فعلية
async function BestSellers() {
  const items = await getBestSellers(8);
  return <ProductsBlock id="s-best" kicker="اختيار زبائننا" title="الأكثر مبيعاً" href="/products?sort=best_selling" items={items} tinted />;
}

async function EmptyCatalogNotice() {
  const { total } = await searchProducts({ page_size: 1 });
  if (total > 0) return null;
  return (
    <div className="shell py-12">
      <p className="rounded-[var(--radius-card)] border border-dashed border-gold/50 bg-white p-10 text-center text-muted-ink">
        نعمل على إضافة منتجاتنا إلى المتجر. تابعونا قريباً.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------
// قسم تحريري: لا عروض أو نسب خصم مخترعة — يدعو للتسوق والتفصيل حسب المقاس (خدمة قائمة فعلاً)
// ---------------------------------------------------------------------
function EditorialSection() {
  return (
    <section aria-labelledby="s-editorial" className="py-6 md:py-10">
      <div className="shell">
        <div className="grid overflow-hidden rounded-[var(--radius-card)] bg-charcoal lg:grid-cols-[1.25fr_1fr]">
          <div className="relative aspect-[16/10] lg:aspect-auto lg:min-h-[28rem]">
            <Image src={editorialImage} alt="غرفة معيشة بكنبة وسجادة ووسائد وستائر متناسقة" fill sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover" placeholder="blur" />
          </div>
          <div className="flex flex-col justify-center gap-5 p-7 sm:p-10 lg:p-14">
            <p className="kicker text-gold-soft">مجموعة متكاملة</p>
            <h2 id="s-editorial" className="text-title text-warm-white">جدّد منزلك بلمسات من الأناقة</h2>
            <p className="max-w-md leading-8 text-on-dark-muted">
              نسّق السجادة مع الستائر، والوسائد مع الشراشف واللحف، واختر ما يناسب كل غرفة في بيتك من مكان واحد.
              وإن احتجت مقاساً خاصاً للستائر أو الموكيت، نفصّله لك حسب مقاساتك.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link href="/products" className="btn btn-gold">تسوّق كل المنتجات</Link>
              <Link href="/special-order" className="btn border border-white/25 text-warm-white hover:border-gold-soft">
                <Ruler aria-hidden="true" strokeWidth={1.6} className="h-4 w-4" />اطلب حسب المقاس
              </Link>
            </div>
          </div>
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
    <section aria-labelledby="s-about" className="py-16 md:py-24">
      <div className="shell grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="relative order-last aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] lg:order-none lg:aspect-[5/4]">
          <Image src={aboutImage} alt="غرفة جلوس بسجادة كبيرة ومقاعد ووسائد" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" placeholder="blur" />
        </div>
        <div>
          <p className="kicker mb-4">عن مفروشات العصار</p>
          <h2 id="s-about" className="text-title text-charcoal">العناية بتفاصيل منزلك تبدأ من الاختيار الصحيح</h2>
          <p className="mt-5 max-w-xl leading-8 text-muted-ink">
            مفروشات العصار متجر مفروشات منزلية في دير البلح والنصيرات. نجمع لك في مكان واحد
            {categories.length > 0 ? ` ${categories.length} أقسام ` : " "}
            تغطي احتياجات البيت: من السجاد والموكيت والستائر، إلى المراتب والبطانيات واللحف والشراشف والمخدات.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {categories.slice(0, 6).map((c) => (
              <li key={c.id}>
                <Link href={`/category/${encodeURIComponent(c.slug)}`} className="group flex items-center justify-between border-b border-border pb-3 text-[0.95rem] text-charcoal">
                  {c.name}
                  <ArrowLeft aria-hidden="true" strokeWidth={1.6} className="h-4 w-4 text-gold transition-transform group-hover:-translate-x-1" />
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
    <section aria-labelledby="s-trust" className="-mb-20 border-t border-border bg-cream/60 py-14 md:py-16">
      <div className="shell">
        <h2 id="s-trust" className="sr-only">خدماتنا</h2>
        <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {items.slice(0, 4).map(({ icon: Icon, title, text, href, link, external }) => (
            <li key={title} className="flex gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gold/40 text-gold-ink">
                <Icon aria-hidden="true" strokeWidth={1.5} className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-sans text-[0.95rem] font-semibold text-charcoal">{title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-ink">{text}</p>
                {external
                  ? <a href={href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-medium text-gold-ink underline-offset-4 hover:underline">{link}</a>
                  : <Link href={href} className="mt-2 inline-block text-sm font-medium text-gold-ink underline-offset-4 hover:underline">{link}</Link>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Suspense fallback={null}><StoreJsonLd /></Suspense>

      {/* الواجهة: صورة واحدة قوية لغرفة معيشة متكاملة (لا عرض شرائح) */}
      <section aria-labelledby="hero-title" className="relative overflow-hidden bg-cream/70">
        <div className="shell grid items-center gap-8 py-6 md:py-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:py-14">
          <div className="order-last max-w-xl pb-4 lg:order-none lg:pb-0">
            <p className="kicker mb-5">مفروشات العصار · دير البلح – النصيرات</p>
            <h1 id="hero-title" className="text-display text-charcoal">كل تفاصيل بيتك… تبدأ من هنا</h1>
            <p className="mt-5 text-[1.05rem] leading-8 text-muted-ink sm:text-lg">
              اكتشف عالم المفروشات المنزلية، من السجاد والستائر إلى المراتب واللحف وكل ما يمنح منزلك الراحة والأناقة.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/products" className="btn btn-primary min-w-36">تسوّق الآن</Link>
              <a href="#categories" className="btn btn-outline">اكتشف منتجاتنا</a>
            </div>
            <ul className="mt-10 grid gap-x-6 gap-y-3 border-t border-border pt-6 text-sm text-muted-ink sm:grid-cols-3">
              <li className="flex items-center gap-2"><Truck aria-hidden="true" strokeWidth={1.5} className="h-[1.1rem] w-[1.1rem] text-gold-ink" />توصيل داخل قطاع غزة</li>
              <li className="flex items-center gap-2"><Ruler aria-hidden="true" strokeWidth={1.5} className="h-[1.1rem] w-[1.1rem] text-gold-ink" />تفصيل حسب المقاس</li>
              <li className="flex items-center gap-2"><Store aria-hidden="true" strokeWidth={1.5} className="h-[1.1rem] w-[1.1rem] text-gold-ink" />دير البلح والنصيرات</li>
            </ul>
          </div>
          <div className="relative -mx-4 aspect-[16/11] overflow-hidden sm:mx-0 sm:aspect-[16/10] sm:rounded-[var(--radius-card)] lg:aspect-[11/12]">
            <Image src={heroImage} alt="غرفة معيشة دافئة بكنبة ووسائد وسجادة وستائر خفيفة"
              fill preload fetchPriority="high" placeholder="blur" quality={75}
              sizes="(min-width: 1280px) 640px, (min-width: 1024px) 52vw, 100vw" className="object-cover" />
          </div>
        </div>
      </section>

      <section id="categories" aria-labelledby="cats" className="py-16 md:py-20">
        <div className="shell">
          <SectionHead id="cats" kicker="أقسام المتجر" title="تسوّق حسب القسم" href="/products" linkLabel="كل المنتجات" />
          <Suspense fallback={<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton aspect-[4/5] rounded-[var(--radius-card)]" />)}</div>}>
            <CategoriesSection />
          </Suspense>
        </div>
      </section>

      <Suspense fallback={<div className="shell py-16"><ProductGridSkeleton count={4} /></div>}>
        <EmptyCatalogNotice />
        <FeaturedAndNew />
        <BestSellers />
      </Suspense>

      <Suspense fallback={null}><BrandIntro /></Suspense>
      <Suspense fallback={null}><TrustSection /></Suspense>
    </>
  );
}
