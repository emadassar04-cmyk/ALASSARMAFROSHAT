"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ProductCard } from "@/lib/catalog-types";
import { formatPrice } from "@/lib/format";

// بحث فوري مع اقتراحات (صورة + سعر) أثناء الكتابة
export function SearchBox() {
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ProductCard[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const reqId = useRef(0);

  useEffect(() => {
    const term = q.trim();
    const id = ++reqId.current;
    if (term.length < 2) return;
    const t = setTimeout(async () => {
      const { data } = await createClient().rpc("catalog_suggest", { p_q: term });
      if (id === reqId.current) {
        setItems((data as ProductCard[] | null) ?? []);
        setActive(-1);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    setOpen(false);
    if (active >= 0 && items[active]) return router.push(`/product/${encodeURIComponent(items[active].slug)}`);
    if (term) router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!items.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % items.length); setOpen(true); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a <= 0 ? items.length - 1 : a - 1)); }
    else if (e.key === "Escape") setOpen(false);
  }

  const showList = open && q.trim().length >= 2;
  const visible = q.trim().length >= 2 ? items : [];
  return (
    <form role="search" onSubmit={submit} className="relative w-full">
      <input
        type="search"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder="ابحث عن سجاد، ستائر، مخدات…"
        aria-label="بحث في المنتجات"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        maxLength={100}
        className="w-full rounded-full border border-gold/30 bg-white py-2.5 ps-4 pe-11 text-sm focus:border-gold focus:outline-none"
      />
      <button type="submit" aria-label="بحث" className="absolute inset-y-0 end-0 flex w-11 items-center justify-center text-gold-dark">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
      </button>
      {showList && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-gold/20 bg-white shadow-lg">
          {visible.length === 0 ? (
            <li className="p-4 text-center text-sm opacity-70">لا توجد اقتراحات. اضغط Enter للبحث.</li>
          ) : (
            visible.map((p, i) => (
              <li key={p.id} role="option" aria-selected={i === active}>
                <Link
                  href={`/product/${encodeURIComponent(p.slug)}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 p-2.5 ${i === active ? "bg-beige" : "hover:bg-beige/60"}`}
                >
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- صورة مصغرة صغيرة في القائمة
                    <img src={p.image.url} alt="" loading="lazy" className="h-11 w-11 rounded-lg object-cover" />
                  ) : (
                    <span className="h-11 w-11 rounded-lg bg-beige" aria-hidden="true" />
                  )}
                  <span className="flex-1 text-sm">{p.name}</span>
                  <span className="text-sm font-medium">{p.requires_measurement ? "حسب المقاس" : formatPrice(p.price)}</span>
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </form>
  );
}
