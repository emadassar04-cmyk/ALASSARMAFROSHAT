import { Suspense } from "react";
import { PageSkeleton } from "@/components/admin/PageSkeleton";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { getDict, fmt } from "@/lib/admin/i18n";
import { Card, PageHeader } from "@/components/admin/ui";
import { KeyGenerator } from "./KeyGenerator";

export const instant = false;

async function IntegrationsPageContent() {
  const staff = await requireStaff();
  const t = getDict(staff.locale), f = fmt(staff.locale), S = t.set;
  const supabase = await createClient();
  const [{ data: status }, { data: deliveries }] = await Promise.all([
    supabase.rpc("integration_key_status", { p_name: "n8n" }),
    supabase.from("notification_deliveries").select("status").eq("channel", "telegram"),
  ]);
  const s = status as { exists: boolean; created_at: string; last_used_at: string | null } | null;
  const count = (st: string) => (deliveries ?? []).filter((d) => d.status === st).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={S.integrationsTitle} />
      <Card title="n8n → Telegram">
        <div className="space-y-4">
          <p className="text-sm leading-6 text-[var(--a-muted-ink)]">{S.n8nHint}</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-[var(--a-muted-ink)]">{S.keyStatus}</dt><dd className="font-semibold">{s?.exists ? S.created : S.notCreated}</dd>
            {s?.exists && <><dt className="text-[var(--a-muted-ink)]">{S.lastUsed}</dt><dd>{s.last_used_at ? f.dateTime(s.last_used_at) : S.neverUsed}</dd></>}
            <dt className="text-[var(--a-muted-ink)]">{S.pending}</dt><dd className="tabular-nums">{f.number(count("pending") + count("failed") + count("processing"))}</dd>
            <dt className="text-[var(--a-muted-ink)]">{S.sent}</dt><dd className="tabular-nums">{f.number(count("sent"))}</dd>
            {count("dead") > 0 && <><dt className="text-[var(--a-danger-ink)]">{S.dead}</dt><dd className="tabular-nums text-[var(--a-danger-ink)]">{f.number(count("dead"))}</dd></>}
          </dl>
          <KeyGenerator hasKey={!!s?.exists} />
        </div>
      </Card>
    </div>
  );
}

// الصفحة تُعرض فوراً بهيكل تحميل، ثم يتدفق المحتوى (تنقل سلس دون انتظار الخادم)
export default function IntegrationsPage() {
  return <Suspense fallback={<PageSkeleton variant="form" />}><IntegrationsPageContent /></Suspense>;
}
