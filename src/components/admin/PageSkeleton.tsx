// هيكل الصفحة أثناء التحميل: يظهر فور الضغط على أي رابط (يُجلب مسبقاً مع الرابط)، ثم تتدفق البيانات مكانه.
// لا نص ولا لغة هنا عمداً: الهيكل ثابت يُبنى مسبقاً ويُخدم من الشبكة القريبة.
export function PageSkeleton({ variant = "list" }: { variant?: "list" | "dashboard" | "form" }) {
  const bar = "rounded-lg bg-[#ece8df]";
  return (
    <div className="mx-auto max-w-[90rem] animate-pulse motion-reduce:animate-none" aria-busy="true">
      <span className="sr-only">جارٍ التحميل · Loading…</span>
      <div className="mb-6 space-y-2">
        <div className={`${bar} h-8 w-56`} />
        <div className={`${bar} h-4 w-80 max-w-full`} />
      </div>
      {variant === "dashboard" && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => <div key={i} className="a-card h-[7.5rem]" />)}
        </div>
      )}
      {variant === "form" ? (
        <div className="a-card space-y-4 p-5">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className={`${bar} h-10`} />)}
        </div>
      ) : (
        <div className="a-card overflow-hidden">
          <div className="border-b border-[var(--a-line)] p-4"><div className={`${bar} h-9 w-full max-w-md`} /></div>
          {Array.from({ length: variant === "dashboard" ? 4 : 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-[#f1eee8] px-5 py-4 last:border-0">
              <div className={`${bar} h-4 w-24`} /><div className={`${bar} h-4 flex-1`} /><div className={`${bar} h-4 w-20`} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
