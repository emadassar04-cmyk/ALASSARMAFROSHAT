"use server";
import { updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PolicySlug } from "@/lib/catalog-types";

export type FormState = { ok?: boolean; error?: string };

const SLUGS: PolicySlug[] = ["delivery", "returns", "privacy"];

export async function savePolicy(_: FormState, f: FormData): Promise<FormState> {
  const slug = String(f.get("slug") ?? "") as PolicySlug;
  if (!SLUGS.includes(slug)) return { error: "صفحة غير معروفة." };
  const title = String(f.get("title") ?? "").trim().slice(0, 120);
  const body = String(f.get("body") ?? "").replace(/\r/g, "").trim().slice(0, 20000);
  const publish = f.get("is_published") === "on";
  if (title.length < 2) return { error: "اكتب عنوان الصفحة." };
  if (publish && body.length < 40) return { error: "النص قصير جداً للنشر. اكتب السياسة كاملة أولاً." };
  if (publish && /\[[^\]]*\]/.test(body)) return { error: "ما زالت في النص خانات بين [ ] لم تُملأ. املأها أو احذفها قبل النشر." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("store_policies")
    .update({ title, body, is_published: publish }).eq("slug", slug).select("slug");
  if (error) return { error: /publish_ready/.test(error.message) ? "النص غير جاهز للنشر (فارغ أو فيه خانات لم تُملأ)." : "تعذر الحفظ." };
  if (!data?.length) return { error: "لا تملك صلاحية تعديل الإعدادات." };
  updateTag("policies");
  return { ok: true };
}

// يقبل المعرّف وحده أو الوسم كاملاً كما ينسخه المدير من Google
function verificationToken(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const m = s.match(/content=["']([^"']+)["']/);
  return (m ? m[1] : s).trim();
}

export async function saveMarketing(_: FormState, f: FormData): Promise<FormState> {
  const ga = String(f.get("ga") ?? "").trim().toUpperCase() || null;
  const pixel = String(f.get("pixel") ?? "").replace(/\s/g, "") || null;
  const verification = verificationToken(String(f.get("verification") ?? ""));
  if (ga && !/^G-[A-Z0-9]{4,20}$/.test(ga)) return { error: "معرّف Google Analytics يبدأ بـ G- مثل G-ABC123XYZ." };
  if (pixel && !/^[0-9]{8,20}$/.test(pixel)) return { error: "معرّف Meta Pixel أرقام فقط (عادة 15–16 رقماً)." };
  if (verification && !/^[A-Za-z0-9_-]{20,100}$/.test(verification)) return { error: "رمز التحقق من Google Search Console غير صحيح." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("store_settings")
    .update({ ga_measurement_id: ga, meta_pixel_id: pixel, google_site_verification: verification })
    .eq("id", true).select("id");
  if (error) return { error: "تعذر الحفظ." };
  if (!data?.length) return { error: "لا تملك صلاحية تعديل الإعدادات." };
  updateTag("settings");
  return { ok: true };
}
