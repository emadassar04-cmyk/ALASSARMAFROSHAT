"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CartLine, ProductDetail } from "@/lib/catalog-types";

// يجلب بيانات حالية من الخادم لعناصر محفوظة محلياً (السعر والتوفر لا يُؤخذان من المتصفح أبداً)
export function useCartLines(variantIds: string[]) {
  const key = [...variantIds].sort().join(",");
  const [state, setState] = useState<{ key: string; lines: CartLine[] | null; error: boolean }>({ key: "", lines: null, error: false });
  useEffect(() => {
    let cancelled = false;
    const ids = key ? key.split(",") : [];
    if (!ids.length) {
      Promise.resolve().then(() => !cancelled && setState({ key, lines: [], error: false }));
      return () => { cancelled = true; };
    }
    createClient().rpc("catalog_variants", { p_variant_ids: ids }).then(({ data, error }) => {
      if (!cancelled) setState({ key, lines: (data as CartLine[] | null) ?? [], error: !!error });
    });
    return () => { cancelled = true; };
  }, [key]);
  return state.key === key ? state : { key, lines: null, error: false };
}

export function useProducts(slugs: string[]) {
  const key = slugs.join(",");
  const [state, setState] = useState<{ key: string; products: ProductDetail[] | null }>({ key: "", products: null });
  useEffect(() => {
    let cancelled = false;
    const list = key ? key.split(",").slice(0, 50) : [];
    const supabase = createClient();
    Promise.all(list.map((s) => supabase.rpc("catalog_product", { p_slug: s }).then(({ data }) => data as ProductDetail | null)))
      .then((res) => { if (!cancelled) setState({ key, products: res.filter((p): p is ProductDetail => !!p) }); });
    return () => { cancelled = true; };
  }, [key]);
  return state.key === key ? state.products : null;
}
