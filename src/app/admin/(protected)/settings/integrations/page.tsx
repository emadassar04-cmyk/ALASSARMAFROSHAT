import { Suspense } from "react";
import { PageSkeleton } from "@/components/admin/PageSkeleton";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { getDict, fmt } from "@/lib/admin/i18n";
import { Card, PageHeader } from "@/components/admin/ui";
import { KeyGenerator } from "./KeyGenerator";
import { AiTest } from "./AiTest";
import { allProviders } from "@/lib/ai/providers";

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
  // للعرض فقط: هل المفتاح مضبوط؟ (لا تُمرَّر قيم المفاتيح لأي مكوّن)
  const providers = allProviders().map(({ id, label, envKey, model, key }) => ({ id, label, envKey, model, configured: !!key }));
  const count = (st: string) => (deliveries ?? []).filter((d) => d.status === st).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={S.integrationsTitle} />
      {/* مساعد العصار: حالة المفاتيح فقط (مضبوط/غير مضبوط) — القيم لا تُقرأ ولا تُعرض إطلاقاً */}
      <Card title={S.aiTitle}>
        <div className="space-y-4">
          <p className="text-sm leading-6 text-[var(--a-muted-ink)]">{S.aiHint}</p>
          <p className={`text-sm font-medium ${providers.some((p) => p.configured) ? "text-[var(--a-success)]" : "text-[var(--a-warning)]"}`}>
            {providers.some((p) => p.configured) ? S.aiOn : S.aiOff}
          </p>
          <div className="overflow-x-auto">
            <table className="a-table">
              <thead><tr><th>{S.aiOrder}</th><th>{S.aiProvider}</th><th>{S.aiKey}</th><th>{S.aiModel}</th><th /></tr></thead>
              <tbody>
                {providers.map((p, i) => (
                  <tr key={p.id}>
                    <td className="tabular-nums">{f.number(i + 1)}</td>
                    <td className="font-medium">{p.label}<span dir="ltr" className="mt-0.5 block text-xs font-normal text-[var(--a-muted-ink)]">{p.envKey}</span></td>
                    <td className="whitespace-nowrap">{p.configured ? <span className="text-[var(--a-success)]">{S.aiConfigured}</span> : <span className="text-[var(--a-muted-ink)]">{S.aiMissing}</span>}</td>
                    <td dir="ltr" className="text-xs">{p.model}</td>
                    <td>{p.configured && <AiTest id={p.id} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs leading-6 text-[var(--a-muted-ink)]">{S.aiHowTo}</p>
          <p className="text-xs leading-6 text-[var(--a-muted-ink)]">{S.aiLimits}</p>
        </div>
      </Card>
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
