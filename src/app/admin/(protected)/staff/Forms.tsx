"use client";
import { useActionState } from "react";
import { inviteStaff, updateStaff } from "./actions";

type Role = { code: string; name: string };
const field = "rounded-md border border-gold/30 bg-white px-3 py-2 text-sm";

export function InviteForm({ roles }: { roles: Role[] }) {
  const [state, action, pending] = useActionState(inviteStaff, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <label className="space-y-1 text-sm"><span className="block font-medium">بريد Google للموظف</span>
        <input name="email" type="email" required dir="ltr" placeholder="name@gmail.com" className={`${field} w-64`} /></label>
      <label className="space-y-1 text-sm"><span className="block font-medium">الدور</span>
        <select name="role" defaultValue="reception" className={field}>{roles.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}</select></label>
      <button disabled={pending} className="rounded-md bg-charcoal px-4 py-2 text-sm text-white disabled:opacity-50">دعوة</button>
      {state.error && <p role="alert" className="w-full text-sm text-red-700">{state.error}</p>}
      {state.ok && <p role="status" className="w-full text-sm text-emerald-700">تمت الدعوة ✓ — يدخل الموظف من صفحة الإدارة بحساب Google هذا، ثم يفعّل التحقق بخطوتين.</p>}
    </form>
  );
}

export function StaffRow({ id, role, active, roles }: { id: string; role: string; active: boolean; roles: Role[] }) {
  const [state, action, pending] = useActionState(updateStaff, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select name="role" defaultValue={role} className={`${field} py-1`} aria-label="الدور">{roles.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}</select>
      <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="active" defaultChecked={active} />نشط</label>
      <button disabled={pending} className="rounded-md border border-gold/40 px-3 py-1 text-sm">حفظ</button>
      {state.error && <span role="alert" className="text-xs text-red-700">{state.error}</span>}
      {state.ok && <span role="status" className="text-xs text-emerald-700">✓</span>}
    </form>
  );
}
