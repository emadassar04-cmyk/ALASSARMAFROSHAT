"use client";
import { useActionState } from "react";
import { useI18n } from "@/components/admin/I18nProvider";
import { saveBranch } from "./actions";

type Branch = { id: string; name: string; city: string | null; address: string | null; phone: string | null; map_url: string | null; lat: number | null; lng: number | null; is_default: boolean };
const local = (p: string | null) => (p ? p.replace(/^\+97[02]/, "0") : "");

export function BranchForm({ branch }: { branch: Branch }) {
  const { t, tx } = useI18n();
  const S = t.set;
  const [state, action, pending] = useActionState(saveBranch, {});
  return (
    <form action={action} className="a-card space-y-4 p-5">
      <input type="hidden" name="id" value={branch.id} />
      <div className="flex items-center gap-2">
        <h2 className="text-lg">{branch.name}</h2>
        {branch.is_default && <span className="rounded-full bg-[var(--a-sidebar)] px-2.5 py-0.5 text-xs font-semibold text-white">{S.mainBranch}</span>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="a-label">{S.branchName}</span><input name="name" required dir="auto" defaultValue={branch.name} className="a-input" /></label>
        <label className="block"><span className="a-label">{S.city}</span><input name="city" dir="auto" defaultValue={branch.city ?? ""} className="a-input" /></label>
        <label className="block"><span className="a-label">{S.address}</span><input name="address" dir="auto" defaultValue={branch.address ?? ""} placeholder={S.addressPh} className="a-input" /></label>
        <label className="block"><span className="a-label">{S.phone}</span><input name="phone" dir="ltr" inputMode="tel" defaultValue={local(branch.phone)} placeholder="0594793301" className="a-input" /></label>
      </div>
      <label className="block">
        <span className="a-label">{S.mapUrl}</span>
        <input name="map_url" dir="ltr" defaultValue={branch.map_url ?? ""} placeholder="https://maps.app.goo.gl/..." className="a-input" />
        <span className="mt-1 block text-xs text-[var(--a-muted-ink)]">{S.mapHint}</span>
      </label>
      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-[var(--a-accent-ink)]">{S.coords}{branch.lat !== null ? ` — ${S.current}: ${branch.lat}, ${branch.lng}` : ""}</summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="a-label">{S.lat}</span><input name="lat" dir="ltr" inputMode="decimal" defaultValue={branch.lat ?? ""} className="a-input" /></label>
          <label className="block"><span className="a-label">{S.lng}</span><input name="lng" dir="ltr" inputMode="decimal" defaultValue={branch.lng ?? ""} className="a-input" /></label>
        </div>
        <p className="mt-1 text-xs text-[var(--a-muted-ink)]">{S.coordsHint}</p>
      </details>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="a-btn a-btn-primary">{pending ? S.saving : t.common.save}</button>
        {state.error && <p role="alert" className="text-sm text-[var(--a-danger-ink)]">{tx(state.error)}</p>}
        {state.ok && <p role="status" className="text-sm text-[var(--a-success)]">{S.saved}{state.note ? ` — ${tx(state.note)}` : ""}</p>}
      </div>
    </form>
  );
}
