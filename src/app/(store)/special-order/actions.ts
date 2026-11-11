"use server";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/admin";
import { canonicalPhone } from "@/lib/phone";
import { emptyDraft, validateCustomer, validateSpecs, type Draft, type ProductType } from "@/lib/custom-order/spec";

// حفظ طلب التفصيل: تحقق كامل في الخادم (نفس قواعد الواجهة) + حد للطلبات + منع التكرار بمعرّف الطلب،
// ثم الحفظ عبر دالة قاعدة البيانات (التي تتحقق مرة أخرى). لا سعر تلقائي.

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);
const TYPES: ProductType[] = ["curtains", "ceiling", "mattress", "other"];
const jpeg = (s: unknown, max: number) => typeof s === "string" && s.startsWith("data:image/jpeg;base64,") && s.length <= max ? s : null;

export type SubmitInput = {
  requestId: string;
  type: ProductType;
  section: unknown;           // قسم المواصفات الخاص بالنوع (من المسودة)
  customer: Draft["customer"];
  preview?: string | null;    // صورة المعاينة JPEG (اختيارية)
  reference?: string | null;  // صورة مرجعية من العميل (للتفصيلات الأخرى)
};

export async function submitCustomOrder(input: SubmitInput): Promise<{ ok: true; number: string } | { ok: false; error: string; fields?: Record<string, string> }> {
  if (!input || !TYPES.includes(input.type) || !/^[0-9a-f-]{36}$/i.test(String(input.requestId))) return { ok: false, error: "طلب غير صالح. أعد تحميل الصفحة وحاول مرة أخرى." };

  // نعيد بناء المسودة من القسم المرسل فقط، ونتحقق كما في الواجهة
  const draft = emptyDraft();
  draft.type = input.type;
  (draft as Record<string, unknown>)[input.type] = { ...(draft[input.type] as object), ...(typeof input.section === "object" && input.section ? input.section : {}) };
  if (input.type === "curtains" && !Array.isArray(draft.curtains.windows)) draft.curtains.windows = [];
  const spec = validateSpecs(draft);
  const cust = validateCustomer({ ...draft.customer, ...input.customer }, canonicalPhone);
  if (!spec.specs || !cust.phone || Object.keys(cust.errors).length) {
    return { ok: false, error: "تحقق من الحقول المطلوبة.", fields: { ...spec.errors, ...cust.errors } };
  }

  const service = createServiceClient();
  if (!service) return { ok: false, error: "استقبال الطلبات غير مفعّل حالياً. تواصل معنا عبر WhatsApp." };

  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const [{ data: ipOk }, { data: phoneOk }] = await Promise.all([
    service.rpc("rate_limit_hit", { p_key: `custom:ip:${hash(ip)}`, p_limit: Number(process.env.CUSTOM_ORDER_RATE_LIMIT_PER_IP) || 6, p_window_seconds: 600 }),
    service.rpc("rate_limit_hit", { p_key: `custom:phone:${hash(cust.phone)}`, p_limit: 4, p_window_seconds: 600 }),
  ]);
  if (ipOk === false || phoneOk === false) return { ok: false, error: "طلبات كثيرة خلال وقت قصير. انتظر بضع دقائق أو تواصل معنا عبر WhatsApp." };

  const { data, error } = await service.rpc("submit_custom_order", {
    p: {
      request_id: input.requestId,
      product_type: input.type,
      specs: spec.specs,
      customer_name: input.customer.name.trim().slice(0, 80),
      phone: cust.phone,
      area: input.customer.area.trim().slice(0, 80),
      customer_notes: String(input.customer.notes ?? "").trim().slice(0, 1000) || null,
      preview_image: jpeg(input.preview, 400_000),
      reference_image: input.type === "other" ? jpeg(input.reference, 700_000) : null,
    },
  });
  if (error) {
    console.error("submit_custom_order", error.message);
    return { ok: false, error: "تعذر حفظ الطلب. حاول مرة أخرى أو تواصل معنا عبر WhatsApp." };
  }
  return { ok: true, number: (data as { number: string }).number };
}
