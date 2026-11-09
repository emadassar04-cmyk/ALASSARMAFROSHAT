"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { cart, useStore } from "@/lib/store/local-store";
import { useCartLines } from "@/lib/store/use-catalog";
import { readSource, saveMyOrder } from "@/lib/store/my-orders";
import type { DeliveryZone, PaymentMethod, PaymentMethodCode, Quote } from "@/lib/catalog-types";
import { formatPrice } from "@/lib/format";
import { placeOrder } from "./actions";

const PROBLEM: Record<string, string> = {
  insufficient_stock: "الكمية غير متوفرة",
  unavailable: "لم يعد متاحاً",
  requires_measurement: "يُطلب حسب المقاس",
  invalid_quantity: "كمية غير صحيحة",
};
const COUPON_REASON: Record<string, string> = {
  not_found_or_inactive: "الكود غير موجود أو منتهي",
  below_min_order: "قيمة الطلب أقل من الحد الأدنى لهذا الكود",
  vip_only: "هذا الكود لعملاء VIP فقط",
  max_uses_reached: "انتهى عدد مرات استخدام الكود",
  customer_limit_reached: "استخدمت هذا الكود من قبل",
};

const field = "w-full rounded-lg border border-gold/30 bg-white px-3 py-2.5 focus:border-gold focus:outline-none aria-[invalid=true]:border-red-500";

