"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Meta Pixel لا يلتقط التنقل داخل الموقع تلقائياً؛ نرسل PageView عند كل تغيير صفحة.
// (Google Analytics يلتقطه تلقائياً عبر Enhanced Measurement)
export function PixelPageViews() {
  const pathname = usePathname();
  useEffect(() => {
    window.fbq?.("track", "PageView");
  }, [pathname]);
  return null;
}
