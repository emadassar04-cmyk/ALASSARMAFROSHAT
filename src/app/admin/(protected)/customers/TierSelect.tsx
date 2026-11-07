"use client";
import { useTransition } from "react";
import { setTier } from "./actions";

export function TierSelect({ id, tier }: { id: string; tier: string }) {
  const [pending, start] = useTransition();
  return (
    <select defaultValue={tier} disabled={pending} aria-label="تصنيف العميل" className="rounded-md border border-gold/30 px-2 py-1 text-sm"
      onChange={(e) => start(async () => { await setTier(id, e.target.value as "regular" | "loyal" | "vip"); })}>
      <option value="regular">عادي</option><option value="loyal">دائم</option><option value="vip">VIP</option>
    </select>
  );
}
