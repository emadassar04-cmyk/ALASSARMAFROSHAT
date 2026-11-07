// خادم محلي للاختبار فقط: يحاكي الجزء الذي يستخدمه المتجر من Supabase REST
// (استدعاء دوال catalog_* بدور anon، وقراءة إعدادات المتجر) على قاعدة PostgreSQL محلية.
// لا يُستخدم في الإنتاج ولا يُنشر.
import http from "node:http";
import pg from "pg";

const PORT = Number(process.env.LOCAL_API_PORT ?? 54321);
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/alassar_test",
});
const ALLOWED_RPC = /^(catalog_[a-z_]+|get_variant_availability)$/;
const SETTINGS_COLS = ["store_name", "whatsapp_number", "contact_phone", "is_published", "maintenance_mode"];

async function asAnon(sql, params) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("set local role anon");
    await c.query(`select set_config('request.jwt.claims', '{"role":"anon"}', true)`);
    const r = await c.query(sql, params);
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

function send(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

http
  .createServer(async (req, res) => {
    if (req.method === "OPTIONS") return send(res, 204);
    const url = new URL(req.url, "http://local");
    try {
      const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/);
      if (rpc && req.method === "POST") {
        if (!ALLOWED_RPC.test(rpc[1])) return send(res, 404, { message: "not allowed in local api" });
        let raw = "";
        for await (const chunk of req) raw += chunk;
        const args = raw ? JSON.parse(raw) : {};
        const names = Object.keys(args).filter((k) => /^[a-z_]+$/.test(k));
        const values = names.map((k) => {
          const v = args[k];
          return v !== null && typeof v === "object" && !Array.isArray(v) ? JSON.stringify(v) : v;
        });
        const call = `select public.${rpc[1]}(${names.map((n, i) => `${n} => $${i + 1}`).join(", ")}) as r`;
        const { rows } = await asAnon(call, values);
        return send(res, 200, rows[0]?.r ?? null);
      }
      if (url.pathname === "/rest/v1/store_settings" && req.method === "GET") {
        const { rows } = await asAnon(`select ${SETTINGS_COLS.join(", ")} from public.store_settings limit 1`);
        return send(res, 200, rows[0] ?? null);
      }
      send(res, 404, { message: "not found" });
    } catch (e) {
      send(res, 400, { message: e.message, code: e.code });
    }
  })
  .listen(PORT, () => console.log(`local api on :${PORT}`));
