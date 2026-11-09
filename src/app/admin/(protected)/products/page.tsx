import Link from "next/link";
import Image from "next/image";
import { ImageOff, LayoutGrid, List, Package, Plus, Search, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { getDict, fmt } from "@/lib/admin/i18n";
import { Card, EmptyState, PageHeader, StatusBadge, withParams } from "@/components/admin/ui";
import { DeleteProduct } from "./DeleteProduct";

// صفحات الإدارة تقرأ الجلسة: تُعرض على الخادم في كل طلب
export const instant = false;

type Row = {
  id: string; name: string; slug: string; status: string; price: string | null; sale_price: string | null; requires_measurement: boolean;
  is_featured: boolean; low_stock_threshold: number; availability_mode: string; categories: { name: string } | null;
  product_variants: { id: string; sku: string | null; is_active: boolean; inventory: { on_hand: number; reserved: number }[] }[];
  product_media: { url: string; kind: string; sort_order: number }[];
};
// صور التخزين الخاص بالمتجر تُحسَّن تلقائياً؛ أي رابط خارجي يُعرض كما هو (لا يكسر الصفحة)
const optimizable = (u: string) => u.startsWith("https://puakwxubskwxostdtmzi.supabase.co/storage/v1/object/public/");
const STATUS_TONE: Record<string, string> = { active: "approved", draft: "submitted", archived: "voided" };

export default async function AdminProducts({ searchParams }: PageProps<"/admin/products">) {
  const staff = await requireStaff();
  const t = getDict(staff.locale), f = fmt(staff.locale);
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const view = s("view") === "grid" ? "grid" : "table";
  const status = ["active", "draft", "archived"].includes(s("status")) ? s("status") : "";
  const stock = ["low", "out"].includes(s("stock")) ? s("stock") : "";
  const q = s("q").trim().replace(/[%_,()]/g, "").slice(0, 60);
  const supabase = await createClient();
  let query = supabase.from("products")
    .select("id, name, slug, status, price, sale_price, requires_measurement, is_featured, low_stock_threshold, availability_mode, categories(name), product_variants(id, sku, is_active, inventory(on_hand, reserved)), product_media(url, kind, sort_order)")
    .order("created_at", { ascending: false }).limit(300);
  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("name", `%${q}%`);
  const { data, error } = await query;
  let rows = (data ?? []) as unknown as Row[];
  const stockOf = (p: Row) => {
    const inv = p.product_variants.filter((v) => v.is_active).flatMap((v) => v.inventory);
    const onHand = inv.reduce((a, i) => a + i.on_hand, 0), reserved = inv.reduce((a, i) => a + i.reserved, 0);
    const tracked = p.availability_mode === "stock" && !p.requires_measurement;
    const available = onHand - reserved;
    return { available, reserved, tracked, out: tracked && available <= 0, low: tracked && available > 0 && available <= p.low_stock_threshold };
  };
  if (stock) rows = rows.filter((p) => (stock === "out" ? stockOf(p).out : stockOf(p).low || stockOf(p).out));
  const cover = (p: Row) => [...p.product_media].filter((m) => m.kind === "image").sort((a, b) => a.sort_order - b.sort_order)[0]?.url;
  const price = (p: Row) => (p.requires_measurement ? t.products.byMeasure : p.price ? f.money(p.sale_price ?? p.price) : "—");

  return (
    <div className="mx-auto max-w-[90rem]">
      <PageHeader title={t.products.title} subtitle={t.products.subtitle} actions={
        <>
          <div role="group" className="flex rounded-[10px] border border-[var(--a-line)] bg-white p-0.5">
            <Link href={withParams("/admin/products", sp, { view: null })} aria-current={view === "table" ? "true" : undefined} aria-label={t.products.table}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${view === "table" ? "bg-[var(--a-sidebar)] text-white" : ""}`}><List aria-hidden="true" className="h-4 w-4" /><span className="hidden sm:inline">{t.products.table}</span></Link>
            <Link href={withParams("/admin/products", sp, { view: "grid" })} aria-current={view === "grid" ? "true" : undefined} aria-label={t.products.grid}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${view === "grid" ? "bg-[var(--a-sidebar)] text-white" : ""}`}><LayoutGrid aria-hidden="true" className="h-4 w-4" /><span className="hidden sm:inline">{t.products.grid}</span></Link>
          </div>
          <Link href="/admin/products/new" className="a-btn a-btn-primary"><Plus aria-hidden="true" className="h-4 w-4" />{t.products.new}</Link>
        </>
      } />

      <form className="a-card mb-4 flex flex-wrap gap-3 p-4">
        {view === "grid" && <input type="hidden" name="view" value="grid" />}
        <label className="relative block min-w-0 flex-1 basis-60">
          <span className="sr-only">{t.common.search}</span>
          <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--a-muted)]" />
          <input name="q" defaultValue={q} placeholder={t.products.searchPlaceholder} className="a-input ps-9" maxLength={60} />
        </label>
        <select name="status" defaultValue={status} aria-label={t.products.status} className="a-input w-auto">
          <option value="">{t.products.allStatuses}</option>
          {(["active", "draft", "archived"] as const).map((k) => <option key={k} value={k}>{t.products.statuses[k]}</option>)}
        </select>
        <select name="stock" defaultValue={stock} aria-label={t.products.available} className="a-input w-auto">
          <option value="">{t.products.stockAll}</option><option value="low">{t.products.lowStock}</option><option value="out">{t.products.outOfStock}</option>
        </select>
        <button className="a-btn a-btn-primary">{t.common.apply}</button>
      </form>

      {error && <p role="alert" className="a-card mb-4 p-4 text-[var(--a-danger-ink)]">{t.common.error}</p>}
      {rows.length === 0 ? (
        <Card><EmptyState icon={<Package className="h-5 w-5" />} title={t.products.empty}>
          <Link href="/admin/products/new" className="text-[var(--a-accent-ink)] underline">{t.products.addFirst}</Link></EmptyState></Card>
      ) : view === "grid" ? (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {rows.map((p) => {
            const st = stockOf(p), img = cover(p);
            return (
              <li key={p.id} className="a-card group overflow-hidden">
                <Link href={`/admin/products/${p.id}`} className="block">
                  <div className="relative aspect-[4/3] bg-[#f3f0ea]">
                    {img ? <Image src={img} alt="" fill unoptimized={!optimizable(img)} sizes="(min-width:1280px) 20vw, (min-width:768px) 33vw, 50vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                      : <span className="absolute inset-0 grid place-items-center text-[var(--a-muted)]"><ImageOff aria-hidden="true" className="h-6 w-6" /><span className="sr-only">{t.products.noImage}</span></span>}
                    <span className="absolute start-2 top-2"><StatusBadge status={STATUS_TONE[p.status]} label={t.products.statuses[p.status]} /></span>
                    {p.is_featured && <Star aria-label={t.products.featured} className="absolute end-2 top-2 h-5 w-5 fill-[var(--a-accent)] text-[var(--a-accent)]" />}
                  </div>
                  <div className="space-y-1 p-3">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="truncate text-xs text-[var(--a-muted-ink)]">{p.categories?.name ?? "—"}</p>
                    <div className="flex items-center justify-between gap-2 pt-1 text-sm">
                      <b className="tabular-nums">{price(p)}</b>
                      {st.tracked && <span className={`text-xs tabular-nums ${st.out ? "font-semibold text-[var(--a-danger-ink)]" : st.low ? "font-semibold text-[var(--a-warning)]" : "text-[var(--a-muted-ink)]"}`}>{st.out ? t.products.outOfStock : `${f.number(st.available)} ${t.products.available}`}</span>}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <Card bodyClass="">
          <div className="overflow-x-auto">
            <table className="a-table min-w-[56rem]">
              <thead><tr>
                <th scope="col">{t.products.product}</th><th scope="col">{t.products.category}</th><th scope="col">{t.products.status}</th>
                <th scope="col">{t.products.price}</th><th scope="col">{t.products.available}</th><th scope="col">{t.products.images}</th>
                <th scope="col"><span className="sr-only">{t.common.actions}</span></th>
              </tr></thead>
              <tbody>{rows.map((p) => {
                const st = stockOf(p), img = cover(p);
                const sku = p.product_variants.map((v) => v.sku).filter(Boolean)[0];
                return (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                        <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-[#f3f0ea]">
                          {img ? <Image src={img} alt="" fill unoptimized={!optimizable(img)} sizes="44px" className="object-cover" /> : <ImageOff aria-hidden="true" className="absolute inset-0 m-auto h-4 w-4 text-[var(--a-muted)]" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold hover:text-[var(--a-accent-ink)]">{p.name}{p.is_featured && <Star aria-label={t.products.featured} className="ms-1.5 inline h-3.5 w-3.5 fill-[var(--a-accent)] text-[var(--a-accent)]" />}</span>
                          <span className="block text-xs text-[var(--a-muted-ink)]">{sku ? <span dir="ltr">SKU {sku} · </span> : null}{f.number(p.product_variants.length)} {t.products.variants}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="text-[var(--a-muted-ink)]">{p.categories?.name ?? "—"}</td>
                    <td><StatusBadge status={STATUS_TONE[p.status]} label={t.products.statuses[p.status]} /></td>
                    <td className="tabular-nums">{price(p)}{p.sale_price && !p.requires_measurement && <span className="block text-xs text-[var(--a-muted-ink)] line-through">{f.money(p.price)}</span>}</td>
                    <td className="tabular-nums">{st.tracked ? <span className={st.out ? "font-semibold text-[var(--a-danger-ink)]" : st.low ? "font-semibold text-[var(--a-warning)]" : ""}>{f.number(st.available)}<span className="text-xs font-normal text-[var(--a-muted-ink)]"> · {f.number(st.reserved)} {t.products.reserved}</span></span> : "—"}</td>
                    <td className={`tabular-nums ${p.product_media.length < 5 ? "text-[var(--a-warning)]" : ""}`} title={p.product_media.length < 5 ? t.products.fewImages : undefined}>{f.number(p.product_media.length)}</td>
                    <td><div className="flex items-center justify-end gap-2">
                      <Link href={`/admin/products/${p.id}`} className="a-btn a-btn-ghost h-8 min-h-0 px-3 text-xs">{t.products.edit}</Link>
                      <DeleteProduct id={p.id} compact />
                    </div></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
