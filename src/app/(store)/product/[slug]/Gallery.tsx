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

  // الجوال: صورة ثم مصغرات أفقية؛ الشاشات الكبيرة: مصغرات عمودية بجانب الصورة
  return (
    <div className={`gap-4 max-lg:space-y-3 ${media.length > 1 ? "lg:grid lg:grid-cols-[4.5rem_minmax(0,1fr)]" : ""}`}>
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[var(--radius-card)] bg-surface-soft lg:order-2">
        {current.kind === "video" ? (
          <video src={current.url} controls preload="metadata" className="h-full w-full object-contain" aria-label={current.alt} />
        ) : (
          <button type="button" onClick={() => setZoom(true)} className="group absolute inset-0 cursor-zoom-in" aria-label="تكبير الصورة">
            <Image src={current.url} alt={current.alt} fill preload={index === 0} fetchPriority={index === 0 ? "high" : undefined}
              sizes="(min-width: 1280px) 700px, (min-width: 1024px) 55vw, 100vw" className="img-zoom object-cover" />
            <span aria-hidden="true" className="absolute bottom-5 left-5 flex h-11 w-11 items-center justify-center rounded-full bg-ivory/90 text-charcoal opacity-0 shadow-soft backdrop-blur transition-opacity duration-500 group-hover:opacity-100 max-lg:opacity-100">
              <Expand strokeWidth={1.4} className="h-4 w-4" />
            </span>
          </button>
        )}
      </div>
      {media.length > 1 && (
        <ul className="no-scrollbar flex gap-2.5 overflow-x-auto lg:order-1 lg:flex-col lg:overflow-visible">
          {media.map((m, i) => (
            <li key={m.url} className="shrink-0">
              <button type="button" onClick={() => setIndex(i)} aria-label={`عرض ${m.kind === "video" ? "الفيديو" : `الصورة ${i + 1}`}`}
                aria-current={i === index}
                className={`relative block h-20 w-16 overflow-hidden rounded-md transition-[opacity,box-shadow] duration-300 lg:h-[5.6rem] lg:w-[4.5rem] ${i === index ? "ring-1 ring-charcoal ring-offset-2 ring-offset-ivory" : "opacity-60 hover:opacity-100"}`}>
                {m.kind === "video" ? (
                  <span className="flex h-full w-full items-center justify-center bg-charcoal text-ivory"><Play aria-hidden="true" strokeWidth={1.6} className="h-5 w-5" /></span>
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
