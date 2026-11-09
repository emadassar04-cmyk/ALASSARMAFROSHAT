"use client";

// خطأ في تحميل بيانات المتجر (مثلاً انقطاع الاتصال): رسالة واضحة وزر إعادة المحاولة
export default function StoreError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="shell max-w-xl py-24 text-center">
      <h1 className="text-title">تعذر تحميل الصفحة</h1>
      <p className="mt-3 text-muted-ink">تحقق من اتصالك بالإنترنت ثم أعد المحاولة.</p>
      <button type="button" onClick={reset} className="btn btn-primary mt-8">إعادة المحاولة</button>
    </div>
  );
}
