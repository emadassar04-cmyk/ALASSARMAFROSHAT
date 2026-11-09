import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { InviteForm, StaffRow } from "./Forms";

export const instant = false;

type Overview = {
  staff: { id: string; name: string | null; email: string; role: string | null; role_name: string | null; active: boolean; is_me: boolean }[];
  invites: { email: string; role: string; created_at: string }[];
  roles: { code: string; name: string }[];
};

const ROLE_HELP: Record<string, string> = {
  reception: "يسجّل مبيعات الفرع فقط (رقم الجوال + المبلغ + الفرع)",
  inventory: "بلا صلاحيات حالياً",
  fulfilment: "بلا صلاحيات حالياً",
  reports: "بلا صلاحيات حالياً",
};

export default async function StaffPage() {
  const staff = await requireStaff();
  if (!staff.permissions.includes("staff.manage")) redirect("/admin");
  const supabase = await createClient();
  const { data } = await supabase.rpc("staff_overview");
  const o = (data ?? { staff: [], invites: [], roles: [] }) as Overview;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <h1 className="text-2xl font-bold">الموظفون</h1>
      <section className="space-y-3 rounded-2xl border border-gold/20 bg-white p-5">
        <h2 className="text-lg font-bold">دعوة موظف</h2>
        <p className="text-sm leading-6 opacity-80">
          الموظف يحتاج حساب Google وتطبيق مصادقة على جواله (مثل Google Authenticator). بعد الدعوة يدخل من صفحة الإدارة،
          ويرى فقط ما يسمح به دوره. {Object.entries(ROLE_HELP).map(([k, v]) => `«${o.roles.find((r) => r.code === k)?.name ?? k}»: ${v}`).join(" · ")}
        </p>
        <InviteForm roles={o.roles} />
        {o.invites.length > 0 && (
          <div className="text-sm"><p className="mb-1 font-medium">دعوات لم تُستخدم بعد:</p>
            <ul className="space-y-1">{o.invites.map((i) => <li key={i.email} dir="ltr" className="text-right">{i.email} — {o.roles.find((r) => r.code === i.role)?.name ?? i.role}</li>)}</ul></div>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-bold">الحسابات</h2>
        <ul className="divide-y divide-gold/15 rounded-2xl border border-gold/20 bg-white">
          {o.staff.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{s.name ?? s.email} {s.is_me && <span className="text-xs opacity-60">(أنت)</span>}</p>
                <p dir="ltr" className="text-right text-xs opacity-70">{s.email}</p>
              </div>
              {s.role === "owner" || s.is_me
                ? <span className="text-sm">{s.role_name}{s.active ? "" : " (موقوف)"}</span>
                : <StaffRow id={s.id} role={s.role ?? "reception"} active={s.active} roles={o.roles} />}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
