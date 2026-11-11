"use client";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Boxes, ChartColumn, ChevronLeft, ClipboardCheck, FolderTree, Gift, History, LayoutDashboard, MapPin, Megaphone,
  Menu, Package, Plug, ShoppingBag, Sofa, Store, TicketPercent, TrendingUp, Truck, UserCog, Users, Wallet, X, Ruler } from "lucide-react";
import type { NavIcon } from "@/lib/admin/nav";
import { useI18n } from "../I18nProvider";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationsMenu } from "./NotificationsMenu";
import { LanguageToggle } from "./LanguageToggle";
import { UserMenu } from "./UserMenu";
import type { Notice } from "@/app/admin/(protected)/shell-actions";

const ICONS: Record<NavIcon, typeof Package> = {
  dashboard: LayoutDashboard, orders: ShoppingBag, custom: Ruler, sale: Store, purchases: ClipboardCheck, customers: Users,
  products: Package, categories: FolderTree, inventory: Boxes, coupons: TicketPercent, expenses: Wallet,
  profits: TrendingUp, reports: ChartColumn, campaigns: Gift, marketing: Megaphone, staff: UserCog,
  activity: History, delivery: Truck, branches: MapPin, integrations: Plug,
};

export type ShellItem = { href: string; label: string; icon: NavIcon; group: string; strong?: boolean };
export type ShellUser = { name: string; email: string; role: string };

const COOKIE = "admin-nav";

