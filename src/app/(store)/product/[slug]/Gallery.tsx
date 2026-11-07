"use client";
import { useState } from "react";
import Image from "next/image";
import { ProductImage } from "@/components/store/ProductImage";

type Media = { kind: "image" | "video"; url: string; alt: string };

// معرض صور مع صور مصغرة وتكبير بملء الشاشة
export function Gallery({ media, name }: { media: Media[]; name: string }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const current = media[index];

  if (!media.length) return <ProductImage alt={name} sizes="100vw" className="aspect-square w-full rounded-2xl" />;

  return (
    <div className="space-y-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-beige">
        {current.kind === "video" ? (
          <video src={current.url} controls preload="metadata" className="h-full w-full object-contain" aria-label={current.alt} />
        ) : (
          <button type="button" onClick={() => setZoom(true)} className="absolute inset-0 cursor-zoom-in" aria-label="تكبير الصورة">
            <Image src={current.url} alt={current.alt} fill priority sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
          </button>
        )}
      </div>
      {media.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {media.map((m, i) => (
            <li key={m.url}>
              <button type="button" onClick={() => setIndex(i)} aria-label={`عرض ${m.kind === "video" ? "الفيديو" : `الصورة ${i + 1}`}`}
                aria-current={i === index}
                className={`relative block h-16 w-16 overflow-hidden rounded-lg border-2 ${i === index ? "border-gold" : "border-transparent"}`}>
                {m.kind === "video" ? (
                  <span className="flex h-full w-full items-center justify-center bg-stone-800 text-white">▶</span>
                ) : (
                  <Image src={m.url} alt="" fill sizes="64px" className="object-cover" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {zoom && current.kind === "image" && (
        <div role="dialog" aria-modal="true" aria-label="الصورة مكبرة" onClick={() => setZoom(false)}
          onKeyDown={(e) => e.key === "Escape" && setZoom(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <button type="button" autoFocus onClick={() => setZoom(false)} className="absolute top-4 left-4 rounded-full bg-white/90 px-3 py-1 text-sm">إغلاق ✕</button>
          <div className="relative h-full w-full">
            <Image src={current.url} alt={current.alt} fill sizes="100vw" className="object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
