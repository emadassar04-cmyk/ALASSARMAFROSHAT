"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Boxes, ChartColumn, ClipboardCheck, ExternalLink, FolderTree, Gift, History, LayoutDashboard, MapPin, Megaphone,
  Menu, Package, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Plug, ShoppingBag, Store,
  TicketPercent, TrendingUp, Truck, UserCog, Users, Wallet, X,
} from "lucide-react";
import type { NavIcon } from "@/lib/admin/nav";
import { useI18n } from "../I18nProvider";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationsMenu } from "./NotificationsMenu";
import { LanguageToggle } from "./LanguageToggle";
import { UserMenu } from "./UserMenu";
import type { Notice } from "@/app/admin/(protected)/shell-actions";

const ICONS: Record<NavIcon, typeof Package> = {
  dashboard: LayoutDashboard, orders: ShoppingBag, sale: Store, purchases: ClipboardCheck, customers: Users,
  products: Package, categories: FolderTree, inventory: Boxes, coupons: TicketPercent, expenses: Wallet,
  profits: TrendingUp, reports: ChartColumn, campaigns: Gift, marketing: Megaphone, staff: UserCog,
  activity: History, delivery: Truck, branches: MapPin, integrations: Plug,
};

export type ShellItem = { href: string; label: string; icon: NavIcon; group: string; strong?: boolean };
export type ShellUser = { name: string; email: string; role: string };

const COOKIE = "admin-nav";

function activeHref(path: string, items: ShellItem[]) {
  return items.map((i) => i.href).filter((h) => (h === "/admin" ? path === "/admin" : path === h || path.startsWith(h + "/")))
    .sort((a, b) => b.length - a.length)[0];
}

