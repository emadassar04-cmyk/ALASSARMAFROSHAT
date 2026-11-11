"use server";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import { flushTelegram } from "@/lib/notify/telegram";
import { updateTag } from "next/cache";
import { createServiceClient } from "@/lib/supabase/admin";
import { canonicalPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

export type PlaceOrderInput = {
  customer_name: string;
  phone: string;
  fulfillment: "delivery" | "pickup";
  delivery_zone_id?: string;
  address?: string;
  notes?: string;
  payment_method: "cash_on_delivery" | "cash_in_store" | "bank_transfer";
  coupon_code?: string;
  terms_accepted: boolean;
  marketing_consent?: boolean;
  source?: string;
  items: { variant_id: string; quantity: number; notes?: string }[];
};

export type PlaceOrderResult =
  | { ok: true; order_number: string; tracking_token: string; total: number; reservation_expires_at: string | null }
  | { ok: false; error: string; field?: string; variant_id?: string };

const ERRORS: Record<string, [string, string?]> = {
  invalid_name: ["اكتب الاسم الكامل (حرفان على الأقل).", "customer_name"],
  invalid_phone: ["رقم الهاتف غير صحيح. اكتبه بالأرقام، مثل 0599123456.", "phone"],
  terms_not_accepted: ["يجب الموافقة على الشروط وسياسة الخصوصية.", "terms_accepted"],
  invalid_fulfillment_or_payment: ["اختر طريقة الاستلام والدفع.", "payment_method"],
  payment_method_disabled: ["طريقة الدفع هذه غير متاحة حالياً.", "payment_method"],
  payment_fulfillment_mismatch: ["طريقة الدفع لا تناسب طريقة الاستلام المختارة.", "payment_method"],
  invalid_delivery_zone: ["اختر منطقة التوصيل.", "delivery_zone_id"],
  invalid_address: ["اكتب عنوان التوصيل بالتفصيل.", "address"],
  invalid_items: ["السلة فارغة أو فيها كميات غير صحيحة."],
  insufficient_stock: ["الكمية المطلوبة من أحد المنتجات لم تعد متوفرة. عدّل السلة وحاول مجدداً."],
  product_unavailable: ["أحد المنتجات لم يعد متاحاً. احذفه من السلة وحاول مجدداً."],
  requires_measurement: ["أحد المنتجات يُطلب حسب المقاس عبر WhatsApp ولا يمكن طلبه من السلة."],
  invalid_coupon: ["كود الخصم غير صالح أو انتهت صلاحيته.", "coupon_code"],
  store_closed: ["المتجر مغلق مؤقتاً لاستقبال الطلبات. تواصل معنا عبر WhatsApp."],
};

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const service = createServiceClient();
  if (!service) return { ok: false, error: "استقبال الطلبات من الموقع غير مفعّل بعد. تواصل معنا عبر WhatsApp." };

  // 1) الحد من التكرار: 5 طلبات لكل جهاز/شبكة و3 لكل رقم هاتف خلال 10 دقائق
  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  // نفس الرقم بأي صيغة يُحتسب مرة واحدة في حد التكرار
  const phone = canonicalPhone(input.phone) ?? String(input.phone ?? "").replace(/\D/g, "");
  const ipLimit = Number(process.env.ORDER_RATE_LIMIT_PER_IP) || 5;
  const [{ data: ipOk }, { data: phoneOk }] = await Promise.all([
    service.rpc("rate_limit_hit", { p_key: `order:ip:${hash(ip)}`, p_limit: ipLimit, p_window_seconds: 600 }),
    service.rpc("rate_limit_hit", { p_key: `order:phone:${hash(phone)}`, p_limit: 3, p_window_seconds: 600 }),
  ]);
  if (ipOk === false || phoneOk === false) {
    return { ok: false, error: "طلبات كثيرة خلال وقت قصير. انتظر بضع دقائق أو تواصل معنا عبر WhatsApp." };
  }

  // 2) قبل نشر المتجر: يُسمح فقط للمدير (لاختبار الطلبات)
  const { data: settings } = await service.from("store_settings").select("is_published, maintenance_mode").single();
  if (!settings?.is_published || settings.maintenance_mode) {
    const { data: ctx } = await (await createClient()).rpc("my_staff_context");
    const staff = ctx as { is_staff_account?: boolean; aal?: string } | null;
    if (!(staff?.is_staff_account && staff.aal === "aal2")) {
      return { ok: false, error: ERRORS.store_closed[0] };
    }
  }

  // 3) إنشاء الطلب: كل الأسعار والخصومات والحجز داخل قاعدة البيانات (ذرياً)
  const payload = {
    customer_name: String(input.customer_name ?? "").slice(0, 100),
    phone: String(input.phone ?? "").slice(0, 30),
    fulfillment: input.fulfillment,
    delivery_zone_id: input.fulfillment === "delivery" ? input.delivery_zone_id : undefined,
    address: input.fulfillment === "delivery" ? String(input.address ?? "").slice(0, 500) : undefined,
    notes: String(input.notes ?? "").slice(0, 1000),
    payment_method: input.payment_method,
    coupon_code: String(input.coupon_code ?? "").slice(0, 32),
    terms_accepted: input.terms_accepted === true,
    marketing_consent: input.marketing_consent === true,
    source: String(input.source ?? "").slice(0, 50) || undefined,
    items: (Array.isArray(input.items) ? input.items : []).slice(0, 50).map((i) => ({
      variant_id: String(i.variant_id), quantity: Math.floor(Number(i.quantity)), notes: String(i.notes ?? "").slice(0, 500),
    })),
  };
  const { data, error } = await service.rpc("place_order", { p_order: payload });
  if (error) {
    const key = Object.keys(ERRORS).find((k) => error.message.includes(k));
    if (key) {
      const [msg, field] = ERRORS[key];
      return { ok: false, error: msg, field, variant_id: error.details || undefined };
    }
    console.error("place_order failed", error.code);
    return { ok: false, error: "تعذر إرسال الطلب. حاول مرة أخرى أو تواصل معنا عبر WhatsApp." };
  }
  updateTag("catalog"); // التوفر تغيّر بعد الحجز
  after(() => flushTelegram()); // إشعار Telegram فوري بالطلب الجديد
  const r = data as { order_number: string; tracking_token: string; total: number; reservation_expires_at: string | null };
  return { ok: true, ...r };
}
