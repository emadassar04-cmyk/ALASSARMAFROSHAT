import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { BranchForm } from "./Forms";

export const instant = false;

export default async function BranchesSettings() {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase.from("branches")
    .select("id, name, city, address, phone, map_url, lat, lng, is_default")
    .eq("is_active", true).order("is_default", { ascending: false }).order("sort_order");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold">الفروع</h1>
        <Link href="/branches" target="_blank" className="text-sm text-gold-dark underline">عرض صفحة الفروع ↗</Link>
      </div>
      <p className="text-sm opacity-70">تظهر هذه البيانات في صفحة «فروعنا» والصفحة الرئيسية والتذييل. المخزون مشترك ويُسجَّل على الفرع الرئيسي.</p>
      {(data ?? []).map((b) => <BranchForm key={b.id} branch={{ ...b, lat: b.lat === null ? null : Number(b.lat), lng: b.lng === null ? null : Number(b.lng) }} />)}
    </div>
  );
}
