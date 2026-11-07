import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type StaffContext = {
  is_staff_account: boolean;
  aal: "aal1" | "aal2";
  role: string | null;
  role_name: string | null;
  full_name: string | null;
  permissions: string[];
};

/**
 * حارس صفحات الإدارة. يتحقق في الخادم (لا يكفي proxy وحده):
 * 1) مستخدم موثّق (JWT متحقق منه عبر getClaims)
 * 2) حساب موظف نشط
 * 3) جلسة بخطوتين aal2
 */
// cache: التخطيط والصفحة يطلبانها في نفس الطلب؛ تُنفَّذ مرة واحدة فقط
export const requireStaff = cache(async function requireStaff(): Promise<StaffContext & { email: string | undefined }> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims) redirect("/admin/login");

  const { data, error } = await supabase.rpc("my_staff_context");
  if (error || !data) redirect("/admin/login?error=context");
  const ctx = data as StaffContext;

  if (!ctx.is_staff_account) redirect("/admin/login?error=not_staff");
  if (ctx.aal !== "aal2") redirect("/admin/mfa");
  return { ...ctx, email: claims.email as string | undefined };
});
