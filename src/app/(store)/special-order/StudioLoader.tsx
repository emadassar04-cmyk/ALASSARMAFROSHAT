"use client";
import dynamic from "next/dynamic";
import type { ProductType } from "@/lib/custom-order/spec";

// الاستوديو يعمل في المتصفح فقط (يقرأ المسودة المحفوظة في الجلسة)، ويُعاد تركيبه عند اختيار نوع من البطاقات
const Studio = dynamic(() => import("./Studio").then((m) => m.Studio), {
  ssr: false,
  loading: () => <div className="space-y-6" aria-busy="true"><div className="skeleton h-14 rounded-full" /><div className="skeleton h-96 rounded-[var(--radius-card)]" /></div>,
});

export function StudioLoader(props: { whatsapp: string | null; initialType?: ProductType; productHint?: string }) {
  return <Studio key={props.initialType ?? "none"} {...props} />;
}
