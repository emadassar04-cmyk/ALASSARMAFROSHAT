import Image from "next/image";

// صورة منتج محسّنة (WebP/AVIF وتحميل كسول)، مع بديل أنيق عند عدم وجود صورة
export function ProductImage({ src, alt, sizes, priority = false, className = "" }: {
  src?: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-beige ${className}`} role="img" aria-label={alt}>
        <svg viewBox="0 0 48 48" className="h-1/3 w-1/3 opacity-30" aria-hidden="true">
          <path d="M8 28c0-3 2-5 5-5h22c3 0 5 2 5 5v7H8z" fill="var(--gold)" />
          <path d="M12 23v-4c0-2 2-4 4-4h16c2 0 4 2 4 4v4" fill="none" stroke="var(--gold)" strokeWidth="2.5" />
        </svg>
      </div>
    );
  }
  return (
    <div className={`relative overflow-hidden bg-beige ${className}`}>
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
    </div>
  );
}
