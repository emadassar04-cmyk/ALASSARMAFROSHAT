import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { PaymentToggle, ZoneForm } from "./Forms";

export const instant = false;

export default async function DeliverySettings() {
  await requireStaff();
  const supabase = await createClient();
  const [{ data: zones }, { data: methods }] = await Promise.all([
    supabase.from("delivery_zones").select("id, name, fee, eta_text, sort_order, is_active").order("sort_order").order("name"),
    supabase.from("payment_methods").select("code, name_ar, is_enabled").order("sort_order"),
  ]);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">التوصيل والدفع</h1>
      <section className="space-y-3">
        <h2 className="text-lg font-bold">مناطق التوصيل ورسومها</h2>
        <p className="text-sm opacity-70">تظهر المناطق الفعّالة للزبون في صفحة إتمام الطلب. ألغِ تفعيل منطقة لإخفائها دون حذفها.</p>
        {(zones ?? []).map((z) => <ZoneForm key={z.id} zone={{ ...z, fee: String(z.fee) }} />)}
        <div><h3 className="mb-2 text-sm font-medium">＋ منطقة جديدة</h3><ZoneForm /></div>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-bold">طرق الدفع</h2>
        <p className="text-sm opacity-70">التحويل البنكي: بيانات الحساب تُرسل للزبون عبر WhatsApp ولا تظهر في الموقع.</p>
        {(methods ?? []).map((m) => <PaymentToggle key={m.code} code={m.code} name={m.name_ar} enabled={m.is_enabled} />)}
      </section>
    </div>
  );
}
