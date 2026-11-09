import type { MetadataRoute } from "next";
import { getStoreSettings } from "@/lib/catalog";

// قبل نشر المتجر (is_published = false) نمنع الفهرسة كلياً حتى لا يظهر متجر فارغ في Google.
// بعد النشر: كل شيء مسموح عدا الإدارة وصفحات الزبون الخاصة.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const s = await getStoreSettings();
  if (!s.is_published) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/auth", "/cart", "/checkout", "/order", "/track", "/search", "/wishlist", "/compare"],
    },
    sitemap: `${s.site_url}/sitemap.xml`,
  };
}
