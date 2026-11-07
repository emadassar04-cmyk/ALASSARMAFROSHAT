import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { KeyGenerator } from "./KeyGenerator";

export const instant = false;

const dt = (s: string | null) => s ? new Date(s).toLocaleString("ar", { numberingSystem: "latn", timeZone: "Asia/Gaza" }) : "لم يُستخدم بعد";

export default async function IntegrationsPage() {
  await requireStaff();
  const supabase = await createClient();
  const [{ data: status }, { data: deliveries }] = await Promise.all([
    supabase.rpc("integration_key_status", { p_name: "n8n" }),
    supabase.from("notification_deliveries").select("status").eq("channel", "telegram"),
  ]);
  const s = status as { exists: boolean; created_at: string; last_used_at: string | null } | null;
  const count = (st: string) => (deliveries ?? []).filter((d) => d.status === st).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">التكاملات</h1>
      <section className="space-y-3 rounded-2xl border border-gold/20 bg-white p-5">
        <h2 className="text-lg font-bold">n8n ← Telegram</h2>
        <p className="text-sm opacity-80">
          n8n يسحب إشعارات الطلبات والتقرير اليومي من قاعدة البيانات بمفتاح خاص لا يسمح إلا بذلك.
          إن كان n8n متوقفاً (جهازك مطفأ)، تُحفظ الإشعارات وتُرسل عند عودته.
        </p>
        <dl className="grid grid-cols-2 gap-1 text-sm">
          <dt>حالة المفتاح</dt><dd>{s?.exists ? "مُنشأ" : "غير مُنشأ"}</dd>
          {s?.exists && <><dt>آخر استخدام من n8n</dt><dd>{dt(s.last_used_at)}</dd></>}
          <dt>إشعارات بانتظار الإرسال</dt><dd>{count("pending") + count("failed") + count("processing")}</dd>
          <dt>أُرسلت</dt><dd>{count("sent")}</dd>
          {count("dead") > 0 && <><dt className="text-red-700">فشلت نهائياً</dt><dd className="text-red-700">{count("dead")}</dd></>}
        </dl>
        <KeyGenerator hasKey={!!s?.exists} />
      </section>
    </div>
  );
}
