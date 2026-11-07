import "server-only";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

// عميل بمفتاح الخدمة السري: على الخادم فقط، ولعمليات محددة (إنشاء الطلب والحد من التكرار).
// المفتاح يُضبط في Vercel باسم SUPABASE_SERVICE_ROLE_KEY ولا يبدأ بـ NEXT_PUBLIC.
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createSupabase(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
