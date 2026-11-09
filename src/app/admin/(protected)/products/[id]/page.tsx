import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { ProductForm } from "../ProductForm";
import { VariantRow } from "../VariantRow";
import { MediaManager } from "../MediaManager";
import { updateProduct } from "../actions";
import { ArrowRight, ExternalLink, Plus } from "lucide-react";
import { getDict } from "@/lib/admin/i18n";
import { Card } from "@/components/admin/ui";
import { DeleteProduct } from "../DeleteProduct";

export const instant = false;

export default async function EditProduct({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  const staff = await requireStaff();
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const canSeeCost = staff.permissions.includes("finance.read");
  const t = getDict(staff.locale), P = t.pf;
  const supabase = await createClient();
  const [{ data: p }, { data: categories }, { data: units }] = await Promise.all([
    supabase.from("products").select("*, product_variants(*, inventory(on_hand, reserved)), product_media(id, url, kind, alt, sort_order, created_at)")
      .eq("id", id).single(),
    supabase.from("categories").select("id, name").order("sort_order"),
    supabase.from("units").select("id, name_ar").eq("is_active", true).order("id"),
  ]);
  if (!p) notFound();

  type V = { id: string; name: string; color: string | null; size: string | null; material: string | null; price_override: string | null;
    is_active: boolean; is_default: boolean; sort_order: number; created_at: string; inventory: { on_hand: number; reserved: number }[] };
  const variants = ((p.product_variants ?? []) as V[]).sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.created_at.localeCompare(b.created_at));
  const costs = canSeeCost && variants.length
    ? (await supabase.from("variant_costs").select("variant_id, unit_cost").in("variant_id", variants.map((v) => v.id))).data ?? []
    : [];
  const costOf = new Map(costs.map((c) => [c.variant_id, String(c.unit_cost)]));
  type M = { id: string; url: string; kind: "image" | "video"; alt: string | null; sort_order: number; created_at: string };
  const media = ((p.product_media ?? []) as M[]).sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/admin/products" className="inline-flex items-center gap-1.5 text-sm text-[var(--a-muted-ink)] hover:text-[var(--a-text)]"><ArrowRight aria-hidden="true" className="h-4 w-4 ltr:rotate-180" />{P.back}</Link>
        <div className="flex items-center gap-2">
          {p.status === "active" && (
            <Link href={`/product/${encodeURIComponent(p.slug)}`} target="_blank" className="a-btn a-btn-ghost"><ExternalLink aria-hidden="true" className="h-4 w-4" />{P.viewInStore}</Link>
          )}
          <DeleteProduct id={p.id} />
        </div>
      </div>
      <h1 className="text-[1.75rem]">{p.name}</h1>
      {created && <p role="status" className="a-card border-[#bfe3d1] bg-[#f1faf5] p-3 text-sm text-[#0f5c3e]">{P.created}</p>}

      <Card title={P.media}>
        <MediaManager productId={p.id} productName={p.name} media={media} />
      </Card>

      <Card title={P.variantsTitle} bodyClass="">
        <p className="border-b border-[var(--a-line)] px-5 py-3 text-sm text-[var(--a-muted-ink)]">{P.variantsHint}</p>
        <div className="divide-y divide-[var(--a-line)]">
          {variants.map((v) => (
            <VariantRow key={v.id} productId={p.id} canSeeCost={canSeeCost} v={{
              id: v.id, name: v.name, color: v.color, size: v.size, material: v.material, price_override: v.price_override,
              is_active: v.is_active, is_default: v.is_default, unit_cost: costOf.get(v.id) ?? null,
              on_hand: v.inventory?.[0]?.on_hand ?? 0, reserved: v.inventory?.[0]?.reserved ?? 0 }} />
          ))}
        </div>
        <details className="border-t border-dashed border-[var(--a-line)] bg-[#fcfbf8]">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden"><Plus aria-hidden="true" className="h-4 w-4 text-[var(--a-accent-ink)]" />{P.addVariant}</summary>
          <VariantRow productId={p.id} canSeeCost={canSeeCost} />
        </details>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg">{P.data}</h2>
        <ProductForm action={updateProduct} isNew={false} categories={categories ?? []}
          units={(units ?? []).map((u) => ({ id: u.id, name: u.name_ar }))}
          values={{ ...p, price: p.price === null ? null : String(p.price), sale_price: p.sale_price === null ? null : String(p.sale_price) }} />
      </section>
    </div>
  );
}
