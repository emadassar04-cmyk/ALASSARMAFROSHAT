// شعار مؤقت: رمز أريكة مع اسم المحل (يُستبدل بالشعار النهائي لاحقاً)
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 48 48" aria-hidden="true" className="h-9 w-9 shrink-0">
        <rect width="48" height="48" rx="12" fill="var(--gold)" />
        <path d="M10 27c0-3 2-5 5-5h18c3 0 5 2 5 5v6H10z" fill="#fff" opacity=".95" />
        <path d="M14 22v-3c0-2 1.5-3.5 3.5-3.5h13c2 0 3.5 1.5 3.5 3.5v3" fill="none" stroke="#fff" strokeWidth="2.4" />
        <path d="M13 33v4M35 33v4" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <span className="leading-tight">
        <span className="block text-lg font-bold text-gold-dark">مفروشات العصار</span>
        {!compact && <span className="block text-xs opacity-70">دير البلح – النصيرات</span>}
      </span>
    </span>
  );
}