export function CheckoutForm({ zones, methods }: { zones: DeliveryZone[]; methods: PaymentMethod[]; whatsapp: string | null }) {
  const router = useRouter();
  const { cart: items } = useStore();
  const { lines } = useCartLines(items.map((i) => i.variantId));
  const [form, setForm] = useState({
    name: "", phone: "", fulfillment: "delivery" as "delivery" | "pickup", zone: "", address: "", notes: "",
    payment: "" as PaymentMethodCode | "", coupon: "", terms: false, marketing: false,
  });
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const allowedMethods = methods.filter((m) =>
    form.fulfillment === "delivery" ? m.code !== "cash_in_store" : m.code !== "cash_on_delivery");
  const payment = allowedMethods.some((m) => m.code === form.payment) ? form.payment : "";
  const orderItems = useMemo(() => items.map((i) => ({ variant_id: i.variantId, quantity: i.qty, notes: i.notes })), [items]);

  // ملخص من الخادم (السعر والخصم والتوصيل) يتحدث عند تغيير السلة أو المنطقة أو الكوبون
  const quoteKey = JSON.stringify([orderItems, form.fulfillment, form.zone, appliedCoupon, appliedCoupon ? form.phone : ""]);
  useEffect(() => {
    if (!orderItems.length) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const { data } = await createClient().rpc("quote_order", { p: {
        items: orderItems, fulfillment: form.fulfillment, delivery_zone_id: form.zone || undefined,
        coupon_code: appliedCoupon || undefined, phone: form.phone || undefined } });
      if (!cancelled) setQuote(data as Quote);
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- quoteKey يجمع كل المدخلات
  }, [quoteKey]);

  // حدث "بدء إتمام الطلب" مرة واحدة عند فتح الصفحة والسلة غير فارغة
  const hasItems = items.length > 0;
  useEffect(() => {
    if (hasItems) trackEvent("begin_checkout", { items: items.map((i) => ({ id: i.variantId, name: "", quantity: i.qty })) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- مرة واحدة عند الفتح
  }, [hasItems]);

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gold/40 bg-white p-10 text-center">
        <p>سلتك فارغة.</p>
        <Link href="/products" className="mt-4 inline-block rounded-full bg-gold px-6 py-2.5 text-white">تصفح المنتجات</Link>
      </div>
    );
  }

  const byVariant = new Map((lines ?? []).map((l) => [l.variant_id, l]));
  const analyticsItems = items.map((i) => {
    const l = byVariant.get(i.variantId);
    return { id: l?.product.id ?? i.variantId, name: l?.product.name ?? "", price: quote?.lines.find((q) => q.variant_id === i.variantId)?.unit_price ?? null, quantity: i.qty };
  });
  const problems = quote?.lines.filter((l) => l.problem) ?? [];
  const canSubmit = !!quote && problems.length === 0 && !pending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!payment) return setError({ message: "اختر طريقة الدفع.", field: "payment_method" });
    startTransition(async () => {
      const res = await placeOrder({
        customer_name: form.name, phone: form.phone, fulfillment: form.fulfillment,
        delivery_zone_id: form.zone || undefined, address: form.address, notes: form.notes,
        payment_method: payment, coupon_code: appliedCoupon || undefined,
        terms_accepted: form.terms, marketing_consent: form.marketing, source: readSource(), items: orderItems,
      });
      if (!res.ok) {
        setError({ message: res.error, field: res.field });
        return;
      }
      saveMyOrder({ number: res.order_number, token: res.tracking_token, at: new Date().toISOString() });
      trackEvent("purchase", { transaction_id: res.order_number, value: quote?.total ?? null, items: analyticsItems });
      cart.clear();
      router.push(`/order/${encodeURIComponent(res.order_number)}?t=${res.tracking_token}&new=1`);
    });
  }

  const invalid = (f: string) => (error?.field === f ? true : undefined);
  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_22rem]" noValidate>
      <div className="space-y-5">
        <fieldset className="space-y-3 rounded-2xl border border-gold/20 bg-white p-5">
          <legend className="px-1 font-bold">بياناتك</legend>
          <label className="block space-y-1 text-sm"><span>الاسم الكامل *</span>
            <input required autoComplete="name" maxLength={100} value={form.name} onChange={(e) => set("name", e.target.value)}
              aria-invalid={invalid("customer_name")} className={field} /></label>
          <label className="block space-y-1 text-sm"><span>رقم الهاتف (WhatsApp) *</span>
            <input required type="tel" inputMode="tel" autoComplete="tel" dir="ltr" maxLength={20} value={form.phone}
              onChange={(e) => set("phone", e.target.value)} placeholder="0599123456" aria-invalid={invalid("phone")} className={`${field} text-right`} /></label>
        </fieldset>

        <fieldset className="space-y-3 rounded-2xl border border-gold/20 bg-white p-5">
          <legend className="px-1 font-bold">طريقة الاستلام</legend>
          <div className="grid grid-cols-2 gap-2">
            {([["delivery", "توصيل للعنوان"], ["pickup", "استلام من المحل"]] as const).map(([v, l]) => (
              <label key={v} className={`cursor-pointer rounded-lg border p-3 text-center text-sm ${form.fulfillment === v ? "border-gold bg-beige" : "border-gold/30"}`}>
                <input type="radio" name="fulfillment" value={v} checked={form.fulfillment === v} onChange={() => set("fulfillment", v)} className="sr-only" />{l}
              </label>
            ))}
          </div>
          {form.fulfillment === "delivery" && (
            zones.length === 0 ? (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">التوصيل غير متاح حالياً. اختر الاستلام من المحل أو تواصل معنا.</p>
            ) : (
              <>
                <label className="block space-y-1 text-sm"><span>المنطقة *</span>
                  <select required value={form.zone} onChange={(e) => set("zone", e.target.value)} aria-invalid={invalid("delivery_zone_id")} className={field}>
                    <option value="">اختر المنطقة</option>
                    {zones.map((z) => <option key={z.id} value={z.id}>{z.name} — {formatPrice(z.fee)}{z.eta_text ? ` (${z.eta_text})` : ""}</option>)}
                  </select></label>
                <label className="block space-y-1 text-sm"><span>العنوان بالتفصيل *</span>
                  <textarea required rows={2} maxLength={500} value={form.address} onChange={(e) => set("address", e.target.value)}
                    placeholder="الحي، الشارع، علامة مميزة" aria-invalid={invalid("address")} className={field} /></label>
              </>
            )
          )}
        </fieldset>

        <fieldset className="space-y-3 rounded-2xl border border-gold/20 bg-white p-5">
          <legend className="px-1 font-bold">طريقة الدفع</legend>
          {allowedMethods.map((m) => (
            <label key={m.code} className={`block cursor-pointer rounded-lg border p-3 text-sm ${payment === m.code ? "border-gold bg-beige" : "border-gold/30"}`}>
              <span className="flex items-center gap-2">
                <input type="radio" name="payment" value={m.code} checked={payment === m.code} onChange={() => set("payment", m.code)} className="accent-[var(--gold)]" />
                <span className="font-medium">{m.name_ar}</span>
              </span>
              {payment === m.code && m.instructions && <span className="mt-1 block opacity-80">{m.instructions}</span>}
            </label>
          ))}
          <p className="text-xs opacity-60">لا يوجد دفع إلكتروني بالبطاقة.</p>
        </fieldset>

        <label className="block space-y-1 text-sm"><span>ملاحظات على الطلب (اختياري)</span>
          <textarea rows={2} maxLength={1000} value={form.notes} onChange={(e) => set("notes", e.target.value)} className={field} /></label>

        <div className="space-y-2 text-sm">
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={form.terms} onChange={(e) => set("terms", e.target.checked)} aria-invalid={invalid("terms_accepted")} className="mt-1 accent-[var(--gold)]" />
            <span>
              أوافق على <Link href="/policies/delivery" target="_blank" className="text-gold-dark underline">سياسة التوصيل</Link>
              {" "}و<Link href="/policies/returns" target="_blank" className="text-gold-dark underline">سياسة الاستبدال والإرجاع</Link>
              {" "}و<Link href="/policies/privacy" target="_blank" className="text-gold-dark underline">سياسة الخصوصية</Link>. *
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={form.marketing} onChange={(e) => set("marketing", e.target.checked)} className="mt-1 accent-[var(--gold)]" />
            <span>أوافق على استلام العروض عبر WhatsApp (اختياري، ويمكن الإلغاء في أي وقت).</span>
          </label>
        </div>
      </div>

      <aside className="h-fit space-y-4 rounded-2xl border border-gold/20 bg-white p-5 lg:sticky lg:top-32">
        <h2 className="font-bold">ملخص الطلب</h2>
        <ul className="space-y-2 text-sm">
          {items.map((i) => {
            const l = byVariant.get(i.variantId);
            const q = quote?.lines.find((x) => x.variant_id === i.variantId);
            return (
              <li key={i.variantId} className="flex justify-between gap-2">
                <span>{l?.product.name ?? "…"} × {i.qty}
                  {q?.problem && <span className="block text-xs text-red-700">{PROBLEM[q.problem]}</span>}</span>
                <span>{q?.line_total != null ? formatPrice(q.line_total) : ""}</span>
              </li>
            );
          })}
        </ul>
        {problems.length > 0 && (
          <p role="alert" className="rounded-lg bg-red-50 p-2 text-xs text-red-800">
            بعض المنتجات تحتاج تعديلاً. <Link href="/cart" className="underline">عدّل السلة</Link>
          </p>
        )}
        <div className="flex gap-2">
          <input value={form.coupon} onChange={(e) => set("coupon", e.target.value.toUpperCase())} placeholder="كود الخصم" maxLength={32}
            aria-label="كود الخصم" aria-invalid={invalid("coupon_code")} className={`${field} py-2 text-sm`} dir="ltr" />
          <button type="button" onClick={() => setAppliedCoupon(form.coupon.trim())} className="rounded-lg border border-gold px-3 text-sm text-gold-dark">تطبيق</button>
        </div>
        {quote?.coupon && (
          <p role="status" className={`text-xs ${quote.coupon.valid ? "text-emerald-700" : "text-red-700"}`}>
            {quote.coupon.valid ? `تم تطبيق ${quote.coupon.code}` : COUPON_REASON[quote.coupon.reason ?? ""] ?? "الكود غير صالح"}
          </p>
        )}
        <dl className="space-y-1 border-t border-gold/20 pt-3 text-sm">
          <div className="flex justify-between"><dt>المنتجات</dt><dd>{quote ? formatPrice(quote.subtotal) : "…"}</dd></div>
          {!!quote?.discount && Number(quote.discount) > 0 && (
            <div className="flex justify-between text-emerald-700"><dt>الخصم</dt><dd>− {formatPrice(quote.discount)}</dd></div>)}
          <div className="flex justify-between"><dt>التوصيل</dt>
            <dd>{form.fulfillment === "pickup" ? "مجاني" : form.zone ? formatPrice(quote?.delivery_fee) : "اختر المنطقة"}</dd></div>
          <div className="flex justify-between border-t border-gold/20 pt-2 text-base font-bold"><dt>الإجمالي</dt><dd>{quote ? formatPrice(quote.total) : "…"}</dd></div>
        </dl>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error.message}</p>}
        <button disabled={!canSubmit} className="w-full rounded-lg bg-gold px-4 py-3 font-medium text-white hover:bg-gold-dark disabled:opacity-50">
          {pending ? "جارٍ إرسال الطلب…" : "إرسال الطلب"}
        </button>
        <p className="text-xs opacity-70">
          نحجز لك المنتجات لمدة {!quote || quote.reservation_minutes === 120 ? "ساعتين" : `${quote.reservation_minutes} دقيقة`}، ونتواصل معك عبر WhatsApp لتأكيد الطلب.
        </p>
      </aside>
    </form>
  );
}
