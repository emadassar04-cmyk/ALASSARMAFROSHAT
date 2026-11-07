"use client";
import { useSyncExternalStore } from "react";

// مخزن صغير في localStorage يتزامن بين المكونات والتبويبات.
// السلة تحفظ فقط معرّف الخيار والكمية؛ الأسعار والتوفر تُجلب دائماً من الخادم.
export type CartItem = { variantId: string; qty: number; notes?: string };
export type SavedProduct = { id: string; slug: string };

type State = { cart: CartItem[]; wishlist: SavedProduct[]; compare: SavedProduct[] };
const KEY = "alassar-store-v1";
const EMPTY: State = { cart: [], wishlist: [], compare: [] };
export const MAX_COMPARE = 3;
export const MAX_QTY = 100;

let cache: State | null = null;
const listeners = new Set<() => void>();

function read(): State {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null");
    cache = {
      cart: Array.isArray(parsed?.cart) ? parsed.cart : [],
      wishlist: Array.isArray(parsed?.wishlist) ? parsed.wishlist : [],
      compare: Array.isArray(parsed?.compare) ? parsed.compare.slice(0, MAX_COMPARE) : [],
    };
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(next: State) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* التخزين ممتلئ أو معطل: نكمل في الذاكرة */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useStore(): State {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

const clampQty = (n: number) => Math.max(1, Math.min(MAX_QTY, Math.floor(n) || 1));

export const cart = {
  add(variantId: string, qty = 1, notes?: string) {
    const s = read();
    const existing = s.cart.find((i) => i.variantId === variantId);
    const items = existing
      ? s.cart.map((i) => (i.variantId === variantId ? { ...i, qty: clampQty(i.qty + qty), notes: notes ?? i.notes } : i))
      : [...s.cart, { variantId, qty: clampQty(qty), notes }];
    write({ ...s, cart: items });
  },
  setQty(variantId: string, qty: number) {
    const s = read();
    write({ ...s, cart: s.cart.map((i) => (i.variantId === variantId ? { ...i, qty: clampQty(qty) } : i)) });
  },
  remove(variantId: string) {
    const s = read();
    write({ ...s, cart: s.cart.filter((i) => i.variantId !== variantId) });
  },
  clear() {
    write({ ...read(), cart: [] });
  },
};

function toggleIn(list: "wishlist" | "compare", p: SavedProduct): boolean {
  const s = read();
  const has = s[list].some((x) => x.id === p.id);
  if (has) {
    write({ ...s, [list]: s[list].filter((x) => x.id !== p.id) });
    return true;
  }
  if (list === "compare" && s.compare.length >= MAX_COMPARE) return false;
  write({ ...s, [list]: [...s[list], p] });
  return true;
}

export const wishlist = { toggle: (p: SavedProduct) => toggleIn("wishlist", p) };
export const compare = {
  toggle: (p: SavedProduct) => toggleIn("compare", p),
  clear: () => write({ ...read(), compare: [] }),
};
