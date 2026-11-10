import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { getStoreSettings } from "@/lib/catalog";
import "./globals.css";

// خط واحد للمنصة كلها (المتجر والإدارة): IBM Plex Sans Arabic — هندسي هادئ وأنيق، عربي ولاتيني متناسقان.
// يُنزَّل وقت البناء ويُخدم من نطاق الموقع نفسه (لا طلبات لـ Google Fonts عند الزائر).
// ثلاثة أوزان فقط (~35KB لكل وزن): 300 للعناوين التحريرية الكبيرة، 400 للنص، 500 للتأكيد والعناوين الصغيرة.
// أي وزن أثقل (semibold/bold) يُعرض بوزن 500 دون تسميك صناعي: هدوء بصري وتحميل أخف.
const plex = IBM_Plex_Sans_Arabic({
  variable: "--font-plex",
  subsets: ["arabic"],
  weight: ["300", "400", "500"],
  display: "swap",
});

const SITE_NAME = "مفروشات العصار";
const DESCRIPTION = "متجر مفروشات العصار في دير البلح والنصيرات: سجاد، ستائر، مراتب، بطانيات، شراشف ومخدات، مع توصيل داخل قطاع غزة.";

export const viewport: Viewport = { themeColor: "#f7f6f2" };

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
    <html lang="ar" dir="rtl" className={`${plex.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
