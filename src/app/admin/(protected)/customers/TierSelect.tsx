"use client";
import { useTransition } from "react";
import { useI18n } from "@/components/admin/I18nProvider";
import { setTier } from "./actions";

export function TierSelect({ id, tier }: { id: string; tier: string }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <select defaultValue={tier} disabled={pending} aria-label={t.customers.tier} className="a-input h-9 min-h-0 w-auto py-1"
      onChange={(e) => start(async () => { await setTier(id, e.target.value as "regular" | "loyal" | "vip"); })}>
      {(["regular", "loyal", "vip"] as const).map((k) => <option key={k} value={k}>{t.customers.tiers[k]}</option>)}
    </select>
  );
}
