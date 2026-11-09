"use server";
import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { gazaDateTime, moneyString } from "@/lib/admin/actions-util";

export type State = { ok?: boolean; error?: string; message?: string };

const ERRORS: [RegExp, string][] = [
  [/campaigns_slug_key|duplicate key/, "الرابط المختصر مستخدم لحملة أخرى."],
  [/campaigns_slug_check/, "الرابط المختصر: حروف إنجليزية صغيرة وأرقام وشرطات فقط (3 أحرف على الأقل)."],
  [/campaigns_check|end_at/, "تاريخ النهاية يجب أن يكون بعد البداية."],
  [/terms/, "اكتب شروط الحملة (20 حرفاً على الأقل)."],
  [/prize/, "اكتب الجائزة."],
  [/campaign_locked/, "لا يمكن تعديل حملة بعد السحب."],
  [/overlapping_campaign/, "توجد حملة منشورة أخرى في الفترة نفسها."],
  [/campaign_has_entries/, "لا يمكن إرجاع حملة فيها مشاركات إلى مسودة."],
  [/campaign_not_ended/, "لا يمكن السحب قبل انتهاء الحملة."],
  [/no_entries/, "لا توجد مشاركات سارية للسحب."],
  [/not_drawable|invalid_transition/, "لا يمكن تنفيذ هذا الإجراء في حالة الحملة الحالية."],
  [/forbidden/, "لا تملك صلاحية إدارة الحملات."],
];
const msg = (m: string) => ERRORS.find(([re]) => re.test(m))?.[1] ?? "تعذر الحفظ.";

export async function saveCampaign(_: State, f: FormData): Promise<State> {
  await requireStaff();
  let payload: Record<string, string | null>;
  try {
    payload = {
      id: String(f.get("id") ?? "") || null,
      slug: String(f.get("slug") ?? "").trim().toLowerCase(),
      title: String(f.get("title") ?? "").trim().slice(0, 120),
      description: String(f.get("description") ?? "").trim().slice(0, 2000),
      prize: String(f.get("prize") ?? "").trim().slice(0, 300),
      prize_image_url: String(f.get("prize_image_url") ?? "").trim() || null,
      terms: String(f.get("terms") ?? "").trim().slice(0, 5000),
      start_at: gazaDateTime(f.get("start_at")),
      end_at: gazaDateTime(f.get("end_at")),
      min_amount: moneyString(f.get("min_amount"), { optional: true }),
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!payload.start_at || !payload.end_at) return { error: "حدد تاريخ البداية والنهاية." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_campaign", { p: payload });
  if (error) return { error: msg(error.message) };
  updateTag("campaign");
  revalidatePath("/admin/campaigns");
  return { ok: true, message: "تم الحفظ ✓" };
}

export async function setStatus(_: State, f: FormData): Promise<State> {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_campaign_status", { p_id: String(f.get("id")), p_status: String(f.get("status")) });
  if (error) return { error: msg(error.message) };
  updateTag("campaign");
  revalidatePath("/admin/campaigns");
  const added = (data as { backfilled?: number } | null)?.backfilled ?? 0;
  return { ok: true, message: added ? `نُشرت الحملة وأُضيفت ${added} مشاركة من مشتريات سابقة ضمن فترتها ✓` : "تم ✓" };
}

export async function drawWinner(_: State, f: FormData): Promise<State> {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("draw_campaign_winner", { p_id: String(f.get("id")) });
  if (error) return { error: msg(error.message) };
  updateTag("campaign");
  revalidatePath("/admin/campaigns");
  const d = data as { winner: string; entries: number };
  return { ok: true, message: `الفائز: ${d.winner} (من بين ${d.entries} مشاركة)` };
}
