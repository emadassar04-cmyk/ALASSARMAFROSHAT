"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Expand, Play, X } from "lucide-react";
import { ProductImage } from "@/components/store/ProductImage";

type Media = { kind: "image" | "video"; url: string; alt: string };

// معرض صور المنتج: صورة رئيسية + مصغرات + تكبير بملء الشاشة (<dialog> أصلي: Esc وحبس التركيز)
export function Gallery({ media, name }: { media: Media[]; name: string }) {
  const [index, setIndex] = useState(0);
  const zoomRef = useRef<HTMLDialogElement>(null);
  const [zoom, setZoom] = useState(false);
  const current = media[index];

  useEffect(() => {
    const d = zoomRef.current;
    if (!d) return;
    if (zoom && !d.open) d.showModal();
    if (!zoom && d.open) d.close();
  }, [zoom]);

  if (!media.length) return <ProductImage alt={name} sizes="(min-width: 1024px) 50vw, 100vw" className="aspect-[4/5] w-full rounded-[var(--radius-card)]" />;

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[var(--radius-card)] bg-cream">
        {current.kind === "video" ? (
          <video src={current.url} controls preload="metadata" className="h-full w-full object-contain" aria-label={current.alt} />
        ) : (
          <button type="button" onClick={() => setZoom(true)} className="group absolute inset-0 cursor-zoom-in" aria-label="تكبير الصورة">
            <Image src={current.url} alt={current.alt} fill preload={index === 0} fetchPriority={index === 0 ? "high" : undefined}
              sizes="(min-width: 1280px) 620px, (min-width: 1024px) 50vw, 100vw" className="object-cover" />
            <span aria-hidden="true" className="absolute bottom-4 left-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-charcoal opacity-0 shadow-soft transition-opacity group-hover:opacity-100 max-lg:opacity-100">
              <Expand strokeWidth={1.6} className="h-4 w-4" />
            </span>
          </button>
        )}
      </div>
      {media.length > 1 && (
        <ul className="no-scrollbar flex gap-2.5 overflow-x-auto">
          {media.map((m, i) => (
            <li key={m.url} className="shrink-0">
              <button type="button" onClick={() => setIndex(i)} aria-label={`عرض ${m.kind === "video" ? "الفيديو" : `الصورة ${i + 1}`}`}
                aria-current={i === index}
                className={`relative block h-20 w-16 overflow-hidden rounded-lg border-2 transition-colors ${i === index ? "border-charcoal" : "border-transparent opacity-80 hover:opacity-100"}`}>
                {m.kind === "video" ? (
                  <span className="flex h-full w-full items-center justify-center bg-charcoal text-warm-white"><Play aria-hidden="true" strokeWidth={1.6} className="h-5 w-5" /></span>
                ) : (
                  <Image src={m.url} alt="" fill sizes="64px" className="object-cover" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      <dialog ref={zoomRef} aria-label="الصورة مكبرة" onClose={() => setZoom(false)} onClick={() => setZoom(false)}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-charcoal/95 p-4 backdrop:bg-charcoal/90">
        {zoom && current.kind === "image" && (
          <>
            <button type="button" autoFocus onClick={() => setZoom(false)} aria-label="إغلاق"
              className="absolute top-4 left-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white text-charcoal">
              <X aria-hidden="true" strokeWidth={1.6} className="h-5 w-5" />
            </button>
            <div className="relative h-full w-full">
              <Image src={current.url} alt={current.alt} fill sizes="100vw" className="object-contain" />
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
