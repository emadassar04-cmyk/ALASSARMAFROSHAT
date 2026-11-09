import Link from "next/link";
import { ExternalLink, FolderTree, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { getDict, fmt } from "@/lib/admin/i18n";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/admin/ui";
import { CategoryForm, type Cat } from "./Forms";

export const instant = false;

type Row = Required<Cat> & { products: { count: number }[] };

export default async function CategoriesPage() {
  const staff = await requireStaff();
  const t = getDict(staff.locale), f = fmt(staff.locale);
  const supabase = await createClient();
  const { data, error } = await supabase.from("categories")
    .select("id, name, slug, description, image_url, sort_order, is_active, seo_title, seo_description, parent_id, products(count)")
    .order("sort_order").order("name");
  const rows = (data ?? []) as unknown as Row[];
  const parents = rows.filter((r) => !r.parent_id).map((r) => ({ id: r.id, name: r.name }));
  const parentName = (id: string | null) => rows.find((r) => r.id === id)?.name;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t.categories.title} subtitle={t.categories.subtitle} />
      <details className="a-card mb-6">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 font-semibold [&::-webkit-details-marker]:hidden">
          <Plus aria-hidden="true" className="h-4 w-4 text-[var(--a-accent-ink)]" />{t.categories.add}
        </summary>
        <div className="border-t border-[var(--a-line)] p-5"><CategoryForm parents={parents} /></div>
      </details>
      <Card bodyClass="">
        {error ? <p role="alert" className="p-4 text-[var(--a-danger-ink)]">{t.common.error}</p>
          : rows.length === 0 ? <EmptyState icon={<FolderTree className="h-5 w-5" />} title={t.categories.empty} /> : (
          <ul className="divide-y divide-[var(--a-line)]">
            {rows.map((c) => (
              <li key={c.id}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">{c.parent_id && <span className="text-[var(--a-muted-ink)]">{parentName(c.parent_id)} / </span>}{c.name}</span>
                      <span className="block truncate text-xs text-[var(--a-muted-ink)]">/category/{c.slug}</span>
                    </span>
                    <span className="text-sm tabular-nums text-[var(--a-muted-ink)]">{f.number(c.products?.[0]?.count ?? 0)} {t.categories.products}</span>
                    <StatusBadge status={c.is_active ? "approved" : "voided"} label={c.is_active ? t.categories.active : t.categories.hidden} />
                    <span className="a-btn a-btn-ghost h-8 min-h-0 px-3 text-xs">{t.categories.edit}</span>
                  </summary>
                  <div className="border-t border-[var(--a-line)] bg-[#fcfbf8] p-5">
                    <CategoryForm c={c} parents={parents} />
                    {c.is_active && <Link href={`/category/${encodeURIComponent(c.slug)}`} target="_blank" className="mt-3 inline-flex items-center gap-1.5 text-sm text-[var(--a-accent-ink)] hover:underline"><ExternalLink aria-hidden="true" className="h-4 w-4" />{t.categories.view}</Link>}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
