"use client";
import Link from "next/link";
import { cart, MAX_QTY, useStore } from "@/lib/store/local-store";
import { useCartLines } from "@/lib/store/use-catalog";
import { isPurchasable } from "@/lib/catalog-types";
import { formatPrice, whatsappLink } from "@/lib/format";
import { AvailabilityBadge } from "@/components/store/AvailabilityBadge";
import { ProductImage } from "@/components/store/ProductImage";
import { WhatsAppIcon } from "@/components/store/WhatsAppFloat";

export function CartView({ whatsapp }: { whatsapp: string | null }) {
  const { cart: items } = useStore();
  const { lines, error } = useCartLines(items.map((i) => i.variantId));

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gold/40 bg-white p-10 text-center">
        <p className="font-medium">سلتك فارغة.</p>
        <Link href="/products" className="mt-4 inline-block rounded-full bg-gold px-6 py-2.5 text-white hover:bg-gold-dark">ابدأ التسوق</Link>
      </div>
    );
  }
  if (error) return <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">تعذر تحميل السلة. تحقق من الاتصال وأعد المحاولة.</p>;
  if (!lines) return <div className="h-40 animate-pulse rounded-2xl bg-white" aria-busy="true" aria-label="جارٍ تحميل السلة" />;

  const byId = new Map(lines.map((l) => [l.variant_id, l]));
  const rows = items.map((i) => ({ item: i, line: byId.get(i.variantId) }));
  const valid = rows.filter((r) => r.line && r.line.price !== null && isPurchasable(r.line.availability));
  const subtotal = valid.reduce((sum, r) => sum + Number(r.line!.price) * r.item.qty, 0);
  const hasProblems = valid.length !== rows.length;

  const waText = ["مرحباً، أود طلب المنتجات التالية:", ...valid.map((r) =>
    `• ${r.line!.product.name}${r.line!.variant_name !== "افتراضي" ? ` (${r.line!.variant_name})` : ""} × ${r.item.qty} = ${formatPrice(Number(r.line!.price) * r.item.qty)}${r.item.notes ? ` — ${r.item.notes}` : ""}`),
    `المجموع قبل التوصيل: ${formatPrice(subtotal)}`].join("\n");
  const wa = whatsappLink(whatsapp, waText);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <ul className="space-y-3">
        {rows.map(({ item, line }) => (
          <li key={item.variantId} className="flex gap-3 rounded-2xl border border-gold/20 bg-white p-3">
            {line ? (
              <>
                <Link href={`/product/${encodeURIComponent(line.product.slug)}`} className="shrink-0">
                  <ProductImage src={line.product.image?.url} alt={line.product.name} sizes="96px" className="h-24 w-24 rounded-xl" />
                </Link>
                <div className="flex flex-1 flex-col gap-1.5">
                  <Link href={`/product/${encodeURIComponent(line.product.slug)}`} className="font-medium hover:underline">{line.product.name}</Link>
                  <span className="text-xs opacity-70">{[line.variant_name !== "افتراضي" ? line.variant_name : null, line.color, line.size].filter(Boolean).join(" · ")}</span>
                  {item.notes && <span className="text-xs opacity-70">ملاحظة: {item.notes}</span>}
                  <div className="flex flex-wrap items-center gap-2">
                    <AvailabilityBadge value={line.availability} />
                    {line.price !== null && <span className="text-sm">{formatPrice(line.price)} للقطعة</span>}
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      الكمية
                      <input type="number" min={1} max={MAX_QTY} value={item.qty} inputMode="numeric"
                        onChange={(e) => cart.setQty(item.variantId, Number(e.target.value))}
                        className="w-16 rounded-lg border border-gold/30 px-2 py-1 text-center" />
                    </label>
                    <button type="button" onClick={() => cart.remove(item.variantId)} className="text-sm text-red-700 hover:underline">حذف</button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-between text-sm">
                <span className="opacity-70">منتج لم يعد متاحاً في المتجر</span>
                <button type="button" onClick={() => cart.remove(item.variantId)} className="text-red-700 hover:underline">حذف</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <aside className="h-fit space-y-3 rounded-2xl border border-gold/20 bg-white p-4">
        <h2 className="font-bold">ملخص السلة</h2>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt>المنتجات</dt><dd>{formatPrice(subtotal)}</dd></div>
          <div className="flex justify-between opacity-70"><dt>التوصيل والخصومات</dt><dd>تُحسب عند إتمام الطلب</dd></div>
        </dl>
        {hasProblems && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">بعض المنتجات غير متوفرة ولن تُحتسب.</p>}
        <Link href="/checkout" aria-disabled={!valid.length}
          className={`block rounded-lg bg-gold px-4 py-3 text-center font-medium text-white hover:bg-gold-dark ${!valid.length ? "pointer-events-none opacity-50" : ""}`}>
          إتمام الطلب
        </Link>
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-3 font-medium text-white">
            <WhatsAppIcon className="h-5 w-5" /> أو أرسل السلة عبر WhatsApp
          </a>
        )}
        <p className="text-xs opacity-60">السلة محفوظة على هذا الجهاز، ويمكنك العودة إليها لاحقاً.</p>
      </aside>
    </div>
  );
}
