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
};

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
