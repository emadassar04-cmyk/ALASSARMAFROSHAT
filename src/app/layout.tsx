import type { Metadata, Viewport } from "next";
import { Alexandria } from "next/font/google";
import { getStoreSettings } from "@/lib/catalog";
import "./globals.css";

// خط واحد للموقع كله: Alexandria — حديث وأنيق وواضح، وخفيف جداً (~12KB لكل وزن من الحروف العربية).
// يُنزَّل وقت البناء ويُخدم من نطاق الموقع نفسه (لا طلبات لـ Google Fonts عند الزائر).
// وزنان فقط: 400 للنص و500 للعناوين والتأكيد. الحروف اللاتينية (الأرقام) تُحمَّل عند الحاجة.
const alexandria = Alexandria({
  variable: "--font-alexandria",
  subsets: ["arabic"],
  weight: ["400", "500"],
  display: "swap",
});

const SITE_NAME = "مفروشات العصار";
const DESCRIPTION = "متجر مفروشات العصار في دير البلح والنصيرات: سجاد، ستائر، مراتب، بطانيات، شراشف ومخدات، مع توصيل داخل قطاع غزة.";

export const viewport: Viewport = { themeColor: "#fffefa" };

export async function generateMetadata(): Promise<Metadata> {
  const s = await getStoreSettings();
  return {
    metadataBase: new URL(s.site_url),
    title: { default: s.store_name, template: `%s | ${SITE_NAME}` },
    description: DESCRIPTION,
    applicationName: SITE_NAME,
    openGraph: { type: "website", locale: "ar_PS", siteName: SITE_NAME, title: s.store_name, description: DESCRIPTION },
    twitter: { card: "summary_large_image" },
    formatDetection: { telephone: false },
    ...(s.google_site_verification && { verification: { google: s.google_site_verification } }),
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={`${alexandria.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
