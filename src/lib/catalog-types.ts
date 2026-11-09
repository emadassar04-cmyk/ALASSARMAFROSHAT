// أنواع بيانات الكتالوج العام (تطابق ما تعيده دوال catalog_* في قاعدة البيانات)
export type Availability = "in_stock" | "limited" | "out_of_stock" | "made_to_order" | "coming_soon" | "unavailable";

export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  price: number | null;
  compare_at_price: number | null;
  requires_measurement: boolean;
  is_featured: boolean;
  availability: Availability;
  image: { url: string; alt: string } | null;
  category: { slug: string; name: string } | null;
  created_at: string;
};

export type Variant = {
  id: string;
  name: string;
  color: string | null;
  size: string | null;
  material: string | null;
  is_default: boolean;
  price: number | null;
  availability: Availability;
};

export type ProductDetail = ProductCard & {
  description: string | null;
  materials: string[];
  unit: string | null;
  prep_days_min: number | null;
  prep_days_max: number | null;
  seo_title: string | null;
  seo_description: string | null;
  media: { kind: "image" | "video"; url: string; alt: string }[];
  variants: Variant[];
  breadcrumbs: { slug: string; name: string }[];
  related: ProductCard[];
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  parent_id: string | null;
  product_count: number;
};

export type SearchParams = {
  q?: string;
  category?: string;
  min_price?: number;
  max_price?: number;
  availability?: "available";
  color?: string;
  size?: string;
  material?: string;
  featured?: boolean;
  sort?: "newest" | "price_asc" | "price_desc" | "best_selling" | "relevance";
  page?: number;
  page_size?: number;
};

export type SearchResult = { items: ProductCard[]; total: number; page: number; page_size: number };

export type Facets = {
  colors: string[];
  sizes: string[];
  materials: string[];
  price_min: number | null;
  price_max: number | null;
};

export type StoreSettings = {
  store_name: string;
  whatsapp_number: string | null;
  contact_phone: string | null;
  is_published: boolean;
  maintenance_mode: boolean;
  site_url: string;
  ga_measurement_id: string | null;
  meta_pixel_id: string | null;
  google_site_verification: string | null;
};

export type PolicySlug = "delivery" | "returns" | "privacy";
export type Policy = { slug: PolicySlug; title: string; body: string; updated_at: string };

export type SitemapData = {
  products: { slug: string; updated_at: string }[];
  categories: { slug: string; updated_at: string }[];
  policies: { slug: PolicySlug; updated_at: string }[];
};

export type Branch = { name: string; address: string | null; phone: string | null; map_url: string | null };

export type CartLine = {
  variant_id: string;
  variant_name: string;
  color: string | null;
  size: string | null;
  material: string | null;
  product: ProductCard;
  price: number | null;
  availability: Availability;
};

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  in_stock: "متوفر",
  limited: "كمية محدودة",
  out_of_stock: "غير متوفر",
  made_to_order: "متوفر حسب الطلب",
  coming_soon: "قريباً في المتجر",
  unavailable: "غير متوفر",
};

export function isPurchasable(a: Availability) {
  return a === "in_stock" || a === "limited" || a === "made_to_order";
}

export type DeliveryZone = { id: string; name: string; fee: number; eta_text: string | null };
export type PaymentMethodCode = "cash_on_delivery" | "cash_in_store" | "bank_transfer";
export type PaymentMethod = { code: PaymentMethodCode; name_ar: string; instructions: string | null };

export type Quote = {
  lines: { variant_id: string; quantity: number; unit_price: number | null; line_total: number | null;
           problem: null | "unavailable" | "requires_measurement" | "invalid_quantity" | "insufficient_stock" }[];
  subtotal: number; discount: number; delivery_fee: number; total: number; reservation_minutes: number;
  coupon: null | { valid: boolean; code: string; discount?: number; reason?: string };
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  received: "تم استلام الطلب",
  awaiting_confirmation: "بانتظار التواصل والتأكيد عبر WhatsApp",
  confirmed: "تم تأكيد الطلب",
  preparing: "قيد التجهيز",
  ready_for_pickup: "جاهز للاستلام من المحل",
  out_for_delivery: "خرج للتوصيل",
  delivered: "تم التسليم",
  cancelled: "تم إلغاء الطلب",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  unpaid: "لم يُدفع بعد", awaiting_review: "بانتظار مراجعة التحويل", paid: "مدفوع", rejected: "تحويل مرفوض", refunded: "مسترد",
};
