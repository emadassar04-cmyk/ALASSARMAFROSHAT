"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Bell, CircleAlert, Info, TriangleAlert } from "lucide-react";
import { loadNotifications, type Notice } from "@/app/admin/(protected)/shell-actions";
import { useI18n } from "../I18nProvider";
import { iconBtn, popPanel, usePopover } from "./usePopover";

const TONE = {
  critical: { Icon: CircleAlert, cls: "bg-[#fdf0f0] text-[var(--a-danger-ink)]" },
  warning: { Icon: TriangleAlert, cls: "bg-[#fbf3e6] text-[var(--a-warning)]" },
  info: { Icon: Info, cls: "bg-[#eef3f8] text-[#2f5d8a]" },
} as const;

// مركز الإشعارات: من بيانات حقيقية (طلبات تنتظر، تحويلات، مخزون، مبيعات فروع). يتحدث عند كل فتح.
export function NotificationsMenu({ initial }: { initial: Notice[] }) {
  const { t, f } = useI18n();
  const { open, setOpen, ref, button } = usePopover();
  const [items, setItems] = useState(initial);
  const [, start] = useTransition();
  const count = items.length;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) start(async () => setItems(await loadNotifications()));
  }

  return (
    <div ref={ref} className="relative">
      <button ref={button} type="button" onClick={toggle} aria-expanded={open} className={iconBtn}
        aria-label={`${t.header.notifications}${items.length ? ` (${items.length})` : ""}`}>
        <Bell aria-hidden="true" strokeWidth={1.8} className="h-[1.1rem] w-[1.1rem]" />
        {items.length > 0 && (
          <span aria-hidden="true" className="absolute -top-1 -end-1 grid h-[1.15rem] min-w-[1.15rem] place-items-center rounded-full bg-[var(--a-danger)] px-1 text-[0.625rem] font-bold text-white ring-2 ring-[var(--a-bg)]">
            {count}
          </span>
        )}
      </button>
      {open && (
        <div className={`${popPanel} w-[min(22rem,calc(100vw-2rem))]`}>
          <p className="border-b border-[var(--a-line)] px-4 py-3 text-sm font-bold">{t.header.notifications}</p>
          {items.length === 0 ? <p className="px-4 py-8 text-center text-sm text-[var(--a-muted-ink)]">{t.header.noNotifications}</p> : (
            <ul className="max-h-[60vh] overflow-y-auto p-2">
              {items.map((n) => {
                const tone = TONE[n.severity] ?? TONE.info;
                return (
                  <li key={n.kind}>
                    <Link href={n.href} onClick={() => setOpen(false)} className="flex items-start gap-3 rounded-[10px] p-2.5 hover:bg-[#f7f5f0]">
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tone.cls}`}><tone.Icon aria-hidden="true" className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1 text-sm leading-6">{t.notify[n.kind as keyof typeof t.notify] ?? n.kind}</span>
                      <span className="mt-1 rounded-full bg-[#f1eee8] px-2 py-0.5 text-xs font-bold tabular-nums">{f.number(n.count)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
