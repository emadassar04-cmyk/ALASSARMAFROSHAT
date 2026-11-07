"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { ProductDetail } from "@/lib/catalog-types";
import { isPurchasable } from "@/lib/catalog-types";
import { cart, MAX_QTY } from "@/lib/store/local-store";
import { formatPrice, whatsappLink } from "@/lib/format";
import { AvailabilityBadge } from "@/components/store/AvailabilityBadge";
import { Price } from "@/components/store/Price";
import { SaveButtons } from "@/components/store/SaveButtons";
import { WhatsAppIcon } from "@/components/store/WhatsAppFloat";

export function BuyBox({ product, whatsapp, url }: { product: ProductDetail; whatsapp: string | null; url: string }) {
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [added, setAdded] = useState(false);
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Price price={variant?.price ?? product.price} compareAt={product.compare_at_price}
          requiresMeasurement={product.requires_measurement} className="text-2xl" />
        <AvailabilityBadge value={availability} />
      </div>

      {product.variants.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">اختر الخيار</legend>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((v) => (
              <label key={v.id} className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${v.id === variantId ? "border-gold bg-beige" : "border-gold/30"} ${!isPurchasable(v.availability) ? "opacity-50" : ""}`}>
                <input type="radio" name="variant" value={v.id} checked={v.id === variantId} onChange={() => { setVariantId(v.id); setAdded(false); }} className="sr-only" />
                {variantLabel(v)}{v.price !== null && !product.requires_measurement ? ` — ${formatPrice(v.price)}` : ""}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {product.requires_measurement ? (
        <div className="space-y-3 rounded-2xl bg-beige p-4 text-sm">
          <p>هذا المنتج يُفصَّل حسب المقاس، ويُحدَّد سعره النهائي بعد معرفة المقاسات والمواصفات.</p>
          <Link href={`/special-order?product=${encodeURIComponent(product.slug)}`}
            className="block rounded-lg bg-gold px-4 py-3 text-center font-medium text-white hover:bg-gold-dark">أرسل المقاسات واطلب عرض سعر</Link>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label htmlFor="qty" className="text-sm">الكمية</label>
            <div className="flex items-center rounded-lg border border-gold/30">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-10 w-10" aria-label="إنقاص الكمية">−</button>
              <input id="qty" type="number" min={1} max={MAX_QTY} value={qty} inputMode="numeric"
                onChange={(e) => setQty(Math.max(1, Math.min(MAX_QTY, Number(e.target.value) || 1)))}
                className="h-10 w-14 border-x border-gold/30 text-center" />
              <button type="button" onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))} className="h-10 w-10" aria-label="زيادة الكمية">+</button>
            </div>
          </div>
          <label className="block space-y-1 text-sm">
            <span>ملاحظات على المنتج (اختياري)</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 300))} placeholder="مثال: اللون الأفتح إن وجد"
              className="w-full rounded-lg border border-gold/30 px-3 py-2" />
          </label>
          <button type="button" disabled={!canBuy}
            onClick={() => { cart.add(variantId, qty, notes.trim() || undefined); setAdded(true); }}
            className="w-full rounded-lg bg-gold px-4 py-3 font-medium text-white hover:bg-gold-dark disabled:cursor-not-allowed disabled:opacity-50">
            {canBuy ? "أضف إلى السلة" : "غير متوفر حالياً"}
          </button>
          {added && (
            <p role="status" className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              تمت الإضافة إلى السلة <Link href="/cart" className="font-medium underline">عرض السلة</Link>
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[#25D366] px-4 text-sm font-medium text-white">
            <WhatsAppIcon className="h-5 w-5" />{product.requires_measurement ? "اسأل عبر WhatsApp" : "تفاوض على السعر"}
          </a>
        )}
        <SaveButtons product={{ id: product.id, slug: product.slug }} name={product.name} />
      </div>
    </div>
  );
}
