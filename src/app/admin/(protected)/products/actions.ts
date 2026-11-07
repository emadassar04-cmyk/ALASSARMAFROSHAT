"use server";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type FormState = { ok?: boolean; error?: string; message?: string };

// ---------- أدوات التحقق (المبالغ تبقى نصوصاً دقيقة: لا floating point) ----------
const str = (f: FormData, k: string, max = 500) => {
  const v = String(f.get(k) ?? "").trim();
  return v ? v.slice(0, max) : null;
};
function money(f: FormData, k: string): string | null {
  const v = str(f, k, 20);
  if (v === null) return null;
  const normalized = v.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[,،]/g, "");
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(normalized)) throw new Error(`قيمة غير صحيحة في الحقل: ${k}`);
  return normalized;
}
function int(f: FormData, k: string, min = 0, max = 100000): number | null {
  const v = str(f, k, 10);
  if (v === null) return null;
  const n = Number(v.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`رقم غير صحيح في الحقل: ${k}`);
  return n;
}
const bool = (f: FormData, k: string) => f.get(k) === "on" || f.get(k) === "true";

export async function slugify(name: string): Promise<string> {
  return name.trim().replace(/[\s_]+/g, "-").replace(/[^\p{L}\p{N}-]/gu, "").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

// ترجمة أخطاء قاعدة البيانات إلى رسائل عربية مفهومة
function dbError(e: { code?: string; message?: string } | null): string {
  if (!e) return "حدث خطأ غير متوقع";
  if (e.code === "23505") return "هذا الرابط (slug) مستخدم لمنتج آخر. غيّره وحاول مجدداً.";
  if (e.code === "42501" || /forbidden|permission|row-level/i.test(e.message ?? "")) return "لا تملك صلاحية تنفيذ هذه العملية.";
  if (e.code === "23514") {
    if (/products_check3/.test(e.message ?? "")) return "لا يمكن نشر منتج بسعر ثابت دون تحديد السعر.";
    if (/products_check/.test(e.message ?? "")) return "سعر الخصم يجب أن يكون أقل من السعر الأصلي، وتواريخ العرض منطقية.";
    if (/below reserved/.test(e.message ?? "")) return "لا يمكن جعل الكمية أقل من الكمية المحجوزة لطلبات قائمة.";
    if (/max 10 images/.test(e.message ?? "")) return "الحد الأقصى 10 صور للمنتج.";
    return "القيم المدخلة لا تحقق قيود البيانات.";
  }
  return "تعذر الحفظ. حاول مرة أخرى.";
}

function productFields(f: FormData) {
  const requiresMeasurement = bool(f, "requires_measurement");
  return {
    name: str(f, "name", 200),
    description: str(f, "description", 5000),
    category_id: str(f, "category_id", 40),
    unit_id: int(f, "unit_id", 1, 32767),
    status: (str(f, "status", 20) ?? "draft") as "draft" | "active" | "archived",
    availability_mode: (str(f, "availability_mode", 20) ?? "stock") as string,
    requires_measurement: requiresMeasurement,
    price: requiresMeasurement ? null : money(f, "price"),
    sale_price: requiresMeasurement ? null : money(f, "sale_price"),
    prep_days_min: int(f, "prep_days_min", 0, 365),
    prep_days_max: int(f, "prep_days_max", 0, 365),
    is_featured: bool(f, "is_featured"),
    low_stock_threshold: int(f, "low_stock_threshold", 0, 10000) ?? 2,
    materials: (str(f, "materials", 300) ?? "").split(/[,،]/).map((m) => m.trim()).filter(Boolean),
    seo_title: str(f, "seo_title", 70),
    seo_description: str(f, "seo_description", 160),
  };
}

function refresh(slug?: string | null) {
  updateTag("catalog");
  if (slug) updateTag(`product:${slug}`);
}

// ---------- المنتج ----------
export async function createProduct(_: FormState, f: FormData): Promise<FormState> {
  const supabase = await createClient();
  let id: string;
  try {
    const fields = productFields(f);
    if (!fields.name) return { error: "اسم المنتج مطلوب." };
    if (!fields.unit_id) return { error: "اختر وحدة القياس." };
    const slug = str(f, "slug", 80) ? await slugify(str(f, "slug", 80)!) : await slugify(fields.name);
    const unitCost = money(f, "unit_cost");
    const qty = int(f, "initial_qty", 0, 100000);

    const { data: product, error } = await supabase.from("products").insert({ ...fields, slug }).select("id, slug").single();
    if (error || !product) return { error: dbError(error) };
    id = product.id;

    const { data: variant, error: vErr } = await supabase.from("product_variants")
      .insert({ product_id: id, is_default: true }).select("id").single();
    if (vErr || !variant) return { error: dbError(vErr) };
    if (unitCost !== null) {
      const { error: cErr } = await supabase.from("variant_costs").insert({ variant_id: variant.id, unit_cost: unitCost });
      if (cErr) return { error: dbError(cErr) };
    }
    if (qty) {
      const { error: qErr } = await supabase.rpc("adjust_inventory", {
        p_variant_id: variant.id, p_new_on_hand: qty, p_reason: "الكمية الأولية عند إضافة المنتج", p_kind: "initial" });
      if (qErr) return { error: dbError(qErr) };
    }
    refresh(product.slug);
  } catch (e) {
    return { error: (e as Error).message };
  }
  redirect(`/admin/products/${id}?created=1`);
}

export async function updateProduct(_: FormState, f: FormData): Promise<FormState> {
  const supabase = await createClient();
  try {
    const id = str(f, "id", 40);
    const fields = productFields(f);
    if (!id || !fields.name) return { error: "اسم المنتج مطلوب." };
    const slug = await slugify(str(f, "slug", 80) ?? fields.name);
    const { data: old } = await supabase.from("products").select("slug").eq("id", id).single();
    const { error } = await supabase.from("products").update({ ...fields, slug }).eq("id", id);
    if (error) return { error: dbError(error) };
    refresh(old?.slug);
    refresh(slug);
    return { ok: true, message: "تم حفظ المنتج." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ---------- الخيارات (اللون/المقاس/السعر/التكلفة/الكمية) ----------
export async function saveVariant(_: FormState, f: FormData): Promise<FormState> {
  const supabase = await createClient();
  try {
    const productId = str(f, "product_id", 40)!;
    let variantId = str(f, "variant_id", 40);
    const fields = {
      name: str(f, "name", 100) ?? "افتراضي",
      color: str(f, "color", 50),
      size: str(f, "size", 50),
      material: str(f, "material", 50),
      price_override: money(f, "price_override"),
      is_active: variantId ? bool(f, "is_active") : true,
    };
    if (variantId) {
      const { error } = await supabase.from("product_variants").update(fields).eq("id", variantId);
      if (error) return { error: dbError(error) };
    } else {
      const { data, error } = await supabase.from("product_variants").insert({ ...fields, product_id: productId }).select("id").single();
      if (error || !data) return { error: dbError(error) };
      variantId = data.id;
    }

    const cost = money(f, "unit_cost");
    if (cost !== null) {
      const { error } = await supabase.from("variant_costs").upsert({ variant_id: variantId, unit_cost: cost });
      if (error) return { error: dbError(error) };
    }

    const newQty = int(f, "on_hand", 0, 100000);
    const oldQty = int(f, "on_hand_before", 0, 100000);
    if (newQty !== null && newQty !== oldQty) {
      const reason = str(f, "qty_reason", 200) ?? "تعديل من صفحة المنتج";
      const { error } = await supabase.rpc("adjust_inventory", {
        p_variant_id: variantId, p_new_on_hand: newQty, p_reason: reason, p_kind: oldQty === null ? "initial" : "adjustment" });
      if (error) return { error: dbError(error) };
    }
    const { data: p } = await supabase.from("products").select("slug").eq("id", productId).single();
    refresh(p?.slug);
    return { ok: true, message: "تم حفظ الخيار." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ---------- الوسائط ----------
export async function registerMedia(productId: string, url: string, kind: "image" | "video", alt: string | null) {
  const supabase = await createClient();
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-media/${productId}/`;
  if (!url.startsWith(base)) return { error: "رابط ملف غير صالح." };
  const { count } = await supabase.from("product_media").select("id", { count: "exact", head: true }).eq("product_id", productId);
  const { error } = await supabase.from("product_media").insert({ product_id: productId, url, kind, alt, sort_order: (count ?? 0) + 1 });
  if (error) return { error: dbError(error) };
  const { data: p } = await supabase.from("products").select("slug").eq("id", productId).single();
  refresh(p?.slug);
  return { ok: true };
}

export async function deleteMedia(mediaId: string) {
  const supabase = await createClient();
  const { data: m } = await supabase.from("product_media").select("url, product_id, products(slug)").eq("id", mediaId).single();
  if (!m) return { error: "الملف غير موجود." };
  const { error } = await supabase.from("product_media").delete().eq("id", mediaId);
  if (error) return { error: dbError(error) };
  refresh((m.products as unknown as { slug: string } | null)?.slug);
  // remove() لا يرمي خطأ إن لم يُحذف شيء؛ نتحقق من النتيجة حتى لا يبقى ملف يتيم دون علمنا
  const path = m.url.split("/storage/v1/object/public/product-media/")[1];
  if (path) {
    const { data: removed, error: rmErr } = await supabase.storage.from("product-media").remove([decodeURIComponent(path)]);
    if (rmErr || !removed?.length) return { error: "حُذفت الصورة من المنتج، لكن تعذر حذف الملف من التخزين." };
  }
  return { ok: true };
}

export async function moveMedia(mediaId: string, direction: -1 | 1) {
  const supabase = await createClient();
  const { data: m } = await supabase.from("product_media").select("id, product_id").eq("id", mediaId).single();
  if (!m) return { error: "الملف غير موجود." };
  const { data: all } = await supabase.from("product_media").select("id").eq("product_id", m.product_id)
    .order("sort_order").order("created_at");
  const ids = (all ?? []).map((x) => x.id);
  const i = ids.indexOf(mediaId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= ids.length) return { ok: true };
  [ids[i], ids[j]] = [ids[j], ids[i]];
  for (const [n, mid] of ids.entries()) {
    const { error } = await supabase.from("product_media").update({ sort_order: n + 1 }).eq("id", mid);
    if (error) return { error: dbError(error) };
  }
  const { data: p } = await supabase.from("products").select("slug").eq("id", m.product_id).single();
  refresh(p?.slug);
  return { ok: true };
}
