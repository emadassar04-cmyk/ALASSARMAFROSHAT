import type { MetadataRoute } from "next";
import { getSitemapData, getStoreSettings } from "@/lib/catalog";
import { POLICY_PATHS } from "@/lib/site";

// خريطة الموقع: الصفحات العامة + كل منتج ظاهر + كل تصنيف فعّال + السياسات المنشورة
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [settings, data] = await Promise.all([getStoreSettings(), getSitemapData()]);
  const site = settings.site_url;
  const enc = (s: string) => encodeURIComponent(s);
  return [
    { url: `${site}/`, changeFrequency: "daily", priority: 1 },
    { url: `${site}/products`, changeFrequency: "daily", priority: 0.9 },
    { url: `${site}/special-order`, changeFrequency: "monthly", priority: 0.6 },
    ...data.categories.map((c) => ({
      url: `${site}/category/${enc(c.slug)}`, lastModified: c.updated_at, changeFrequency: "weekly" as const, priority: 0.8,
    })),
    ...data.products.map((p) => ({
      url: `${site}/product/${enc(p.slug)}`, lastModified: p.updated_at, changeFrequency: "weekly" as const, priority: 0.7,
    })),
    ...data.policies.map((p) => ({
      url: `${site}${POLICY_PATHS[p.slug]}`, lastModified: p.updated_at, changeFrequency: "yearly" as const, priority: 0.3,
    })),
  ];
}
