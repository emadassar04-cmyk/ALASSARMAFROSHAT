"use client";
import { ChevronDown, LogOut, ShieldCheck } from "lucide-react";
import { signOut, signOutEverywhere } from "@/app/admin/actions";
import { useI18n } from "../I18nProvider";
import { popPanel, usePopover } from "./usePopover";
import type { ShellUser } from "./AdminShell";

function initials(name: string) {
  const parts = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "؟") + (parts[1]?.[0] ?? "");
}

export function UserMenu({ user }: { user: ShellUser }) {
  const { t } = useI18n();
  const { open, setOpen, ref, button } = usePopover();
  return (
    <div ref={ref} className="relative">
      <button ref={button} type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={t.header.account}
        className="flex h-10 items-center gap-2 rounded-[10px] border border-[var(--a-line)] bg-white ps-1 pe-1 sm:pe-2.5 hover:border-[#d5cfc2]">
        <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--a-sidebar)] text-xs font-bold text-[var(--a-accent-2)]">{initials(user.name)}</span>
        <span className="hidden max-w-[9rem] text-start leading-tight md:block">
          <span className="block truncate text-[0.8125rem] font-semibold">{user.name}</span>
          <span className="block truncate text-[0.6875rem] text-[var(--a-muted-ink)]">{user.role}</span>
        </span>
        <ChevronDown aria-hidden="true" className="hidden h-4 w-4 text-[var(--a-muted)] sm:block" />
      </button>
      {open && (
        <div className={`${popPanel} w-64 p-2`}>
          <div className="border-b border-[var(--a-line)] px-3 pb-3 pt-1">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p dir="ltr" className="truncate text-end text-xs text-[var(--a-muted-ink)] rtl:text-start">{user.email}</p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#edf7f2] px-2 py-0.5 text-[0.6875rem] font-semibold text-[var(--a-success)]">
              <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />{t.header.mfaOn}
            </p>
          </div>
          <form action={signOut}>
            <button className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[#f7f5f0]">
              <LogOut aria-hidden="true" className="h-4 w-4" />{t.header.signOut}
            </button>
          </form>
          <form action={signOutEverywhere}>
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--a-danger-ink)] hover:bg-[#fdf3f3]">
              <LogOut aria-hidden="true" className="h-4 w-4" />{t.header.signOutAll}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
