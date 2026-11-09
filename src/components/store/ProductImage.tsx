import Image from "next/image";

// صورة منتج محسّنة (AVIF/WebP بالأحجام المناسبة وتحميل كسول)، مع بديل هادئ عند عدم وجود صورة
export function ProductImage({ src, alt, sizes, priority = false, className = "", imgClassName = "" }: {
  src?: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  imgClassName?: string;
}) {
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-cream ${className}`} role="img" aria-label={alt}>
        <svg viewBox="0 0 40 40" className="h-1/4 w-1/4 text-gold/50" aria-hidden="true">
          <path d="M8 25.5c0-2.2 1.6-3.8 3.8-3.8h16.4c2.2 0 3.8 1.6 3.8 3.8V29H8z" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M12 21.7v-3.2c0-1.7 1.3-3 3-3h10c1.7 0 3 1.3 3 3v3.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </div>
    );
  }
  return (
    <div className={`relative overflow-hidden bg-cream ${className}`}>
      <Image src={src} alt={alt} fill sizes={sizes} preload={priority} fetchPriority={priority ? "high" : undefined}
        className={`object-cover ${imgClassName}`} />
    </div>
  );
}
