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

const field = "field";

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
      <div className="mx-auto max-w-md py-10 text-center">
        <p>سلتك فارغة.</p>
        <Link href="/products" className="btn btn-primary mt-6">تصفح المنتجات</Link>
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
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_23rem] lg:gap-12" noValidate>
      <div className="space-y-5">
        <fieldset className="space-y-3 panel p-5 sm:p-6 [&>*:not(legend)]:clear-both">
          <legend className="float-start mb-1 w-full font-sans text-base font-semibold">بياناتك</legend>
          <label className="block space-y-1.5 text-sm"><span className="font-medium">الاسم الكامل *</span>
            <input required autoComplete="name" maxLength={100} value={form.name} onChange={(e) => set("name", e.target.value)}
              aria-invalid={invalid("customer_name")} className={field} /></label>
          <label className="block space-y-1.5 text-sm"><span className="font-medium">رقم الهاتف (WhatsApp) *</span>
            <input required type="tel" inputMode="tel" autoComplete="tel" dir="ltr" maxLength={20} value={form.phone}
              onChange={(e) => set("phone", e.target.value)} placeholder="0599123456" aria-invalid={invalid("phone")} className={`${field} text-right`} /></label>
          <p className="text-xs leading-5 text-muted-ink">
            نستخدم رقم جوالك لتأكيد طلبك، ولربط مشترياتك من المتجر الإلكتروني والفرعين، وللمشاركة في حملات السحب وفق شروطها.
            لا نرسل لك عروضاً إلا إذا وافقت على ذلك أدناه.
          </p>
        </fieldset>

        <fieldset className="space-y-3 panel p-5 sm:p-6 [&>*:not(legend)]:clear-both">
          <legend className="float-start mb-1 w-full font-sans text-base font-semibold">طريقة الاستلام</legend>
          <div className="grid grid-cols-2 gap-2">
            {([["delivery", "توصيل للعنوان"], ["pickup", "استلام من المحل"]] as const).map(([v, l]) => (
              <label key={v} className={`cursor-pointer rounded-[var(--radius-control)] border p-3.5 text-center text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold ${form.fulfillment === v ? "border-charcoal bg-cream font-medium" : "border-border hover:border-[#ddd2bf]"}`}>
                <input type="radio" name="fulfillment" value={v} checked={form.fulfillment === v} onChange={() => set("fulfillment", v)} className="sr-only" />{l}
              </label>
            ))}
          </div>
          {form.fulfillment === "delivery" && (
            zones.length === 0 ? (
              <p className="rounded-[var(--radius-control)] bg-warning/10 p-3 text-sm text-warning">التوصيل غير متاح حالياً. اختر الاستلام من المحل أو تواصل معنا.</p>
            ) : (
              <>
                <label className="block space-y-1.5 text-sm"><span className="font-medium">المنطقة *</span>
                  <select required value={form.zone} onChange={(e) => set("zone", e.target.value)} aria-invalid={invalid("delivery_zone_id")} className={field}>
                    <option value="">اختر المنطقة</option>
                    {zones.map((z) => <option key={z.id} value={z.id}>{z.name} — {formatPrice(z.fee)}{z.eta_text ? ` (${z.eta_text})` : ""}</option>)}
                  </select></label>
                <label className="block space-y-1.5 text-sm"><span className="font-medium">العنوان بالتفصيل *</span>
                  <textarea required rows={2} maxLength={500} value={form.address} onChange={(e) => set("address", e.target.value)}
                    placeholder="الحي، الشارع، علامة مميزة" aria-invalid={invalid("address")} className={field} /></label>
              </>
            )
          )}
        </fieldset>

        <fieldset className="space-y-3 panel p-5 sm:p-6 [&>*:not(legend)]:clear-both">
          <legend className="float-start mb-1 w-full font-sans text-base font-semibold">طريقة الدفع</legend>
          {allowedMethods.map((m) => (
            <label key={m.code} className={`block cursor-pointer rounded-[var(--radius-control)] border p-3.5 text-sm transition-colors ${payment === m.code ? "border-charcoal bg-cream" : "border-border hover:border-[#ddd2bf]"}`}>
              <span className="flex items-center gap-2">
                <input type="radio" name="payment" value={m.code} checked={payment === m.code} onChange={() => set("payment", m.code)} className="h-4 w-4 accent-[var(--charcoal)]" />
                <span className="font-medium">{m.name_ar}</span>
              </span>
              {payment === m.code && m.instructions && <span className="mt-1.5 block leading-6 text-muted-ink">{m.instructions}</span>}
            </label>
          ))}
          <p className="text-xs text-muted-ink">لا يوجد دفع إلكتروني بالبطاقة.</p>
        </fieldset>

        <label className="block space-y-1.5 text-sm"><span className="font-medium">ملاحظات على الطلب (اختياري)</span>
          <textarea rows={2} maxLength={1000} value={form.notes} onChange={(e) => set("notes", e.target.value)} className={field} /></label>

        <div className="space-y-2 text-sm">
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={form.terms} onChange={(e) => set("terms", e.target.checked)} aria-invalid={invalid("terms_accepted")} className="mt-1 h-4 w-4 accent-[var(--charcoal)]" />
            <span className="leading-6">
              أوافق على <Link href="/policies/delivery" target="_blank" className="text-gold-ink underline underline-offset-4">سياسة التوصيل</Link>
              {" "}و<Link href="/policies/returns" target="_blank" className="text-gold-ink underline underline-offset-4">سياسة الاستبدال والإرجاع</Link>
              {" "}و<Link href="/policies/privacy" target="_blank" className="text-gold-ink underline underline-offset-4">سياسة الخصوصية</Link>. *
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={form.marketing} onChange={(e) => set("marketing", e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--charcoal)]" />
            <span className="leading-6">أوافق على استلام العروض عبر WhatsApp (اختياري، ويمكن الإلغاء في أي وقت).</span>
          </label>
        </div>
      </div>

      <aside className="panel h-fit space-y-4 p-6 lg:sticky lg:top-28">
        <h2 className="font-sans text-base font-semibold">ملخص الطلب</h2>
        <ul className="space-y-2 text-sm">
          {items.map((i) => {
            const l = byVariant.get(i.variantId);
            const q = quote?.lines.find((x) => x.variant_id === i.variantId);
            return (
              <li key={i.variantId} className="flex justify-between gap-2">
                <span>{l?.product.name ?? "…"} × {i.qty}
                  {q?.problem && <span className="block text-xs text-danger">{PROBLEM[q.problem]}</span>}</span>
                <span className="tabular-nums">{q?.line_total != null ? formatPrice(q.line_total) : ""}</span>
              </li>
            );
          })}
        </ul>
        {problems.length > 0 && (
          <p role="alert" className="rounded-[var(--radius-control)] bg-danger/8 p-2.5 text-xs text-danger">
            بعض المنتجات تحتاج تعديلاً. <Link href="/cart" className="underline">عدّل السلة</Link>
          </p>
        )}
        <div className="flex gap-2">
          <input value={form.coupon} onChange={(e) => set("coupon", e.target.value.toUpperCase())} placeholder="كود الخصم" maxLength={32}
            aria-label="كود الخصم" aria-invalid={invalid("coupon_code")} className={`${field} text-sm`} dir="ltr" />
          <button type="button" onClick={() => setAppliedCoupon(form.coupon.trim())} className="btn btn-outline shrink-0 !px-4">تطبيق</button>
        </div>
        {quote?.coupon && (
          <p role="status" className={`text-xs ${quote.coupon.valid ? "text-success" : "text-danger"}`}>
            {quote.coupon.valid ? `تم تطبيق ${quote.coupon.code}` : COUPON_REASON[quote.coupon.reason ?? ""] ?? "الكود غير صالح"}
          </p>
        )}
        <dl className="space-y-2 border-t border-border pt-4 text-sm tabular-nums">
          <div className="flex justify-between"><dt>المنتجات</dt><dd>{quote ? formatPrice(quote.subtotal) : "…"}</dd></div>
          {!!quote?.discount && Number(quote.discount) > 0 && (
            <div className="flex justify-between text-success"><dt>الخصم</dt><dd>− {formatPrice(quote.discount)}</dd></div>)}
          <div className="flex justify-between"><dt>التوصيل</dt>
            <dd>{form.fulfillment === "pickup" ? "مجاني" : form.zone ? formatPrice(quote?.delivery_fee) : "اختر المنطقة"}</dd></div>
          <div className="flex justify-between border-t border-border pt-3 text-base font-semibold"><dt>الإجمالي</dt><dd>{quote ? formatPrice(quote.total) : "…"}</dd></div>
        </dl>
        {error && <p role="alert" className="rounded-[var(--radius-control)] bg-danger/8 p-3 text-sm text-danger">{error.message}</p>}
        <button disabled={!canSubmit} className="btn btn-primary h-13 w-full text-base">
          {pending ? "جارٍ إرسال الطلب…" : "إرسال الطلب"}
        </button>
        <p className="text-xs leading-5 text-muted-ink">
          نحجز لك المنتجات لمدة {!quote || quote.reservation_minutes === 120 ? "ساعتين" : `${quote.reservation_minutes} دقيقة`}، ونتواصل معك عبر WhatsApp لتأكيد الطلب.
        </p>
      </aside>
    </form>
  );
}
