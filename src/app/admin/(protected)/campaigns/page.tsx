import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { toGazaLocalInput } from "@/lib/admin/actions-util";
import { CampaignActions, CampaignForm, type Campaign } from "./Forms";

export const instant = false;

type Row = {
  campaign: Omit<Campaign, "start_local" | "end_local" | "ended"> & { start_at: string; end_at: string; drawn_at: string | null };
  entries: number; customers: number; voided: number;
};
const STATUS: Record<string, string> = { draft: "مسودة", published: "منشورة", drawn: "تم السحب", archived: "مؤرشفة" };
const fmt = (iso: string) => new Date(iso).toLocaleString("ar", { timeZone: "Asia/Gaza", numberingSystem: "latn", dateStyle: "medium", timeStyle: "short" });

export default async function CampaignsPage() {
  const staff = await requireStaff();
  if (!staff.permissions.includes("campaigns.manage")) redirect("/admin");
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_campaigns");
  const rows = (data ?? []) as Row[];
  // وقت الطلب يُقرأ مرة في الخادم لتحديد انتهاء الحملة
  const nowMs = await Promise.resolve().then(() => new Date().getTime());

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold">حملة السحب الشهري</h1>
        <Link href="/campaign" target="_blank" className="text-sm text-gold-dark underline">صفحة الحملة ↗</Link>
      </div>
      <p className="text-sm leading-6 opacity-80">
        المشاركات تُنشأ تلقائياً: طلب أونلاين عند «تم التسليم»، وبيع فرع عند اعتماده — مشاركة واحدة لكل شراء ضمن فترة الحملة.
        الإلغاء أو الرفض يبطل المشاركة. السحب متاح بعد انتهاء الحملة فقط، ومرة واحدة.
      </p>

      {rows.map(({ campaign: c, entries, customers, voided }) => {
        const view: Campaign = { ...c, start_local: toGazaLocalInput(c.start_at), end_local: toGazaLocalInput(c.end_at), ended: new Date(c.end_at).getTime() <= nowMs };
        return (
          <section key={c.id} className="space-y-4 rounded-2xl border border-gold/20 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">{c.title} <span className="rounded-full bg-beige px-2 py-0.5 text-xs font-normal">{STATUS[c.status]}</span></h2>
              <CampaignActions c={view} />
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div><dt className="opacity-60">الفترة</dt><dd className="text-xs">{fmt(c.start_at)} ← {fmt(c.end_at)}</dd></div>
              <div><dt className="opacity-60">المشاركات السارية</dt><dd className="text-lg font-bold">{entries}</dd></div>
              <div><dt className="opacity-60">الزبائن المشاركون</dt><dd className="text-lg font-bold">{customers}</dd></div>
              <div><dt className="opacity-60">مشاركات مُبطلة</dt><dd>{voided}</dd></div>
            </dl>
            {c.winner_display && <p className="rounded-lg bg-emerald-50 p-3 text-emerald-900">الفائز: <strong>{c.winner_display}</strong>{c.drawn_at ? ` — ${fmt(c.drawn_at)}` : ""}</p>}
            <details>
              <summary className="cursor-pointer text-sm text-gold-dark">تفاصيل الحملة {c.status === "drawn" || c.status === "archived" ? "(مقفلة بعد السحب)" : "وتعديلها"}</summary>
              <div className="mt-3"><CampaignForm c={view} /></div>
            </details>
          </section>
        );
      })}

      <section className="space-y-3 rounded-2xl border border-dashed border-gold/40 bg-white p-5">
        <h2 className="text-lg font-bold">＋ حملة جديدة</h2>
        <p className="text-sm opacity-70">تُنشأ مسودة لا تظهر للزبائن حتى تضغط «نشر الحملة». اكتب الجائزة الفعلية؛ الشروط أدناه مقترحة وتطابق ما ينفذه النظام.</p>
        <CampaignForm />
      </section>
    </div>
  );
}
