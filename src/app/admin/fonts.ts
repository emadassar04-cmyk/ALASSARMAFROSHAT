import { Cairo, Inter } from "next/font/google";

// خطا لوحة الإدارة فقط (لا يُحمَّلان في المتجر): Cairo للعربية وInter للإنجليزية
// خطان متغيران (ملف واحد لكل لغة بكل الأوزان) بدل ملف لكل وزن: تحميل أخف بكثير
export const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-cairo", display: "swap" });
export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap", preload: false });
