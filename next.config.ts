import type { NextConfig } from "next";

// قائمة Next.js الافتراضية للزواحف التي تحتاج البيانات الوصفية داخل <head> + Googlebot الرئيسي.
// (افتراضياً يتلقى Googlebot البيانات الوصفية متدفقة داخل الصفحة؛ نضمن له وصف المنتج والرابط الأساسي في <head>.
//  الكلفة صغيرة لأن بيانات المنتج مخزنة مؤقتاً.)
const HTML_LIMITED_BOTS =
  /Googlebot|[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight/i;

const nextConfig: NextConfig = {
  htmlLimitedBots: HTML_LIMITED_BOTS,
  /* config options here */
  cacheComponents: true,
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75],
    remotePatterns: [new URL("https://puakwxubskwxostdtmzi.supabase.co/storage/v1/object/public/**")],
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
