import Link from "next/link";

export default function NotFound() {
  return (
    <div className="shell max-w-xl py-24 text-center">
      <p className="font-display text-6xl text-gold" aria-hidden="true">404</p>
      <h1 className="mt-4 text-title">الصفحة غير موجودة</h1>
      <p className="mt-3 text-muted-ink">ربما نُقل المنتج أو انتهى عرضه. تصفّح أقسام المتجر لتجد ما تبحث عنه.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/products" className="btn btn-primary">تصفح المنتجات</Link>
        <Link href="/" className="btn btn-outline">الصفحة الرئيسية</Link>
      </div>
    </div>
  );
}
