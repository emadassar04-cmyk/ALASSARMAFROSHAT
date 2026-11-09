// بوابة اختبار محلية فقط للوحة الإدارة: تمرر /rest/v1 إلى PostgREST محلي (Docker)،
// وتحاكي /auth/v1/user بالتحقق من JWT موقّع بسر اختبار محلي. لا تُستخدم في الإنتاج ولا تُنشر.
import http from "node:http";
import crypto from "node:crypto";

const PORT = Number(process.env.ADMIN_GATEWAY_PORT ?? 54322);
const PGRST = process.env.PGRST_URL ?? "http://127.0.0.1:3001";
export const SECRET = process.env.LOCAL_JWT_SECRET ?? "local-test-jwt-secret-not-real-0123456789";
const SERVICE_KEY = process.env.LOCAL_SERVICE_KEY ?? "local-service-key";

const b64u = (b) => Buffer.from(b).toString("base64url");
export function sign(payload) {
  const h = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const p = b64u(JSON.stringify(payload));
  return `${h}.${p}.${crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url")}`;
}
function verify(token) {
  const [h, p, s] = token.split(".");
  if (!s) return null;
  const good = crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url");
  if (good.length !== s.length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(s))) return null;
  const claims = JSON.parse(Buffer.from(p, "base64url").toString());
  return claims.exp && claims.exp * 1000 < Date.now() ? null : claims;
}
const SERVICE_JWT = sign({ role: "service_role", exp: Math.floor(Date.now() / 1000) + 86400 * 30 });

function cors(res) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  http.createServer(async (req, res) => {
    cors(res);
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
    const url = new URL(req.url, "http://local");
    const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    if (url.pathname === "/auth/v1/user") {
      const c = verify(bearer);
      res.writeHead(c ? 200 : 401, { "content-type": "application/json" });
      return res.end(JSON.stringify(c ? { id: c.sub, aud: "authenticated", role: c.role, email: c.email, app_metadata: {}, user_metadata: {}, factors: [] }
        : { code: 401, msg: "invalid JWT" }));
    }
    if (url.pathname.startsWith("/auth/v1/")) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(url.pathname.includes("factors") ? "[]" : "{}");
    }
    if (!url.pathname.startsWith("/rest/v1")) { res.writeHead(404); return res.end(); }
    const headers = { ...req.headers };
    delete headers.host; delete headers.apikey; delete headers["content-length"];
    if (bearer === SERVICE_KEY || req.headers.apikey === SERVICE_KEY) headers.authorization = `Bearer ${SERVICE_JWT}`;
    else if (!verify(bearer)) delete headers.authorization;
    let body = [];
    for await (const ch of req) body.push(ch);
    body = Buffer.concat(body);
    try {
      const r = await fetch(PGRST + url.pathname.replace(/^\/rest\/v1/, "") + url.search, {
        method: req.method, headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body,
      });
      const out = Buffer.from(await r.arrayBuffer());
      const h = {};
      r.headers.forEach((v, k) => { if (!["content-encoding", "transfer-encoding", "content-length", "connection"].includes(k)) h[k] = v; });
      res.writeHead(r.status, h);
      res.end(out);
    } catch (e) {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: String(e) }));
    }
  }).listen(PORT, () => console.log(`admin gateway on :${PORT}`));
}
