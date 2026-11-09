import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { getDict } from "@/lib/admin/i18n";
import { Card, PageHeader } from "@/components/admin/ui";
import { PaymentToggle, ZoneForm } from "./Forms";

export const instant = false;

export default async function DeliverySettings() {
  const staff = await requireStaff();
  const t = getDict(staff.locale), S = t.set;
  const supabase = await createClient();
  const [{ data: zones }, { data: methods }] = await Promise.all([
    supabase.from("delivery_zones").select("id, name, fee, eta_text, sort_order, is_active").order("sort_order").order("name"),
    supabase.from("payment_methods").select("code, name_ar, is_enabled").order("sort_order"),
  ]);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={S.deliveryTitle} />
      <Card title={S.zones} bodyClass="">
        <p className="border-b border-[var(--a-line)] px-5 py-3 text-sm text-[var(--a-muted-ink)]">{S.zonesHint}</p>
        <div className="divide-y divide-[var(--a-line)]">{(zones ?? []).map((z) => <ZoneForm key={z.id} zone={{ ...z, fee: String(z.fee) }} />)}</div>
        <div className="border-t border-dashed border-[var(--a-line)] bg-[#fcfbf8]"><p className="px-5 pt-4 text-sm font-semibold">{S.newZone}</p><ZoneForm /></div>
      </Card>
      <Card title={S.payments} bodyClass="">
        <p className="border-b border-[var(--a-line)] px-5 py-3 text-sm text-[var(--a-muted-ink)]">{S.paymentsHint}</p>
        <div className="divide-y divide-[var(--a-line)]">{(methods ?? []).map((m) => <PaymentToggle key={m.code} code={m.code} name={m.name_ar} enabled={m.is_enabled} />)}</div>
      </Card>
    </div>
  );
}
