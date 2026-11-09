"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { canonicalPhone, formatPhone } from "@/lib/phone";
import { recordSale, type SaleResult } from "./actions";
import { useI18n } from "@/components/admin/I18nProvider";

type Branch = { id: string; name: string };
const BRANCH_KEY = "alassar:sales-branch";

// نموذج سريع (15–20 ثانية): جوال + مبلغ + فرع. معرّف الطلب يمنع التكرار عند الضغط مرتين أو إعادة الإرسال.
export function SaleForm({ branches }: { branches: Branch[] }) {
  const { t, tx, f } = useI18n();
  const S = t.sale;
  const router = useRouter();
  const phoneRef = useRef<HTMLInputElement>(null);
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [branchId, setBranchId] = useState(branches.length === 1 ? branches[0].id : "");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [result, setResult] = useState<SaleResult | null>(null);
  const [pending, start] = useTransition();

  // الفرع الأخير يُحفظ على الجهاز (جهاز كل فرع يتذكر فرعه)
  useEffect(() => {
    const saved = localStorage.getItem(BRANCH_KEY);
    if (saved && branches.some((b) => b.id === saved)) setBranchId(saved); // eslint-disable-line react-hooks/set-state-in-effect -- قراءة تفضيل محفوظ مرة واحدة
  }, [branches]);

  const phoneOk = canonicalPhone(phone);
  const amountOk = /^\d{1,7}([.,]\d{1,2})?$/.test(amount.trim()) && Number(amount.replace(",", ".")) > 0;

  function submit(confirmDuplicate = false) {
    if (pending) return;
    start(async () => {
      const res = await recordSale({ phone, amount, branchId, requestId, confirmDuplicate });
      setResult(res);
      if (res.ok) {
        localStorage.setItem(BRANCH_KEY, branchId);
        setPhone("");
        setAmount("");
        setRequestId(crypto.randomUUID()); // العملية التالية بمعرّف جديد
        router.refresh();
        phoneRef.current?.focus();
      }
    });
  }

  const field = "a-input h-auto py-3.5 text-lg";
  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); submit(false); }} className="a-card space-y-4 p-5">
        <label className="block space-y-1.5">
          <span className="block text-sm font-semibold">{S.phone}</span>
          <input ref={phoneRef} value={phone} onChange={(e) => { setPhone(e.target.value); setResult(null); }} autoFocus required
            type="tel" inputMode="tel" autoComplete="off" dir="ltr" placeholder="0599 123 456" className={`${field} text-left tabular-nums`}
            aria-invalid={phone.length > 6 && !phoneOk ? true : undefined} />
          {phone.length > 6 && !phoneOk && <span className="block text-sm text-[var(--a-danger-ink)]">{S.badPhone}</span>}
        </label>
        <label className="block space-y-1.5">
          <span className="block text-sm font-semibold">{S.amount}</span>
          <input value={amount} onChange={(e) => { setAmount(e.target.value); setResult(null); }} required
            inputMode="decimal" autoComplete="off" dir="ltr" placeholder="0.00" className={`${field} text-left tabular-nums`} />
        </label>
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-semibold">{S.branch}</legend>
          <div className="grid grid-cols-2 gap-2">
            {branches.map((b) => (
              <label key={b.id} className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-3.5 text-center font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold ${branchId === b.id ? "border-[var(--a-sidebar)] bg-[var(--a-sidebar)] text-white" : "border-[var(--a-line)] bg-white hover:border-[var(--a-accent)]"}`}>
                <input type="radio" name="branch" value={b.id} checked={branchId === b.id} onChange={() => setBranchId(b.id)} className="sr-only" />
                {b.name}
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" disabled={pending || !phoneOk || !amountOk || !branchId}
          className="a-btn a-btn-primary w-full py-4 text-lg">
          {pending ? S.saving : S.submit}
        </button>
        <p className="text-xs leading-5 text-[var(--a-muted-ink)]">{S.consent}</p>
      </form>

      {result?.ok && (
        <div role="status" className="a-card border-[#bfe3d1] bg-[#f1faf5] p-4 text-[#0f5c3e]">
          <p className="text-lg font-bold">✓ {result.replayed ? S.replayed : S.done}</p>
          <p className="mt-1">{f.money(result.amount)} · {result.branch} · <span dir="ltr">{formatPhone(result.phone)}</span></p>
          <p className="mt-1 text-sm">{result.newCustomer ? S.newCustomer : S.existing} — {S.awaiting}</p>
        </div>
      )}
      {result && !result.ok && (
        <div role="alert" className="a-card space-y-3 border-[#f0c9c9] bg-[#fdf5f5] p-4 text-[#8f2a2a]">
          <p>{tx(result.error)}</p>
          {result.duplicate && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => submit(true)} disabled={pending} className="a-btn a-btn-primary">{S.yesNew}</button>
              <button type="button" onClick={() => { setResult(null); setPhone(""); setAmount(""); setRequestId(crypto.randomUUID()); }} className="a-btn a-btn-danger">{S.noCancel}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
