import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { getDict } from "@/lib/admin/i18n";
import { PageHeader } from "@/components/admin/ui";
import { BranchForm } from "./Forms";

export const instant = false;

export default async function BranchesSettings() {
  const staff = await requireStaff();
  const t = getDict(staff.locale), S = t.set;
  const supabase = await createClient();
  const { data } = await supabase.from("branches")
    .select("id, name, city, address, phone, map_url, lat, lng, is_default")
    .eq("is_active", true).order("is_default", { ascending: false }).order("sort_order");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={S.branchesTitle} subtitle={S.branchesHint}
        actions={<Link href="/branches" target="_blank" className="a-btn a-btn-ghost"><ExternalLink aria-hidden="true" className="h-4 w-4" />{S.viewBranches}</Link>} />
      {(data ?? []).map((b) => <BranchForm key={b.id} branch={{ ...b, lat: b.lat === null ? null : Number(b.lat), lng: b.lng === null ? null : Number(b.lng) }} />)}
    </div>
  );
}
