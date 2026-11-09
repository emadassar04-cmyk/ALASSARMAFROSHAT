"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { canonicalPhone, formatPhone } from "@/lib/phone";
import { formatPrice } from "@/lib/format";
import { recordSale, type SaleResult } from "./actions";

type Branch = { id: string; name: string };
const BRANCH_KEY = "alassar:sales-branch";

// نموذج سريع (15–20 ثانية): جوال + مبلغ + فرع. معرّف الطلب يمنع التكرار عند الضغط مرتين أو إعادة الإرسال.
export function SaleForm({ branches }: { branches: Branch[] }) {
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

  const field = "block w-full rounded-xl border border-gold/30 bg-white px-4 py-3.5 text-lg focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20";
  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); submit(false); }} className="space-y-4 rounded-2xl border border-gold/20 bg-white p-5 shadow-sm">
        <label className="block space-y-1.5">
          <span className="block text-sm font-medium">رقم جوال الزبون *</span>
          <input ref={phoneRef} value={phone} onChange={(e) => { setPhone(e.target.value); setResult(null); }} autoFocus required
            type="tel" inputMode="tel" autoComplete="off" dir="ltr" placeholder="0599 123 456" className={`${field} text-left tabular-nums`}
            aria-invalid={phone.length > 6 && !phoneOk ? true : undefined} />
          {phone.length > 6 && !phoneOk && <span className="block text-sm text-red-700">رقم غير مكتمل أو غير صحيح</span>}
        </label>
        <label className="block space-y-1.5">
          <span className="block text-sm font-medium">المبلغ الإجمالي (₪) *</span>
          <input value={amount} onChange={(e) => { setAmount(e.target.value); setResult(null); }} required
            inputMode="decimal" autoComplete="off" dir="ltr" placeholder="0.00" className={`${field} text-left tabular-nums`} />
        </label>
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">الفرع *</legend>
          <div className="grid grid-cols-2 gap-2">
            {branches.map((b) => (
              <label key={b.id} className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-3.5 text-center font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold ${branchId === b.id ? "border-charcoal bg-charcoal text-white" : "border-gold/30 bg-white hover:border-gold"}`}>
                <input type="radio" name="branch" value={b.id} checked={branchId === b.id} onChange={() => setBranchId(b.id)} className="sr-only" />
                {b.name}
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" disabled={pending || !phoneOk || !amountOk || !branchId}
          className="w-full rounded-xl bg-charcoal px-4 py-4 text-lg font-bold text-white transition-opacity disabled:opacity-40">
          {pending ? "جارٍ التسجيل…" : "تسجيل عملية البيع"}
        </button>
        <p className="text-xs leading-5 opacity-70">
          أخبر الزبون أن رقم جواله يُستخدم لربط مشترياته من الفرعين والمتجر الإلكتروني، وللمشاركة في حملة السحب وفق شروطها.
          لا يحتاج الزبون رقم فاتورة.
        </p>
      </form>

      {result?.ok && (
        <div role="status" className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900">
          <p className="text-lg font-bold">✓ {result.replayed ? "سُجّلت هذه العملية مسبقاً" : "تم تسجيل عملية البيع"}</p>
          <p className="mt-1">{formatPrice(result.amount)} · {result.branch} · <span dir="ltr">{formatPhone(result.phone)}</span></p>
          <p className="mt-1 text-sm">{result.newCustomer ? "زبون جديد: أُنشئ سجله" : "زبون موجود: أُضيفت العملية إلى سجله"} — بانتظار اعتماد الإدارة.</p>
        </div>
      )}
      {result && !result.ok && (
        <div role="alert" className="space-y-3 rounded-2xl border border-red-300 bg-red-50 p-4 text-red-900">
          <p>{result.error}</p>
          {result.duplicate && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => submit(true)} disabled={pending} className="rounded-lg bg-charcoal px-4 py-2 text-white">نعم، عملية جديدة</button>
              <button type="button" onClick={() => { setResult(null); setPhone(""); setAmount(""); setRequestId(crypto.randomUUID()); }} className="rounded-lg border border-red-300 px-4 py-2">لا، إلغاء</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
