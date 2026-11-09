"use client";
import { Printer } from "lucide-react";
import { useI18n } from "./I18nProvider";

export function PrintButton({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <button type="button" onClick={() => window.print()} className="a-btn a-btn-primary print:hidden">
      <Printer aria-hidden="true" className="h-4 w-4" />{label ?? t.common.print}
    </button>
  );
}
