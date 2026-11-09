import Link from "next/link";
import { History, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { getDict, fmt } from "@/lib/admin/i18n";
import { Card, EmptyState, PageHeader, Pagination } from "@/components/admin/ui";

export const instant = false;

type Row = {
  id: number; occurred_at: string; action: string; entity: string; entity_id: string | null; actor: string | null;
  actor_role: string | null; note: string | null; old_values: Record<string, unknown> | null; new_values: Record<string, unknown> | null;
};
type Res = { total: number; page: number; page_size: number; entities: string[]; actors: { id: string; name: string }[]; rows: Row[] };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const HIDDEN = new Set(["updated_at", "created_at", "id"]);

// الحقول التي تغيّرت فقط (لا نعرض السجل كاملاً)
function diff(a: Record<string, unknown> | null, b: Record<string, unknown> | null) {
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  return [...keys].filter((k) => !HIDDEN.has(k) && JSON.stringify(a?.[k]) !== JSON.stringify(b?.[k]))
    .map((k) => ({ k, before: a?.[k], after: b?.[k] }));
}
const show = (v: unknown) => (v === undefined || v === null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

export default async function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  const staff = await requireStaff();
  const t = getDict(staff.locale), f = fmt(staff.locale);
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const filters = {
    q: s("q").trim().slice(0, 60), entity: s("entity").slice(0, 60), actor: /^[0-9a-f-]{36}$/i.test(s("actor")) ? s("actor") : "",
    from: ISO.test(s("from")) ? s("from") : "", to: ISO.test(s("to")) ? s("to") : "",
  };
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_activity", { p: { ...filters, page, page_size: 30 } });
  const res = data as Res | null;

  return (
    <div className="mx-auto max-w-[90rem]">
      <PageHeader title={t.activity.title} subtitle={t.activity.subtitle} />
      <form className="a-card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto]">
        <label className="relative block sm:col-span-2 lg:col-span-1">
          <span className="sr-only">{t.common.search}</span>
          <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--a-muted)]" />
          <input name="q" defaultValue={filters.q} placeholder={t.activity.searchPlaceholder} className="a-input ps-9" maxLength={60} />
        </label>
        <select name="entity" defaultValue={filters.entity} aria-label={t.activity.entity} className="a-input">
          <option value="">{t.activity.allEntities}</option>
          {(res?.entities ?? []).map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select name="actor" defaultValue={filters.actor} aria-label={t.activity.actor} className="a-input">
          <option value="">{t.activity.allActors}</option>
          {(res?.actors ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <input type="date" name="from" defaultValue={filters.from} aria-label={t.common.from} className="a-input" />
        <input type="date" name="to" defaultValue={filters.to} aria-label={t.common.to} className="a-input" />
        <div className="flex gap-2">
          <button className="a-btn a-btn-primary flex-1">{t.common.apply}</button>
          {Object.values(filters).some(Boolean) && <Link href="/admin/activity" className="a-btn a-btn-ghost">{t.common.reset}</Link>}
        </div>
      </form>

      <Card bodyClass="">
        {error ? <p role="alert" className="p-4 text-[var(--a-danger-ink)]">{error.message.includes("forbidden") ? t.errors.forbidden : t.common.error}</p>
          : !res || res.rows.length === 0 ? <EmptyState icon={<History className="h-5 w-5" />} title={t.activity.empty} /> : (
          <>
            <ol className="divide-y divide-[var(--a-line)]">
              {res.rows.map((r) => {
                const changes = diff(r.old_values, r.new_values);
                return (
                  <li key={r.id} className="grid gap-2 px-5 py-3.5 text-sm md:grid-cols-[11rem_12rem_minmax(0,1fr)]">
                    <time dateTime={r.occurred_at} className="tabular-nums text-[var(--a-muted-ink)]">{f.dateTime(r.occurred_at)}</time>
                    <span className="truncate font-medium">{r.actor ?? t.activity.system}</span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <code dir="ltr" className="rounded-md bg-[#f3f0ea] px-1.5 py-0.5 text-xs">{r.action}</code>
                        <span className="text-[var(--a-muted-ink)]">{r.entity}</span>
                        {r.entity_id && <code dir="ltr" className="truncate text-xs text-[var(--a-muted-ink)]">{r.entity_id.slice(0, 40)}</code>}
                      </p>
                      {r.note && <p className="mt-1 text-[var(--a-muted-ink)]">{r.note}</p>}
                      {changes.length > 0 && (
                        <details className="mt-1.5">
                          <summary className="cursor-pointer text-xs font-semibold text-[var(--a-accent-ink)]">{t.activity.changes} ({f.number(changes.length)})</summary>
                          <div className="mt-2 overflow-x-auto rounded-[10px] border border-[var(--a-line)]">
                            <table className="a-table text-xs">
                              <thead><tr><th scope="col">{t.activity.entity}</th><th scope="col">{t.activity.before}</th><th scope="col">{t.activity.after}</th></tr></thead>
                              <tbody>{changes.slice(0, 30).map((c) => (
                                <tr key={c.k}><td dir="ltr"><code>{c.k}</code></td><td className="max-w-[16rem] break-words text-[var(--a-muted-ink)]">{show(c.before).slice(0, 200)}</td><td className="max-w-[16rem] break-words">{show(c.after).slice(0, 200)}</td></tr>
                              ))}</tbody>
                            </table>
                          </div>
                        </details>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
            <Pagination base="/admin/activity" sp={sp} page={res.page} pageSize={res.page_size} total={res.total} t={t} f={f} />
          </>
        )}
      </Card>
    </div>
  );
}
