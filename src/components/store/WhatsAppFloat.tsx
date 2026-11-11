"use client";
import { usePathname } from "next/navigation";
import { whatsappLink } from "@/lib/format";
import { WhatsAppIcon } from "./WhatsAppIcon";

// لا يظهر في السلة وإتمام الطلب وصفحة الطلب واستوديو التفصيل (فيها أزرار WhatsApp خاصة بها) حتى لا يغطي الملخص أو أزرار المعاينة
const HIDDEN_ON = /^\/(cart|checkout|order|special-order)(\/|$)/;

export function WhatsAppFloat({ number }: { number: string | null }) {
  const pathname = usePathname();
  const href = whatsappLink(number, "مرحباً، أود الاستفسار عن منتجات مفروشات العصار");
  if (!href || HIDDEN_ON.test(pathname)) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="تواصل معنا عبر WhatsApp"
      className="fixed bottom-5 left-4 z-50 flex h-13 w-13 items-center justify-center rounded-full bg-[#1f7a4d] text-white shadow-lift transition-[transform,bottom] duration-300 hover:scale-105 sm:left-6 [.has-buybar_&]:max-md:bottom-24"
    >
      <WhatsAppIcon className="h-7 w-7" />
    </a>
  );
}
