import { Suspense } from "react";
import { PageSkeleton } from "@/components/admin/PageSkeleton";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, Gift, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, can } from "@/lib/staff";
import { toGazaLocalInput } from "@/lib/admin/actions-util";
import { getDict, fmt } from "@/lib/admin/i18n";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/admin/ui";
import { CampaignActions, CampaignForm, type Campaign } from "./Forms";

export const instant = false;

type Row = {
  campaign: Omit<Campaign, "start_local" | "end_local" | "ended"> & { start_at: string; end_at: string; drawn_at: string | null };
  entries: number; customers: number; voided: number;
};
const TONE: Record<string, string> = { draft: "submitted", published: "approved", drawn: "confirmed", archived: "voided" };

async function CampaignsPageContent() {
  const staff = await requireStaff();
  if (!can(staff, "campaigns.manage")) redirect("/admin");
  const t = getDict(staff.locale), f = fmt(staff.locale), C = t.camp;
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_campaigns");
  const rows = (data ?? []) as Row[];
  // وقت الطلب يُقرأ مرة في الخادم لتحديد انتهاء الحملة
  const nowMs = await Promise.resolve().then(() => new Date().getTime());

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={C.title} subtitle={C.hint} actions={<Link href="/campaign" target="_blank" className="a-btn a-btn-ghost"><ExternalLink aria-hidden="true" className="h-4 w-4" />{C.page}</Link>} />
      {rows.length === 0 && <Card><EmptyState icon={<Gift className="h-5 w-5" />} title={C.none} /></Card>}
      {rows.map(({ campaign: c, entries, customers, voided }) => {
        const view: Campaign = { ...c, start_local: toGazaLocalInput(c.start_at), end_local: toGazaLocalInput(c.end_at), ended: new Date(c.end_at).getTime() <= nowMs };
        return (
          <section key={c.id} className="a-card space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex flex-wrap items-center gap-2 text-lg">{c.title} <StatusBadge status={TONE[c.status]} label={C.st[c.status]} /></h2>
              <CampaignActions c={view} />
            </div>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div><dt className="a-label">{C.period}</dt><dd className="text-xs">{f.dateTime(c.start_at)} ← {f.dateTime(c.end_at)}</dd></div>
              <div><dt className="a-label">{C.entries}</dt><dd className="text-xl font-bold tabular-nums">{f.number(entries)}</dd></div>
              <div><dt className="a-label">{C.customers}</dt><dd className="text-xl font-bold tabular-nums">{f.number(customers)}</dd></div>
              <div><dt className="a-label">{C.voided}</dt><dd className="tabular-nums">{f.number(voided)}</dd></div>
            </dl>
            {c.winner_display && <p className="rounded-[10px] bg-[#f1faf5] p-3 text-[#0f5c3e]">{C.winner}: <strong>{c.winner_display}</strong>{c.drawn_at ? ` — ${f.dateTime(c.drawn_at)}` : ""}</p>}
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-[var(--a-accent-ink)]">{c.status === "drawn" || c.status === "archived" ? C.locked : C.details}</summary>
              <div className="mt-4"><CampaignForm c={view} /></div>
            </details>
          </section>
        );
      })}
      <details className="a-card">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 font-semibold [&::-webkit-details-marker]:hidden"><Plus aria-hidden="true" className="h-4 w-4 text-[var(--a-accent-ink)]" />{C.new}</summary>
        <div className="space-y-3 border-t border-[var(--a-line)] p-5"><p className="text-sm text-[var(--a-muted-ink)]">{C.newHint}</p><CampaignForm /></div>
      </details>
    </div>
  );
}

// الصفحة تُعرض فوراً بهيكل تحميل، ثم يتدفق المحتوى (تنقل سلس دون انتظار الخادم)
export default function CampaignsPage() {
  return <Suspense fallback={<PageSkeleton variant="list" />}><CampaignsPageContent /></Suspense>;
}
