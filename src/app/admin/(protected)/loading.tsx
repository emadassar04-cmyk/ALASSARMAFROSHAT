// يظهر فوراً عند التنقل بين صفحات الإدارة بينما تُجلب البيانات
export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-4" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-beige" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white" />)}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-white" />
    </div>
  );
}
