"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { LoaderCircle, Package, Search, ShoppingBag, User } from "lucide-react";
import { searchAdmin, type SearchResults } from "@/app/admin/(protected)/shell-actions";
import { useI18n } from "../I18nProvider";
import { iconBtn, popPanel, usePopover } from "./usePopover";

// بحث شامل بالطلبات والعملاء والمنتجات (النتائج مقيدة بصلاحياتك في قاعدة البيانات)
export function GlobalSearch() {
  const { t, f } = useI18n();
  const { open, setOpen, ref, button } = usePopover();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<SearchResults | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const last = useRef("");

  useEffect(() => {
    const v = q.trim();
    if (v.length < 2) return;
    const timer = setTimeout(() => {
      last.current = v;
      start(async () => {
        const r = await searchAdmin(v);
        if (last.current === v) setRes(r);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  // اختصار لوحة المفاتيح: / أو Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest("input, textarea, select, [contenteditable]");
      if ((e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault(); setOpen(true); setTimeout(() => input.current?.focus(), 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  // النتائج تُعرض فقط إن طابقت نص البحث الحالي (لا إعادة ضبط داخل useEffect)
  const shown = q.trim().length >= 2 ? res : null;
  const total = shown ? shown.orders.length + shown.customers.length + shown.products.length : 0;
  const row = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-[#f7f5f0] focus:bg-[#f7f5f0] focus:outline-none";
  const close = () => { setOpen(false); setQ(""); };

  return (
    <div ref={ref} className="relative md:w-full md:max-w-xl">
      <button ref={button} type="button" className={`${iconBtn} md:flex md:h-11 md:w-full md:justify-start md:gap-2.5 md:overflow-hidden md:border-transparent md:bg-[#f5f3ee] md:px-4 md:text-sm md:text-[var(--a-muted-ink)] md:hover:bg-[#efece5]`}
        aria-label={t.header.searchLabel} aria-expanded={open} onClick={() => { setOpen(true); setTimeout(() => input.current?.focus(), 0); }}>
        <Search aria-hidden="true" strokeWidth={1.8} className="h-[1.1rem] w-[1.1rem] shrink-0" />
        <span className="hidden truncate md:inline">{t.header.searchPlaceholder}</span>
      </button>
      {open && (
        <div role="search" className={`${popPanel} w-[min(32rem,calc(100vw-2rem))] p-2 md:end-auto md:start-0 md:w-full`}>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--a-muted)]" />
            <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.header.searchPlaceholder}
              aria-label={t.header.searchLabel} aria-controls={listId} className="a-input ps-9" maxLength={60} />
            {pending && <LoaderCircle aria-hidden="true" className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--a-muted)]" />}
          </div>
          <div id={listId} aria-live="polite" className="mt-2 max-h-[60vh] overflow-y-auto">
            {q.trim().length < 2 ? <p className="px-3 py-4 text-center text-xs text-[var(--a-muted-ink)]">{t.header.searchHint}</p>
              : shown && total === 0 && !pending ? <p className="px-3 py-4 text-center text-sm text-[var(--a-muted-ink)]">{t.header.searchEmpty}</p>
              : shown && (
                <div className="space-y-2">
                  {shown.orders.length > 0 && (
                    <section><p className="px-3 py-1 text-[0.6875rem] font-semibold text-[var(--a-muted-ink)]">{t.header.searchOrders}</p>
                      {shown.orders.map((o) => (
                        <Link key={o.id} href={`/admin/orders/${o.id}`} onClick={close} className={row}>
                          <ShoppingBag aria-hidden="true" className="h-4 w-4 text-[var(--a-muted)]" />
                          <span dir="ltr" className="font-semibold">{o.order_number}</span>
                          <span className="truncate text-[var(--a-muted-ink)]">{o.customer_name}</span>
                          <span className="ms-auto tabular-nums">{f.money(o.total)}</span>
                        </Link>))}
                    </section>)}
                  {shown.customers.length > 0 && (
                    <section><p className="px-3 py-1 text-[0.6875rem] font-semibold text-[var(--a-muted-ink)]">{t.header.searchCustomers}</p>
                      {shown.customers.map((c) => (
                        <Link key={c.id} href={`/admin/customers/${c.id}`} onClick={close} className={row}>
                          <User aria-hidden="true" className="h-4 w-4 text-[var(--a-muted)]" />
                          <span className="truncate">{c.name}</span>
                          <span dir="ltr" className="ms-auto tabular-nums text-[var(--a-muted-ink)]">{c.phone}</span>
                        </Link>))}
                    </section>)}
                  {shown.products.length > 0 && (
                    <section><p className="px-3 py-1 text-[0.6875rem] font-semibold text-[var(--a-muted-ink)]">{t.header.searchProducts}</p>
                      {shown.products.map((p) => (
                        <Link key={p.id} href={`/admin/products/${p.id}`} onClick={close} className={row}>
                          <Package aria-hidden="true" className="h-4 w-4 text-[var(--a-muted)]" />
                          <span className="truncate">{p.name}</span>
                        </Link>))}
                    </section>)}
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