// مؤشر صغير على الرابط المضغوط حتى يكتمل الانتقال (ويُظهر شريط التقدم العلوي عبر CSS)
function Pending() {
  const { pending } = useLinkStatus();
  return pending ? <span data-nav-pending aria-hidden="true" className="ms-auto h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[var(--a-accent)]" /> : null;
}

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

  // قائمة مسطحة بفواصل رفيعة بين المجموعات، والقسم الحالي بشريط ذهبي
  const nav = (compact: boolean) => (
    <nav aria-label={t.nav.dashboard} className="flex-1 overflow-y-auto px-3 py-3 [scrollbar-width:thin]">
      {Object.keys(groups).map((g, gi) => {
        const list = items.filter((i) => i.group === g);
        if (!list.length) return null;
        return (
          <div key={g}>
            {gi > 0 && <div className="mx-3 my-2.5 h-px bg-white/[0.07]" aria-hidden="true" />}
            <ul className="space-y-1">
              {list.map((i) => {
                const Icon = ICONS[i.icon];
                const current = i.href === active;
                return (
                  <li key={i.href}>
                    <Link href={i.href} aria-current={current ? "page" : undefined} title={compact ? i.label : undefined}
                      className={`group relative flex items-center gap-3 rounded-[10px] px-3.5 py-2.5 text-[0.875rem] transition-colors duration-200 ${compact ? "justify-center px-0" : ""} ${current
                        ? "bg-white/[0.07] font-medium text-[#f7f6f2] before:absolute before:inset-y-2 before:start-0 before:w-[3px] before:rounded-full before:bg-[var(--a-accent)]"
                        : "text-[#c9c6bd] hover:bg-white/[0.04] hover:text-[#f7f6f2]"}`}>
                      <Icon aria-hidden="true" strokeWidth={1.5} className={`h-[1.15rem] w-[1.15rem] shrink-0 transition-colors ${current ? "text-[var(--a-accent-2)]" : i.strong ? "text-[var(--a-accent-2)]" : "text-[#a9a497] group-hover:text-[#f7f6f2]"}`} />
                      {compact ? <span className="sr-only">{i.label}</span> : <span className="min-w-0 flex-1 truncate">{i.label}</span>}
                      <Pending />
                      {!compact && <ChevronLeft aria-hidden="true" strokeWidth={1.5} className={`h-4 w-4 shrink-0 transition-[opacity,transform] duration-200 ltr:rotate-180 ${current ? "text-[var(--a-accent-2)] opacity-80" : "opacity-0 group-hover:-translate-x-0.5 group-hover:opacity-50 ltr:group-hover:translate-x-0.5"}`} />}
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
      <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--a-accent)]/45 text-[var(--a-accent-2)]">
        <Sofa strokeWidth={1.4} className="h-5 w-5" />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[1rem] font-medium text-[#f7f6f2]">{locale === "en" ? "Al Assar" : "مفروشات العصار"}</span>
          <span className="mt-0.5 block text-[0.5625rem] font-medium tracking-[0.3em] text-[var(--a-accent-2)]/80">AL ASSAR FURNITURE</span>
        </span>
      )}
    </Link>
  );

  // بطاقة سفلية: رابط المتجر (معلومة حقيقية، لا وعود دعم وهمية)
  const storeCard = (compact: boolean) => (
    <Link href="/" target="_blank" className={`flex items-center gap-3 rounded-[12px] border border-white/[0.08] p-3 text-[#c9c6bd] transition-colors hover:border-[var(--a-accent)]/50 hover:text-[#f7f6f2] ${compact ? "justify-center" : ""}`}>
      <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--a-accent)]/12 text-[var(--a-accent-2)]"><Store strokeWidth={1.5} className="h-[1.1rem] w-[1.1rem]" /></span>
      {compact ? <span className="sr-only">{t.header.storeCard}</span> : (
        <span className="min-w-0 leading-tight">
          <span className="block text-sm font-medium">{t.header.storeCard}</span>
          <span className="block truncate text-[0.6875rem] text-[#a9a497]">{t.header.storeCardSub}</span>
        </span>
      )}
    </Link>
  );

  return (
    <div className="flex min-h-dvh">
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[90] focus:rounded-md focus:bg-white focus:p-3">{t.header.skip}</a>

      {/* القائمة الجانبية (شاشات كبيرة) */}
      <aside className={`sticky top-0 hidden h-dvh shrink-0 flex-col bg-[var(--a-sidebar)] transition-[width] duration-200 lg:flex print:hidden ${collapsed ? "w-[5rem]" : "w-[17rem]"}`}>
        <div className="flex h-[4.75rem] items-center">{brand(collapsed)}</div>
        {nav(collapsed)}
        <div className="p-3">{storeCard(collapsed)}</div>
      </aside>

      {/* القائمة في الجوال والتابلت: نافذة جانبية أصلية (تحبس التركيز وتغلق بـ Esc) */}
      <dialog ref={drawer} onClose={() => setOpen(false)} aria-label={t.nav.openMenu}
        onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        className="m-0 h-dvh max-h-none w-[17.5rem] max-w-[85vw] bg-[var(--a-sidebar)] p-0 backdrop:bg-black/40 open:flex open:flex-col lg:hidden ms-0 me-auto">
        <div className="flex h-[4.75rem] items-center justify-between pe-3">
          {brand(false)}
          <button type="button" onClick={() => setOpen(false)} aria-label={t.nav.closeMenu} className="grid h-10 w-10 place-items-center rounded-lg text-white/80 hover:bg-white/10">
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        {nav(false)}
        <div className="p-3">{storeCard(false)}</div>
      </dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-[var(--a-line)] bg-[#fbfaf7]/90 backdrop-blur-xl print:hidden">
          <div aria-hidden="true" className="nav-progress" />
          <div className="flex h-[4.5rem] items-center gap-2 px-4 sm:gap-3 sm:px-6">
            {/* زر القائمة: يطوي القائمة الجانبية في الشاشات الكبيرة، ويفتحها في الجوال */}
            <button type="button" onClick={() => setOpen(true)} aria-label={t.nav.openMenu}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--a-text)] hover:bg-[#f1efe9] lg:hidden">
              <Menu aria-hidden="true" strokeWidth={1.5} className="h-5 w-5" />
            </button>
            <button type="button" onClick={toggle} aria-label={collapsed ? t.nav.expand : t.nav.collapse} aria-expanded={!collapsed}
              className="hidden h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--a-text)] hover:bg-[#f1efe9] lg:grid">
              <Menu aria-hidden="true" strokeWidth={1.5} className="h-5 w-5" />
            </button>
            <div className="flex min-w-0 flex-1 justify-center"><GlobalSearch /></div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <LanguageToggle />
              <NotificationsMenu initial={notices} />
              <UserMenu user={user} />
            </div>
          </div>
        </header>
        <main id="admin-main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
