"use client";

// خطأ في تحميل بيانات المتجر (مثلاً انقطاع الاتصال): رسالة واضحة وزر إعادة المحاولة
export default function StoreError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">تعذر تحميل الصفحة</h1>
      <p className="mt-2 opacity-70">تحقق من اتصالك بالإنترنت ثم أعد المحاولة.</p>
      <button type="button" onClick={reset} className="mt-6 rounded-full bg-gold px-6 py-2.5 text-white hover:bg-gold-dark">إعادة المحاولة</button>
    </div>
  );
}
