import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { formatPrice } from "@/lib/format";
import { CouponForm, ToggleCoupon } from "./Forms";

export const instant = false;
const dt = (s: string | null) => s ? new Date(s).toLocaleString("ar", { numberingSystem: "latn", timeZone: "Asia/Gaza", dateStyle: "short", timeStyle: "short" }) : "—";

export default async function CouponsPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase.from("coupons")
    .select("*, coupon_usages(amount, orders(status))").order("created_at", { ascending: false });
  type Row = { id: string; code: string; kind: string; value: string; max_discount: string | null; min_order_amount: string;
    max_uses: number | null; max_uses_per_customer: number | null; vip_only: boolean; starts_at: string | null; ends_at: string | null;
    is_active: boolean; coupon_usages: { amount: string; orders: { status: string } | null }[] };
  const rows = (data ?? []) as Row[];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <h1 className="text-2xl font-bold">الكوبونات والعروض</h1>
      <p className="text-sm opacity-80">
        يتحقق الخادم من صلاحية الكوبون وقيمته عند كل طلب (لا يُعتمد على المتصفح). الطلبات الملغاة لا تُحتسب من حد الاستخدام.
        لعرض بسعر مخفض لفترة محددة على منتج، استخدم «سعر الخصم» وتواريخه في صفحة المنتج.
      </p>
      <section className="space-y-2"><h2 className="font-bold">كوبون جديد</h2><CouponForm /></section>
      <section className="space-y-3">
        <h2 className="font-bold">الكوبونات</h2>
        {rows.length === 0 ? <p className="rounded-2xl border border-dashed border-gold/40 bg-white p-8 text-center">لا كوبونات بعد.</p> : rows.map((c) => {
          const used = c.coupon_usages.filter((u) => u.orders?.status !== "cancelled");
          return (
            <details key={c.id} className="rounded-2xl border border-gold/20 bg-white p-4">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                <b dir="ltr">{c.code}</b>
                <span className="text-sm">{c.kind === "percent" ? `${Number(c.value)}%` : formatPrice(c.value)}{c.vip_only ? " · VIP" : ""}</span>
                <span className="text-sm opacity-70">استُخدم {used.length}{c.max_uses ? ` من ${c.max_uses}` : ""} · خصم إجمالي {formatPrice(used.reduce((s, u) => s + Number(u.amount), 0))}</span>
                <span className="text-xs opacity-60">{c.starts_at || c.ends_at ? `${dt(c.starts_at)} ← ${dt(c.ends_at)}` : "بلا تاريخ انتهاء"}</span>
                <span className="ms-auto"><ToggleCoupon id={c.id} active={c.is_active} /></span>
              </summary>
              <div className="mt-3"><CouponForm c={{ ...c, value: String(c.value), max_discount: c.max_discount && String(c.max_discount), min_order_amount: String(c.min_order_amount) }} /></div>
            </details>
          );
        })}
      </section>
    </div>
  );
}
