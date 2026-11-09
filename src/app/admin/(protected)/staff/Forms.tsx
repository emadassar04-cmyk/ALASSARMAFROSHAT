"use client";
import { useActionState } from "react";
import { useI18n } from "@/components/admin/I18nProvider";
import { inviteStaff, saveRolePermissions, updateStaff } from "./actions";

type Role = { code: string; name: string };

export function InviteForm({ roles }: { roles: Role[] }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(inviteStaff, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="block min-w-0 flex-1 sm:max-w-xs"><span className="a-label">{t.staff.email}</span>
        <input name="email" type="email" required dir="ltr" placeholder="name@gmail.com" className="a-input" /></label>
      <label className="block"><span className="a-label">{t.staff.role}</span>
        <select name="role" defaultValue="viewer" className="a-input w-auto">{roles.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}</select></label>
      <button disabled={pending} className="a-btn a-btn-primary">{t.staff.inviteBtn}</button>
      {state.error && <p role="alert" className="w-full text-sm text-[var(--a-danger-ink)]">{t.staff.err[state.error] ?? t.staff.err.generic}</p>}
      {state.ok && <p role="status" className="w-full text-sm text-[var(--a-success)]">{t.staff.invited}</p>}
    </form>
  );
}

export function StaffRow({ id, role, active, roles }: { id: string; role: string; active: boolean; roles: Role[] }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(updateStaff, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select name="role" defaultValue={role} className="a-input h-9 min-h-0 w-auto py-1" aria-label={t.staff.role}>{roles.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}</select>
      <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="active" defaultChecked={active} />{t.staff.active}</label>
      <button disabled={pending} className="a-btn a-btn-ghost h-9 min-h-0">{t.common.save}</button>
      {state.error && <span role="alert" className="text-xs text-[var(--a-danger-ink)]">{t.staff.err[state.error] ?? t.staff.err.generic}</span>}
      {state.ok && <span role="status" className="text-xs text-[var(--a-success)]">✓</span>}
    </form>
  );
}

// صف دور في مصفوفة الصلاحيات (المدير العام مقفل)
export function RolePermissions({ role, name, members, granted, all, locked }: {
  role: string; name: string; members: number; granted: string[]; all: string[]; locked: boolean;
}) {
  const { t, f } = useI18n();
  const [state, action, pending] = useActionState(saveRolePermissions, {});
  return (
    <form action={action} className="grid gap-3 px-5 py-4 lg:grid-cols-[13rem_minmax(0,1fr)_auto] lg:items-start">
      <input type="hidden" name="role" value={role} />
      <div>
        <p className="font-semibold">{name}</p>
        <p className="text-xs text-[var(--a-muted-ink)]">{f.number(members)} {t.staff.members}</p>
        {locked && <p className="mt-1 text-xs text-[var(--a-accent-ink)]">{t.staff.locked}</p>}
      </div>
      <fieldset disabled={locked} className="grid gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
        <legend className="sr-only">{name}</legend>
        {all.map((p) => (
          <label key={p} className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="perm" value={p} defaultChecked={locked || granted.includes(p)} className="mt-1 accent-[var(--a-sidebar)]" />
            <span>{t.staff.perm[p] ?? p}</span>
          </label>
        ))}
      </fieldset>
      {!locked && (
        <div className="flex items-center gap-2">
          <button disabled={pending} className="a-btn a-btn-ghost">{t.common.save}</button>
          {state.error && <span role="alert" className="text-xs text-[var(--a-danger-ink)]">{t.staff.err[state.error] ?? t.staff.err.generic}</span>}
          {state.ok && <span role="status" className="text-xs text-[var(--a-success)]">✓</span>}
        </div>
      )}
    </form>
  );
}
