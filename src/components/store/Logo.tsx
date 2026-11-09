// شعار نصي مؤقت حتى يتوفر الشعار الرسمي: علامة هندسية + اسم المحل
export function Logo({ tone = "dark", compact = false }: { tone?: "dark" | "light"; compact?: boolean }) {
  const light = tone === "light";
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg viewBox="0 0 40 40" aria-hidden="true" className="h-9 w-9 shrink-0 sm:h-10 sm:w-10">
        <rect width="40" height="40" rx="10" fill={light ? "var(--warm-white)" : "var(--charcoal)"} />
        <path d="M10 25.5c0-2.2 1.6-3.8 3.8-3.8h12.4c2.2 0 3.8 1.6 3.8 3.8V29H10z" fill="none" stroke="var(--gold)" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M13.5 21.7v-3.2c0-1.7 1.3-3 3-3h7c1.7 0 3 1.3 3 3v3.2" fill="none" stroke="var(--gold)" strokeWidth="1.6" />
        <path d="M12 29v2.5M28 29v2.5" stroke="var(--gold)" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span className="leading-none">
        <span className={`block font-display text-[1.15rem] sm:text-[1.3rem] ${light ? "text-warm-white" : "text-charcoal"}`}>مفروشات العصار</span>
        {!compact && (
          <span dir="ltr" className={`mt-1 block text-[0.6rem] font-medium tracking-[0.22em] ${light ? "text-gold-soft" : "text-gold-ink"}`}>ALASSAR FURNITURE</span>
        )}
      </span>
    </span>
  );
}
