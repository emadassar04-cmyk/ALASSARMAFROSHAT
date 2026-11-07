import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { formatPrice } from "@/lib/format";
import { TierSelect } from "./TierSelect";

export const instant = false;

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().replace(/[%_,()]/g, "").slice(0, 40) : "";
  const tier = typeof sp.tier === "string" && ["regular", "loyal", "vip"].includes(sp.tier) ? sp.tier : "";
  const supabase = await createClient();
  let query = supabase.from("customers").select("id, name, phone, tier, marketing_consent, created_at, last_order_at, orders(total, status)")
    .order("last_order_at", { ascending: false, nullsFirst: false }).limit(300);
  if (q) query = /^\d+$/.test(q.replace(/\D/g, "")) && q.replace(/\D/g, "").length >= 3 ? query.ilike("phone", `%${q.replace(/\D/g, "")}%`) : query.ilike("name", `%${q}%`);
  if (tier) query = query.eq("tier", tier);
  const { data } = await query;
  type Row = { id: string; name: string; phone: string; tier: string; marketing_consent: boolean; last_order_at: string | null; orders: { total: string; status: string }[] };
  const rows = (data ?? []) as Row[];
  const canManage = staff.permissions.includes("orders.manage");

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <h1 className="text-2xl font-bold">العملاء</h1>
      <p className="text-sm opacity-80">يُحفظ العميل تلقائياً عند أول طلب (حتى دون حساب). التصنيف VIP يفعّل كوبونات VIP.</p>
      <form className="flex flex-wrap gap-2 text-sm">
        <input name="q" defaultValue={q} placeholder="الاسم أو رقم الهاتف" className="rounded-lg border border-gold/30 px-3 py-2" />
        <select name="tier" defaultValue={tier} className="rounded-lg border border-gold/30 px-3 py-2"><option value="">كل التصنيفات</option><option value="vip">VIP</option><option value="loyal">دائم</option><option value="regular">عادي</option></select>
        <button className="rounded-lg border border-gold/30 bg-white px-3 py-2">بحث</button>
      </form>
      {rows.length === 0 ? <p className="rounded-2xl border border-dashed border-gold/40 bg-white p-8 text-center">لا عملاء مطابقون.</p> : (
        <div className="overflow-x-auto rounded-2xl border border-gold/20 bg-white">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="bg-beige/60"><tr><th className="p-2 text-start">العميل</th><th className="p-2 text-start">الهاتف</th><th className="p-2">الطلبات المكتملة/الكل</th><th className="p-2">إجمالي المشتريات</th><th className="p-2">يقبل العروض</th><th className="p-2">التصنيف</th></tr></thead>
            <tbody>{rows.map((c) => {
              const valid = c.orders.filter((o) => o.status !== "cancelled" && !["received", "awaiting_confirmation"].includes(o.status));
              return (
                <tr key={c.id} className="border-t border-gold/10">
                  <td className="p-2">{c.name}</td>
                  <td className="p-2"><Link href={`/admin/orders?q=${c.phone}`} dir="ltr" className="text-gold-dark hover:underline">{c.phone}</Link></td>
                  <td className="p-2 text-center">{c.orders.filter((o) => o.status === "delivered").length}/{c.orders.length}</td>
                  <td className="p-2 text-center">{formatPrice(valid.reduce((s, o) => s + Number(o.total), 0))}</td>
                  <td className="p-2 text-center">{c.marketing_consent ? "نعم" : "لا"}</td>
                  <td className="p-2 text-center">{canManage ? <TierSelect id={c.id} tier={c.tier} /> : c.tier}</td>
                </tr>);
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