export function AdminShell({ items, groups, user, collapsed: initialCollapsed, notices, children }: {
  items: ShellItem[]; groups: Record<string, string>; user: ShellUser; collapsed: boolean; notices: Notice[]; children: React.ReactNode;
}) {
  const { t, locale } = useI18n();
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [open, setOpen] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const active = activeHref(path, items);
  const title = items.find((i) => i.href === active)?.label ?? t.nav.dashboard;
  const rtl = t.meta.dir === "rtl";

  // إغلاق القائمة الجانبية في الجوال عند الانتقال لصفحة أخرى
  useEffect(() => { drawer.current?.close(); }, [path]);
  useEffect(() => {
    const d = drawer.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${COOKIE}=${next ? "collapsed" : "open"}; path=/admin; max-age=31536000; samesite=lax`;
  }
  const CollapseIcon = rtl ? (collapsed ? PanelRightOpen : PanelRightClose) : (collapsed ? PanelLeftOpen : PanelLeftClose);

  const nav = (compact: boolean) => (
    <nav aria-label={t.nav.dashboard} className="flex-1 overflow-y-auto px-3 py-4 [scrollbar-width:thin]">
      {Object.entries(groups).map(([g, label]) => {
        const list = items.filter((i) => i.group === g);
        if (!list.length) return null;
        return (
          <div key={g} className="mb-5">
            {!compact && <p className="mb-2 px-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-[#8b909a]">{label}</p>}
            {compact && <div className="mx-auto mb-2 h-px w-6 bg-white/10" aria-hidden="true" />}
            <ul className="space-y-0.5">
              {list.map((i) => {
                const Icon = ICONS[i.icon];
                const current = i.href === active;
                return (
                  <li key={i.href}>
                    <Link href={i.href} aria-current={current ? "page" : undefined} title={compact ? i.label : undefined}
                      className={`group relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[0.875rem] transition-colors ${compact ? "justify-center" : ""} ${current ? "bg-white/[0.08] font-semibold text-white" : "text-[#c3c7cf] hover:bg-white/[0.05] hover:text-white"}`}>
                      {current && <span aria-hidden="true" className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-[var(--a-accent)]" />}
                      <Icon aria-hidden="true" strokeWidth={1.7} className={`h-[1.15rem] w-[1.15rem] shrink-0 ${current ? "text-[var(--a-accent)]" : i.strong ? "text-[var(--a-accent-2)]" : ""}`} />
                      {compact ? <span className="sr-only">{i.label}</span> : <span className="truncate">{i.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  const brand = (compact: boolean) => (
    <Link href="/admin" className={`flex items-center gap-3 px-5 ${compact ? "justify-center px-0" : ""}`}>
      <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-[var(--a-accent-2)] to-[var(--a-accent)] font-bold text-[var(--a-sidebar)]">
        {locale === "en" ? "A" : "ع"}
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[0.9375rem] font-bold text-white">{t.meta.brand}</span>
          <span className="block text-[0.6875rem] text-[#8b909a]">{t.meta.brandSub}</span>
        </span>
      )}
    </Link>
  );

  return (
    <div className="flex min-h-dvh">
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[90] focus:rounded-md focus:bg-white focus:p-3">{t.header.skip}</a>

      {/* القائمة الجانبية (شاشات كبيرة) */}
      <aside className={`sticky top-0 hidden h-dvh shrink-0 flex-col bg-[var(--a-sidebar)] transition-[width] duration-200 lg:flex print:hidden ${collapsed ? "w-[4.75rem]" : "w-[16.5rem]"}`}>
        <div className="flex h-[4.25rem] items-center border-b border-white/[0.06]">{brand(collapsed)}</div>
        {nav(collapsed)}
        <div className="border-t border-white/[0.06] p-3">
          <Link href="/" target="_blank" className={`flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm text-[#c3c7cf] hover:bg-white/[0.05] hover:text-white ${collapsed ? "justify-center" : ""}`}>
            <ExternalLink aria-hidden="true" strokeWidth={1.7} className="h-4 w-4" />{!collapsed && t.common.openStore}{collapsed && <span className="sr-only">{t.common.openStore}</span>}
          </Link>
          <button type="button" onClick={toggle} aria-label={collapsed ? t.nav.expand : t.nav.collapse} aria-expanded={!collapsed}
            className={`mt-1 flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-sm text-[#c3c7cf] hover:bg-white/[0.05] hover:text-white ${collapsed ? "justify-center" : ""}`}>
            <CollapseIcon aria-hidden="true" strokeWidth={1.7} className="h-4 w-4" />{!collapsed && t.nav.collapse}
          </button>
        </div>
      </aside>

      {/* القائمة في الجوال والتابلت: نافذة جانبية أصلية (تحبس التركيز وتغلق بـ Esc) */}
      <dialog ref={drawer} onClose={() => setOpen(false)} aria-label={t.nav.openMenu}
        onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        className="m-0 h-dvh max-h-none w-[17.5rem] max-w-[85vw] bg-[var(--a-sidebar)] p-0 backdrop:bg-black/40 open:flex open:flex-col lg:hidden ms-0 me-auto">
        <div className="flex h-[4.25rem] items-center justify-between border-b border-white/[0.06] pe-3">
          {brand(false)}
          <button type="button" onClick={() => setOpen(false)} aria-label={t.nav.closeMenu} className="grid h-10 w-10 place-items-center rounded-lg text-white/80 hover:bg-white/10">
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        {nav(false)}
      </dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-[var(--a-line)] bg-[var(--a-bg)]/90 backdrop-blur-md print:hidden">
          <div className="flex h-[4.25rem] items-center gap-2 px-4 sm:gap-3 sm:px-6">
            <button type="button" onClick={() => setOpen(true)} aria-label={t.nav.openMenu}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] border border-[var(--a-line)] bg-white lg:hidden">
              <Menu aria-hidden="true" strokeWidth={1.8} className="h-5 w-5" />
            </button>
            <p className="hidden min-w-0 items-center gap-2 truncate text-sm text-[var(--a-muted-ink)] sm:flex"><span>{t.meta.brandSub}</span><span aria-hidden="true">/</span><span className="truncate font-semibold text-[var(--a-text)]">{title}</span></p>
            <div className="ms-auto flex items-center gap-1.5 sm:gap-2">
              <GlobalSearch />
              <NotificationsMenu initial={notices} />
              <LanguageToggle />
              <UserMenu user={user} />
            </div>
          </div>
        </header>
        <main id="admin-main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
