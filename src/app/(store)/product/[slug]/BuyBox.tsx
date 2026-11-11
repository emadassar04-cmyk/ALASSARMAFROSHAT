"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, Minus, Plus, Ruler } from "lucide-react";
import type { ProductDetail } from "@/lib/catalog-types";
import { isPurchasable } from "@/lib/catalog-types";
import { cart, MAX_QTY } from "@/lib/store/local-store";
import { trackEvent } from "@/lib/analytics";
import { formatPrice, whatsappLink } from "@/lib/format";
import { AvailabilityBadge } from "@/components/store/AvailabilityBadge";
import { Price } from "@/components/store/Price";
import { SaveButtons } from "@/components/store/SaveButtons";
import { WhatsAppIcon } from "@/components/store/WhatsAppIcon";

export function BuyBox({ product, whatsapp, url }: { product: ProductDetail; whatsapp: string | null; url: string }) {
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [added, setAdded] = useState(false);
  const [showBar, setShowBar] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const variant = useMemo(() => product.variants.find((v) => v.id === variantId), [product.variants, variantId]);
  const availability = variant?.availability ?? product.availability;
  const canBuy = !!variant && !product.requires_measurement && isPurchasable(availability) && variant.price !== null;

  // اسم الخيار + خصائصه دون تكرار (مثلاً اسم "رمادي" ولونه "رمادي")
  const variantLabel = (v: ProductDetail["variants"][number]) =>
    [...new Set([v.name !== "افتراضي" ? v.name : null, v.color, v.size, v.material].filter(Boolean))].join(" · ") || "الخيار الأساسي";

  const waText = product.requires_measurement
    ? `مرحباً، أريد طلب «${product.name}» حسب المقاس.\nالمقاسات: \nالمواصفات: \nالرابط: ${url}`
    : `مرحباً، أستفسر عن «${product.name}»${variant ? ` (${variantLabel(variant)})` : ""} بسعر ${formatPrice(variant?.price ?? product.price)}.\nهل يمكن التفاوض على السعر؟\nالرابط: ${url}`;
  const wa = whatsappLink(whatsapp, waText);

  // حدث "مشاهدة منتج" مرة واحدة لكل منتج
  useEffect(() => {
    trackEvent("view_item", { value: product.price, items: [{ id: product.id, name: product.name, price: product.price }] });
  }, [product.id, product.name, product.price]);

  // شريط الشراء السفلي على الجوال: يظهر فقط بعد تجاوز زر الإضافة الرئيسي للأعلى
  // (مستمع تمرير خفيف بدل IntersectionObserver لأن القفز المباشر للأعلى لا يطلق تغيّر تقاطع)
  useEffect(() => {
    const el = buttonRef.current;
    if (!el || !canBuy) return;
    let frame = 0;
    const check = () => { frame = 0; setShowBar(el.getBoundingClientRect().bottom < 0); };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(check); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(frame); };
  }, [canBuy]);
  const barVisible = showBar && canBuy;
  useEffect(() => {
    document.body.classList.toggle("has-buybar", barVisible);
    return () => document.body.classList.remove("has-buybar");
  }, [barVisible]);

  function addToCart() {
    cart.add(variantId, qty, notes.trim() || undefined);
    setAdded(true);
    const price = variant?.price ?? null;
    trackEvent("add_to_cart", { value: price !== null ? price * qty : null, items: [{ id: product.id, name: product.name, price, quantity: qty }] });
  }

  const stepBtn = "flex h-full w-12 items-center justify-center text-charcoal transition-colors hover:bg-surface-soft disabled:opacity-40";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-y border-border py-5">
        <Price price={variant?.price ?? product.price} compareAt={product.compare_at_price}
          requiresMeasurement={product.requires_measurement} size="lg" />
        <AvailabilityBadge value={availability} />
      </div>

      {product.variants.length > 1 && (
        <fieldset>
          <legend className="mb-3 text-sm font-medium text-charcoal">اختر الخيار</legend>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((v) => (
              <label key={v.id}
                className={`cursor-pointer rounded-full border px-5 py-2.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold ${v.id === variantId ? "border-charcoal bg-white text-charcoal" : "border-border bg-white text-muted-ink hover:border-border-strong"} ${!isPurchasable(v.availability) ? "border-dashed bg-cream" : ""}`}>
                <input type="radio" name="variant" value={v.id} checked={v.id === variantId} onChange={() => { setVariantId(v.id); setAdded(false); }} className="sr-only" />
                {variantLabel(v)}{v.price !== null && !product.requires_measurement ? ` — ${formatPrice(v.price)}` : ""}
                {!isPurchasable(v.availability) && <span className="ms-1 text-xs">(غير متوفر)</span>}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {product.requires_measurement ? (
        <div className="space-y-4 rounded-[var(--radius-card)] border border-border bg-champagne p-6 text-sm leading-7">
          <p className="flex gap-3">
            <Ruler aria-hidden="true" strokeWidth={1.5} className="mt-1 h-5 w-5 shrink-0 text-gold-ink" />
            هذا المنتج يُفصَّل حسب المقاس، ويُحدَّد سعره النهائي بعد معرفة المقاسات والمواصفات.
          </p>
          <Link href={`/special-order?product=${encodeURIComponent(product.name)}`} className="btn btn-primary w-full">أرسل المقاسات واطلب عرض سعر</Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label htmlFor="qty" className="text-sm font-medium">الكمية</label>
            <div className="flex h-12 items-stretch overflow-hidden rounded-full border border-border bg-white">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} className={stepBtn} aria-label="إنقاص الكمية">
                <Minus aria-hidden="true" strokeWidth={1.6} className="h-4 w-4" />
              </button>
              <input id="qty" type="number" min={1} max={MAX_QTY} value={qty} inputMode="numeric"
                onChange={(e) => setQty(Math.max(1, Math.min(MAX_QTY, Number(e.target.value) || 1)))}
                className="w-12 bg-transparent text-center tabular-nums [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              <button type="button" onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))} disabled={qty >= MAX_QTY} className={stepBtn} aria-label="زيادة الكمية">
                <Plus aria-hidden="true" strokeWidth={1.6} className="h-4 w-4" />
              </button>
            </div>
          </div>
          <label className="block space-y-2 text-sm">
            <span className="font-medium">ملاحظات على المنتج <span className="font-normal text-muted-ink">(اختياري)</span></span>
            <input value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 300))} placeholder="مثال: اللون الأفتح إن وجد" className="field" />
          </label>
          <button ref={buttonRef} type="button" disabled={!canBuy} onClick={addToCart} className="btn btn-primary h-14 w-full text-base">
            {canBuy ? "أضف إلى السلة" : "غير متوفر حالياً"}
          </button>
          {added && (
            <p role="status" className="flex animate-fade-up items-center justify-between gap-3 rounded-[var(--radius-control)] border border-success/25 bg-success/8 px-4 py-3 text-sm text-success">
              <span className="flex items-center gap-2"><Check aria-hidden="true" strokeWidth={2} className="h-4 w-4" />تمت الإضافة إلى السلة</span>
              <Link href="/cart" className="font-medium text-charcoal underline underline-offset-4">عرض السلة</Link>
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-5">
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp">
            <WhatsAppIcon className="h-5 w-5" />{product.requires_measurement ? "اسأل عبر WhatsApp" : "تفاوض على السعر"}
          </a>
        )}
        <SaveButtons product={{ id: product.id, slug: product.slug }} name={product.name} />
      </div>

      {/* شريط الشراء السفلي (جوال فقط) */}
      {canBuy && (
        <div aria-hidden={!barVisible} inert={!barVisible}
          className={`fixed inset-x-0 bottom-0 z-40 border-t border-border bg-ivory/95 px-4 py-3 shadow-lift backdrop-blur-xl transition-transform duration-300 md:hidden ${barVisible ? "translate-y-0" : "translate-y-full"}`}>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-muted-ink">{product.name}</p>
              <p className="font-semibold tabular-nums">{formatPrice((variant?.price ?? 0) * qty)}</p>
            </div>
            <button type="button" onClick={addToCart} className="btn btn-primary shrink-0">إضافة للسلة</button>
          </div>
        </div>
      )}
    </div>
  );
}
