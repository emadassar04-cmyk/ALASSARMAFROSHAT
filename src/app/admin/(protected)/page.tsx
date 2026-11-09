import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { formatPrice } from "@/lib/format";
import { ORDER_STATUS_LABEL } from "@/lib/catalog-types";
import type { Kpis } from "@/lib/admin/finance";
import { Kpi } from "@/components/admin/Kpi";
import { signOutEverywhere } from "../actions";

export const instant = false;

type Dashboard = {
  finance_visible: boolean; today: Kpis | null; month: Kpis | null;
  status_counts: Record<string, number>; pending_transfers: number; expiring_soon: number;
  low_stock: { id: string; name: string; available: number; threshold: number }[];
  top_month: { name: string; qty: number; revenue: number }[] | null;
  recent: { id: string; order_number: string; status: string; total: number; created_at: string }[];
};

const ATTENTION = ["received", "awaiting_confirmation", "confirmed", "preparing", "ready_for_pickup", "out_for_delivery"];

export default async function AdminHome() {
  const staff = await requireStaff();
  // موظف الفرع (تسجيل المبيعات فقط) يذهب مباشرة إلى صفحة التسجيل
  if (!staff.permissions.includes("orders.read")) {
    redirect(staff.permissions.includes("sales.record") ? "/admin/sales" : "/admin/login?error=not_staff");
  }
  const supabase = await createClient();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Gaza" }).format(await Promise.resolve(new Date()));
  const [{ data, error }, { data: sales }] = await Promise.all([
    supabase.rpc("admin_dashboard"),
    staff.permissions.includes("sales.review")
      ? supabase.rpc("purchases_summary", { p_from: `${today.slice(0, 8)}01`, p_to: today })
      : Promise.resolve({ data: null }),
  ]);
  const d = data as Dashboard | null;
  const store = sales as { store_pending: { count: number; amount: number }; store_approved: { count: number; amount: number } } | null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold">لوحة المعلومات</h1>
        <p className="text-sm opacity-70">مرحباً {staff.full_name ?? ""}</p>
      </div>
      {store && (
        <section aria-label="مبيعات الفروع" className="grid gap-3 sm:grid-cols-2">
          <Link href="/admin/purchases?source=store&status=pending" className={`rounded-2xl border p-4 ${store.store_pending.count ? "border-amber-300 bg-amber-50" : "border-gold/20 bg-white"}`}>
            <p className="text-sm opacity-80">مبيعات فروع بانتظار اعتمادك</p>
            <p className="mt-1 text-xl font-bold">{store.store_pending.count} عملية · {formatPrice(store.store_pending.amount)}</p>
          </Link>
          <Link href="/admin/purchases?source=store&status=completed" className="rounded-2xl border border-gold/20 bg-white p-4">
            <p className="text-sm opacity-80">مبيعات الفروع المعتمدة هذا الشهر (منفصلة عن أرباح الطلبات)</p>
            <p className="mt-1 text-xl font-bold">{store.store_approved.count} عملية · {formatPrice(store.store_approved.amount)}</p>
          </Link>
        </section>
      )}
      {error || !d ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">تعذر تحميل لوحة المعلومات.</p> : (
        <>
          {(d.pending_transfers > 0 || d.expiring_soon > 0 || d.low_stock.length > 0) && (
            <section aria-label="يحتاج انتباهك" className="space-y-2">
              {d.expiring_soon > 0 && <Alert href="/admin/orders?status=received">⏳ {d.expiring_soon} طلب ينتهي حجزه خلال 30 دقيقة — أكّدها أو تواصل مع الزبون</Alert>}
              {d.pending_transfers > 0 && <Alert href="/admin/orders">🏦 {d.pending_transfers} تحويل بنكي بانتظار المراجعة</Alert>}
              {d.low_stock.length > 0 && <Alert href="/admin/inventory">⚠️ {d.low_stock.length} منتج مخزونه منخفض</Alert>}
            </section>
          )}

          {d.finance_visible && d.today && d.month && (
            <>
              <section aria-labelledby="today" className="space-y-2">
                <h2 id="today" className="font-bold">اليوم</h2>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Kpi label="المبيعات المؤكدة" value={d.today.revenue} />
                  <Kpi label="عدد الطلبات المؤكدة" value={d.today.orders} money={false} />
                  <Kpi label="صافي ربحك" value={d.today.manager_net} />
                  <Kpi label="مستحقات المحل" value={d.today.store_due}
                    hint={d.today.items_missing_profit ? `${d.today.items_missing_profit} بند بلا ربح مسجل` : undefined}
                    tone={d.today.items_missing_profit ? "warn" : undefined} />
                </div>
              </section>
              <section aria-labelledby="month" className="space-y-2">
                <div className="flex items-end justify-between">
                  <h2 id="month" className="font-bold">هذا الشهر</h2>
                  <Link href="/admin/reports" className="text-sm text-gold-dark hover:underline">التقارير التفصيلية</Link>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Kpi label="المبيعات المؤكدة" value={d.month.revenue} />
                  <Kpi label="عدد الطلبات" value={d.month.orders} money={false} />
                  <Kpi label="صافي ربحك (بعد المصروفات)" value={d.month.manager_net} />
                  <Kpi label="مستحقات المحل" value={d.month.store_due}
                    hint={d.month.items_missing_profit ? `${d.month.items_missing_profit} بند بلا ربح مسجل` : undefined}
                    tone={d.month.items_missing_profit ? "warn" : undefined} />
                </div>
              </section>
            </>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <section className="rounded-2xl border border-gold/20 bg-white p-4">
              <h2 className="mb-3 font-bold">الطلبات حسب الحالة</h2>
              <ul className="space-y-1 text-sm">
                {ATTENTION.map((s) => (
                  <li key={s}><Link href={`/admin/orders?status=${s}`} className="flex justify-between hover:text-gold-dark">
                    <span>{ORDER_STATUS_LABEL[s]}</span><span className="font-medium">{d.status_counts[s] ?? 0}</span></Link></li>
                ))}
                <li className="flex justify-between border-t border-gold/10 pt-1 opacity-70"><span>مُسلَّمة (30 يوماً)</span><span>{d.status_counts.delivered ?? 0}</span></li>
                <li className="flex justify-between opacity-70"><span>ملغاة (30 يوماً)</span><span>{d.status_counts.cancelled ?? 0}</span></li>
              </ul>
            </section>
            <section className="rounded-2xl border border-gold/20 bg-white p-4">
              <h2 className="mb-3 font-bold">أحدث الطلبات</h2>
              {d.recent.length === 0 ? <p className="text-sm opacity-70">لا طلبات بعد.</p> : (
                <ul className="space-y-1 text-sm">
                  {d.recent.map((o) => (
                    <li key={o.id}><Link href={`/admin/orders/${o.id}`} className="flex justify-between gap-2 hover:text-gold-dark">
                      <span dir="ltr">{o.order_number}</span><span className="opacity-70">{ORDER_STATUS_LABEL[o.status]}</span><span>{formatPrice(o.total)}</span></Link></li>
                  ))}
                </ul>
              )}
            </section>
            {d.top_month && (
              <section className="rounded-2xl border border-gold/20 bg-white p-4">
                <h2 className="mb-3 font-bold">الأكثر مبيعاً هذا الشهر</h2>
                {d.top_month.length === 0 ? <p className="text-sm opacity-70">لا مبيعات مؤكدة بعد.</p> : (
                  <ol className="space-y-1 text-sm">{d.top_month.map((p) => (
                    <li key={p.name} className="flex justify-between gap-2"><span>{p.name}</span><span className="opacity-70">{p.qty} قطعة · {formatPrice(p.revenue)}</span></li>))}
                  </ol>
                )}
              </section>
            )}
            <section className="rounded-2xl border border-gold/20 bg-white p-4">
              <h2 className="mb-3 font-bold">تنبيهات المخزون</h2>
              {d.low_stock.length === 0 ? <p className="text-sm opacity-70">لا منتجات تحت حد التنبيه.</p> : (
                <ul className="space-y-1 text-sm">{d.low_stock.map((p) => (
                  <li key={p.id}><Link href={`/admin/products/${p.id}`} className="flex justify-between hover:text-gold-dark">
                    <span>{p.name}</span><span className={p.available <= 0 ? "font-medium text-red-700" : "text-amber-700"}>المتاح {p.available}</span></Link></li>))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}

      <section className="rounded-2xl border border-gold/20 bg-white p-4 text-sm">
        <h2 className="mb-2 font-bold">الجلسة</h2>
        <p>الحساب: <span dir="ltr">{staff.email}</span> · {staff.role_name} · التحقق بخطوتين مفعّل ✓</p>
        <form action={signOutEverywhere} className="mt-3">
          <button className="rounded-lg border border-red-300 px-3 py-1.5 text-red-800 hover:bg-red-50">إنهاء كل الجلسات على كل الأجهزة</button>
        </form>
      </section>
    </div>
  );
}

function Alert({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="block rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 hover:bg-amber-100">{children}</Link>;
}
