import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageSkeleton } from "@/components/admin/PageSkeleton";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, can } from "@/lib/staff";
import { getDict } from "@/lib/admin/i18n";
import { PageHeader } from "@/components/admin/ui";
import { OptionsManager, type Fabric, type Color } from "./OptionsManager";

export const instant = false;

async function Content() {
  const staff = await requireStaff();
  if (!can(staff, "catalog.manage")) redirect("/admin");
  const t = getDict(staff.locale);
  const supabase = await createClient();
  const [{ data: fabrics }, { data: colors }] = await Promise.all([
    supabase.from("custom_fabrics").select("id, product_type, name, texture_url, is_active, sort_order").order("sort_order").order("name"),
    supabase.from("custom_colors").select("id, name, hex, is_active, sort_order").order("sort_order").order("name"),
  ]);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={t.cop.title} subtitle={t.cop.subtitle} />
      <OptionsManager fabrics={(fabrics ?? []) as Fabric[]} colors={(colors ?? []) as Color[]} />
    </div>
  );
}

export default function CustomOptionsPage() {
  return <Suspense fallback={<PageSkeleton variant="form" />}><Content /></Suspense>;
}
