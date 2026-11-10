"use client";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { TOAST_EVENT, type ToastTone } from "@/lib/toast";

type Item = { id: number; message: string; tone: ToastTone };
const ICONS = { success: CheckCircle2, info: Info, error: AlertCircle };

export function Toaster() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    let n = 0;
    const on = (e: Event) => {
      const { message, tone } = (e as CustomEvent<Omit<Item, "id">>).detail;
      const id = ++n;
      setItems((l) => [...l.slice(-2), { id, message, tone }]);
      window.setTimeout(() => setItems((l) => l.filter((i) => i.id !== id)), 3200);
    };
    window.addEventListener(TOAST_EVENT, on);
    return () => window.removeEventListener(TOAST_EVENT, on);
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4 md:bottom-8">
      {items.map(({ id, message, tone }) => {
        const Icon = ICONS[tone];
        return (
          <p key={id} className="pointer-events-auto flex animate-toast items-center gap-3 rounded-full border border-white/10 bg-charcoal/95 py-3 ps-4 pe-5 text-sm text-ivory shadow-lift backdrop-blur">
            <Icon aria-hidden="true" strokeWidth={1.5} className={`h-5 w-5 shrink-0 ${tone === "error" ? "text-[#e59a8e]" : "text-gold-light"}`} />
            {message}
          </p>
        );
      })}
    </div>
  );
}
