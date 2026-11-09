import { Cairo, Inter } from "next/font/google";

// خطا لوحة الإدارة فقط (لا يُحمَّلان في المتجر): Cairo للعربية وInter للإنجليزية
export const cairo = Cairo({ subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-cairo", display: "swap" });
export const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-inter", display: "swap", preload: false });
