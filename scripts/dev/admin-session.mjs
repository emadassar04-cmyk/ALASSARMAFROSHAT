// جلسة دخول محلية لاختبار الإدارة: كوكي Supabase بنفس صيغة @supabase/ssr، بـ JWT موقّع بسر الاختبار المحلي فقط
import { sign } from "./admin-gateway.mjs";

export const STAFF = {
  owner: "aaaaaaaa-0000-0000-0000-000000000001", orders: "aaaaaaaa-0000-0000-0000-000000000002",
  viewer: "aaaaaaaa-0000-0000-0000-000000000003", products: "aaaaaaaa-0000-0000-0000-000000000004",
  accountant: "aaaaaaaa-0000-0000-0000-000000000005", reception: "aaaaaaaa-0000-0000-0000-000000000006",
};

export function sessionCookie(who = "owner", { aal = "aal2", host = "localhost" } = {}) {
  const id = STAFF[who];
  const exp = Math.floor(Date.now() / 1000) + 6 * 3600;
  const access_token = sign({ sub: id, role: "authenticated", aal, email: `${who}@alassar.local`, aud: "authenticated", exp });
  const session = {
    access_token, token_type: "bearer", expires_in: 6 * 3600, expires_at: exp, refresh_token: "local-refresh",
    user: { id, aud: "authenticated", role: "authenticated", email: `${who}@alassar.local`, app_metadata: {}, user_metadata: {} },
  };
  return { name: `sb-${host}-auth-token`, value: "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"), domain: host, path: "/" };
}
