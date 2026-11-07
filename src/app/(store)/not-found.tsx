import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">الصفحة غير موجودة</h1>
      <p className="mt-2 opacity-70">ربما نُقل المنتج أو انتهى عرضه.</p>
      <Link href="/products" className="mt-6 inline-block rounded-full bg-gold px-6 py-2.5 text-white hover:bg-gold-dark">تصفح المنتجات</Link>
    </div>
  );
}
