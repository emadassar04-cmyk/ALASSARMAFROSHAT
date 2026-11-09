"use client";
import Link from "next/link";
import { ShoppingBag, Trash2 } from "lucide-react";
import { cart, MAX_QTY, useStore } from "@/lib/store/local-store";
import { useCartLines } from "@/lib/store/use-catalog";
import { isPurchasable } from "@/lib/catalog-types";
import { formatPrice, whatsappLink } from "@/lib/format";
import { AvailabilityBadge } from "@/components/store/AvailabilityBadge";
import { ProductImage } from "@/components/store/ProductImage";
import { WhatsAppIcon } from "@/components/store/WhatsAppIcon";

export function CartView({ whatsapp }: { whatsapp: string | null }) {
  const { cart: items } = useStore();
  const { lines, error } = useCartLines(items.map((i) => i.variantId));

  if (!items.length) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cream text-gold-ink"><ShoppingBag aria-hidden="true" strokeWidth={1.4} className="h-7 w-7" /></span>
        <p className="mt-5 font-display text-xl">سلتك فارغة.</p>
        <p className="mt-2 text-sm text-muted-ink">تصفّح الأقسام وأضف ما يعجبك، وستبقى السلة محفوظة على هذا الجهاز.</p>
        <Link href="/products" className="btn btn-primary mt-6">ابدأ التسوق</Link>
      </div>
    );
  }
  if (error) return <p role="alert" className="rounded-[var(--radius-control)] border border-danger/30 bg-danger/5 p-4 text-danger">تعذر تحميل السلة. تحقق من الاتصال وأعد المحاولة.</p>;
  if (!lines) return <div className="skeleton h-40 rounded-[var(--radius-card)]" aria-busy="true" aria-label="جارٍ تحميل السلة" />;

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
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:gap-12">
      <ul className="divide-y divide-border border-y border-border">
        {rows.map(({ item, line }) => (
          <li key={item.variantId} className="flex gap-4 py-5">
            {line ? (
              <>
                <Link href={`/product/${encodeURIComponent(line.product.slug)}`} className="shrink-0">
                  <ProductImage src={line.product.image?.url} alt={line.product.name} sizes="112px" className="h-32 w-24 rounded-[var(--radius-control)] sm:h-36 sm:w-28" />
                </Link>
                <div className="flex flex-1 flex-col gap-1.5">
                  <Link href={`/product/${encodeURIComponent(line.product.slug)}`} className="font-medium text-charcoal hover:underline">{line.product.name}</Link>
                  <span className="text-xs text-muted-ink">{[line.variant_name !== "افتراضي" ? line.variant_name : null, line.color, line.size].filter(Boolean).join(" · ")}</span>
                  {item.notes && <span className="text-xs text-muted-ink">ملاحظة: {item.notes}</span>}
                  <div className="flex flex-wrap items-center gap-2">
                    <AvailabilityBadge value={line.availability} />
                    {line.price !== null && <span className="text-sm tabular-nums text-muted-ink">{formatPrice(line.price)} للقطعة</span>}
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                    <label className="flex items-center gap-2 text-sm">
                      الكمية
                      <input type="number" min={1} max={MAX_QTY} value={item.qty} inputMode="numeric"
                        onChange={(e) => cart.setQty(item.variantId, Number(e.target.value))}
                        className="field !min-h-9 w-16 !px-2 !py-1 text-center tabular-nums" />
                    </label>
                    <button type="button" onClick={() => cart.remove(item.variantId)} className="inline-flex items-center gap-1.5 text-sm text-muted-ink transition-colors hover:text-danger">
                      <Trash2 aria-hidden="true" strokeWidth={1.6} className="h-4 w-4" />حذف
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-between text-sm">
                <span className="text-muted-ink">منتج لم يعد متاحاً في المتجر</span>
                <button type="button" onClick={() => cart.remove(item.variantId)} className="text-danger hover:underline">حذف</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <aside className="panel h-fit space-y-4 p-6 lg:sticky lg:top-28">
        <h2 className="font-sans text-base font-semibold">ملخص السلة</h2>
        <dl className="space-y-2.5 text-sm">
          <div className="flex justify-between"><dt className="text-muted-ink">المنتجات</dt><dd className="font-semibold tabular-nums">{formatPrice(subtotal)}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted-ink">التوصيل والخصومات</dt><dd className="text-muted-ink">تُحسب عند إتمام الطلب</dd></div>
        </dl>
        {hasProblems && <p className="rounded-[var(--radius-control)] bg-warning/10 p-2.5 text-xs text-warning">بعض المنتجات غير متوفرة ولن تُحتسب.</p>}
        <Link href="/checkout" aria-disabled={!valid.length}
          className={`btn btn-primary w-full ${!valid.length ? "pointer-events-none opacity-50" : ""}`}>
          إتمام الطلب
        </Link>
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp w-full">
            <WhatsAppIcon className="h-5 w-5" /> أو أرسل السلة عبر WhatsApp
          </a>
        )}
        <p className="text-xs leading-5 text-muted-ink">السلة محفوظة على هذا الجهاز، ويمكنك العودة إليها لاحقاً.</p>
      </aside>
    </div>
  );
}
