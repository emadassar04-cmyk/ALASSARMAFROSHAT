import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, can } from "@/lib/staff";
import { getDict, fmt } from "@/lib/admin/i18n";
import { Card, PageHeader } from "@/components/admin/ui";
import { InviteForm, RolePermissions, StaffRow } from "./Forms";

export const instant = false;

type Overview = {
  staff: { id: string; name: string | null; email: string; role: string | null; role_name: string | null; active: boolean; is_me: boolean }[];
  invites: { email: string; role: string; created_at: string }[];
};
type Roles = {
  permissions: { code: string; description: string }[];
  roles: { code: string; name: string; name_en: string | null; locked: boolean; members: number; permissions: string[] }[];
};

export default async function StaffPage() {
  const staff = await requireStaff();
  if (!can(staff, "staff.manage")) redirect("/admin");
  const t = getDict(staff.locale), f = fmt(staff.locale);
  const supabase = await createClient();
  const [{ data }, { data: rolesData }] = await Promise.all([supabase.rpc("staff_overview"), supabase.rpc("admin_roles")]);
  const o = (data ?? { staff: [], invites: [] }) as Overview;
  const r = (rolesData ?? { permissions: [], roles: [] }) as Roles;
  const roleName = (code: string | null) => {
    const x = r.roles.find((y) => y.code === code);
    return x ? (staff.locale === "en" ? x.name_en ?? x.name : x.name) : code ?? "";
  };
  const assignable = r.roles.filter((x) => !x.locked).map((x) => ({ code: x.code, name: roleName(x.code) }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title={t.staff.title} subtitle={t.staff.subtitle} />
      <Card title={t.staff.invite}>
        <p className="mb-4 text-sm leading-6 text-[var(--a-muted-ink)]">{t.staff.inviteHelp}</p>
        <InviteForm roles={assignable} />
        {o.invites.length > 0 && (
          <div className="mt-4 text-sm"><p className="a-label">{t.staff.pendingInvites}</p>
            <ul className="space-y-1">{o.invites.map((i) => <li key={i.email} className="flex flex-wrap gap-2"><span dir="ltr">{i.email}</span><span className="text-[var(--a-muted-ink)]">· {roleName(i.role)} · {f.date(i.created_at)}</span></li>)}</ul></div>
        )}
      </Card>
      <Card title={t.staff.accounts} bodyClass="">
        <ul className="divide-y divide-[var(--a-line)]">
          {o.staff.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-lg bg-[#f5efe3] text-sm font-bold text-[var(--a-accent-ink)]">{(s.name ?? s.email).trim()[0]?.toUpperCase()}</span>
                <div>
                  <p className="font-semibold">{s.name ?? s.email} {s.is_me && <span className="text-xs font-normal text-[var(--a-muted-ink)]">({t.staff.you})</span>}</p>
                  <p dir="ltr" className="text-end text-xs text-[var(--a-muted-ink)] rtl:text-start">{s.email}</p>
                </div>
              </div>
              {s.role === "owner" || s.is_me
                ? <span className="text-sm">{roleName(s.role)}{s.active ? "" : ` (${t.staff.suspended})`}</span>
                : <StaffRow id={s.id} role={s.role ?? "viewer"} active={s.active} roles={assignable} />}
            </li>
          ))}
        </ul>
      </Card>
      <Card title={t.staff.rolesTitle} bodyClass="">
        <p className="border-b border-[var(--a-line)] px-5 py-3 text-sm text-[var(--a-muted-ink)]">{t.staff.rolesHint}</p>
        <div className="divide-y divide-[var(--a-line)]">
          {r.roles.map((x) => (
            <RolePermissions key={x.code} role={x.code} name={roleName(x.code)} members={x.members} granted={x.permissions}
              all={r.permissions.map((p) => p.code)} locked={x.locked} />
          ))}
        </div>
      </Card>
    </div>
  );
}
