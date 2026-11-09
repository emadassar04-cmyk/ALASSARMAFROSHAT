"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useI18n } from "@/components/admin/I18nProvider";
import { deleteProduct } from "./actions";

// حذف مع تأكيد؛ المنتج الذي له تاريخ (طلبات/مخزون) يُرفض في قاعدة البيانات ويُقترح أرشفته
export function DeleteProduct({ id, compact = false }: { id: string; compact?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" disabled={pending} aria-label={t.common.delete} title={t.common.delete}
        onClick={() => {
          if (!window.confirm(t.products.deleteConfirm)) return;
          start(async () => {
            const r = await deleteProduct(id);
            if (r.ok) { setMsg(null); router.refresh(); }
            else setMsg(r.error === "history" ? t.products.deleteHasHistory : r.error === "forbidden" ? t.errors.forbidden : t.errors.generic);
          });
        }}
        className={`a-btn a-btn-danger ${compact ? "h-8 min-h-0 w-8 px-0" : ""}`}>
        <Trash2 aria-hidden="true" className="h-4 w-4" />{!compact && t.common.delete}
      </button>
      {msg && <span role="alert" className="max-w-[16rem] text-xs text-[var(--a-danger-ink)]">{msg}</span>}
    </span>
  );
}
