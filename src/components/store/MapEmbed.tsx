"use client";
import { useState } from "react";
import { MapPin } from "lucide-react";

// خريطة Google تُحمَّل عند الطلب فقط: الصفحة لا تتحمّل وزن الخريطة (مئات الكيلوبايتات) إلا إن أرادها الزائر
export function MapEmbed({ src, title, autoload = false }: { src: string; title: string; autoload?: boolean }) {
  const [show, setShow] = useState(autoload);
  if (show) {
    return (
      <iframe src={src} title={title} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen
        className="h-full w-full border-0" />
    );
  }
  return (
    <button type="button" onClick={() => setShow(true)}
      className="group relative flex h-full w-full flex-col items-center justify-center gap-3 overflow-hidden bg-cream text-charcoal">
      {/* شبكة شوارع زخرفية خفيفة توحي بالخريطة */}
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full text-gold/25" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" fill="none" stroke="currentColor">
        <path d="M-10 60C80 40 160 90 250 70S380 30 420 50" strokeWidth="10" />
        <path d="M-10 170C90 150 170 200 270 180S390 140 420 160" strokeWidth="6" />
        <path d="M120 -10C110 70 150 140 130 260" strokeWidth="8" />
        <path d="M300 -10C290 60 320 150 300 260" strokeWidth="5" />
      </svg>
      <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-charcoal text-gold shadow-lift transition-transform duration-300 group-hover:-translate-y-1">
        <MapPin aria-hidden="true" strokeWidth={1.6} className="h-6 w-6" />
      </span>
      <span className="relative rounded-full bg-white/90 px-4 py-1.5 text-sm font-medium shadow-soft">عرض الخريطة</span>
    </button>
  );
}
