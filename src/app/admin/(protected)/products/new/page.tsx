import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { ProductForm } from "../ProductForm";
import { createProduct } from "../actions";
import { ArrowRight } from "lucide-react";
import { getDict } from "@/lib/admin/i18n";
import { PageHeader } from "@/components/admin/ui";

export const instant = false;

export default async function NewProduct() {
  const staff = await requireStaff();
  const P = getDict(staff.locale).pf;
  const supabase = await createClient();
  const [{ data: categories }, { data: units }] = await Promise.all([
    supabase.from("categories").select("id, name").order("sort_order"),
    supabase.from("units").select("id, name_ar").eq("is_active", true).order("id"),
  ]);
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/admin/products" className="inline-flex items-center gap-1.5 text-sm text-[var(--a-muted-ink)] hover:text-[var(--a-text)]"><ArrowRight aria-hidden="true" className="h-4 w-4 ltr:rotate-180" />{P.back}</Link>
      <PageHeader title={P.newTitle} subtitle={P.newHint} />
      <ProductForm action={createProduct} isNew categories={categories ?? []}
        units={(units ?? []).map((u) => ({ id: u.id, name: u.name_ar }))} />
    </div>
  );
}
