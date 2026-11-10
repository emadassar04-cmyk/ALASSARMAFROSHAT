"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, X } from "lucide-react";
import { isPurchasable, type ProductCard as Card } from "@/lib/catalog-types";
import { AvailabilityBadge } from "./AvailabilityBadge";
import { Price } from "./Price";
import { ProductImage } from "./ProductImage";
import { QuickAdd } from "./QuickAdd";
import { SaveButtons } from "./SaveButtons";

// عرض سريع للمنتج: مضيف واحد في تخطيط المتجر (<QuickViewHost />) يستقبل بيانات البطاقة نفسها
// (لا طلبات إضافية ولا بيانات غير موجودة في البطاقة)، ويعرضها في نافذة <dialog> أصلية:
// تُغلق بـ Esc أو بالنقر خارجها، وتحبس التركيز داخلها، وتعيده للزر بعد الإغلاق.
const EVENT = "alassar:quick-view";

export function QuickViewButton({ product }: { product: Card }) {
  return (
    <button type="button" aria-label={`عرض سريع: ${product.name}`} aria-haspopup="dialog"
      onClick={(e) => window.dispatchEvent(new CustomEvent(EVENT, { detail: { product, from: e.currentTarget } }))}
      className="relative z-10 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-ivory/95 px-3.5 text-[0.8125rem] font-medium text-charcoal shadow-soft backdrop-blur transition-colors hover:bg-white">
      <Eye aria-hidden="true" strokeWidth={1.5} className="h-[1.05rem] w-[1.05rem]" />
      <span className="max-sm:sr-only">عرض سريع</span>
    </button>
  );
}

export function QuickViewHost() {
  const ref = useRef<HTMLDialogElement>(null);
  const from = useRef<HTMLElement | null>(null);
  const [p, setP] = useState<Card | null>(null);

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ product: Card; from: HTMLElement }>).detail;
      from.current = d.from;
      setP(d.product);
      requestAnimationFrame(() => ref.current?.showModal());
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);

  const close = () => ref.current?.close();
  const href = p ? `/product/${encodeURIComponent(p.slug)}` : "#";
  const canAdd = !!p?.quick_variant_id && p.price !== null && isPurchasable(p.availability);

  return (
    <dialog ref={ref} aria-label={p ? `عرض سريع: ${p.name}` : "عرض سريع"}
      onClose={() => from.current?.focus()}
      onClick={(e) => { if (e.target === ref.current) close(); }}
      className="quick-view m-auto w-[min(56rem,calc(100vw-2rem))] max-h-[calc(100svh-2rem)] overflow-auto rounded-[14px] bg-white p-0 text-ink shadow-lift">
      {p && (
        <div className="grid md:grid-cols-[1.05fr_1fr]">
          <ProductImage src={p.image?.url} alt={p.image?.alt ?? p.name} sizes="(min-width: 768px) 460px, 100vw" className="aspect-[4/5] w-full max-md:aspect-[4/3]" />
          <div className="flex flex-col gap-5 p-6 sm:p-9">
            <div className="flex items-start justify-between gap-4">
              {p.category ? <Link href={`/category/${encodeURIComponent(p.category.slug)}`} onClick={close} className="kicker hover:text-charcoal">{p.category.name}</Link> : <span />}
              <button type="button" onClick={close} aria-label="إغلاق" className="-m-2 inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-ink transition-colors hover:bg-surface-soft hover:text-charcoal">
                <X aria-hidden="true" strokeWidth={1.5} className="h-5 w-5" />
              </button>
            </div>
            <h2 className="text-[1.6rem] font-normal leading-snug">{p.name}</h2>
            <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-4">
              <Price price={p.price} compareAt={p.compare_at_price} requiresMeasurement={p.requires_measurement} size="lg" />
              <AvailabilityBadge value={p.availability} />
            </div>
            <div className="mt-auto flex flex-col gap-3">
              {canAdd
                ? <QuickAdd variantId={p.quick_variant_id!} productId={p.id} name={p.name} price={p.price} wide />
                : <Link href={href} onClick={close} className="btn btn-primary w-full">{p.requires_measurement ? "اطلب حسب المقاس" : "اختر المواصفات"}</Link>}
              <div className="flex items-center justify-between gap-3">
                <SaveButtons product={{ id: p.id, slug: p.slug }} name={p.name} compact row />
                <Link href={href} onClick={close} className="link-line">التفاصيل الكاملة<ArrowLeft aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" /></Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
