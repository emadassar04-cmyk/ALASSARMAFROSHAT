// خادم محلي للاختبار فقط: يحاكي الجزء الذي يستخدمه المتجر من Supabase REST
// (استدعاء دوال catalog_* بدور anon، وقراءة إعدادات المتجر) على قاعدة PostgreSQL محلية.
// لا يُستخدم في الإنتاج ولا يُنشر.
import http from "node:http";
import pg from "pg";

const PORT = Number(process.env.LOCAL_API_PORT ?? 54321);
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/alassar_test",
});
// إعادة إنشاء قاعدة الاختبار تقطع الاتصالات المفتوحة: نتجاهلها ويُفتح اتصال جديد عند الطلب التالي
pool.on("error", (e) => console.warn("pg pool connection dropped:", e.code ?? e.message));

const ANON_RPC = /^(catalog_[a-z_]+|get_variant_availability|quote_order|track_order)$/;
// مفتاح اختبار محلي فقط (لا علاقة له بمفتاح Supabase الحقيقي)
const SERVICE_KEY = process.env.LOCAL_SERVICE_KEY ?? "local-service-key";
const SERVICE_RPC = /^(place_order|rate_limit_hit|submit_custom_order)$/;
const TABLES = {
  store_settings: "select store_name, whatsapp_number, contact_phone, is_published, maintenance_mode, site_url, ga_measurement_id, meta_pixel_id, google_site_verification from public.store_settings",
  delivery_zones: "select id, name, fee, eta_text, sort_order from public.delivery_zones where is_active order by sort_order, name",
  payment_methods: "select code, name_ar, instructions, sort_order from public.payment_methods where is_enabled order by sort_order",
  custom_fabrics: "select product_type, name, texture_url from public.custom_fabrics where is_active order by sort_order, name",
  custom_colors: "select name, hex from public.custom_colors where is_active order by sort_order, name",
};

async function asRole(role, sql, params) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(`set local role ${role === "service_role" ? "service_role" : "anon"}`);
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role })]);
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
    const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    const role = bearer === SERVICE_KEY || req.headers.apikey === SERVICE_KEY ? "service_role" : "anon";
    try {
      const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/);
      if (rpc && req.method === "POST") {
        const allowed = ANON_RPC.test(rpc[1]) || (role === "service_role" && SERVICE_RPC.test(rpc[1]));
        if (!allowed) return send(res, 401, { message: "permission denied (local api)", code: "42501" });
        let raw = "";
        for await (const chunk of req) raw += chunk;
        const args = raw ? JSON.parse(raw) : {};
        const names = Object.keys(args).filter((k) => /^[a-z_]+$/.test(k));
        const values = names.map((k) => {
          const v = args[k];
          return v !== null && typeof v === "object" && !Array.isArray(v) ? JSON.stringify(v) : v;
        });
        const call = `select public.${rpc[1]}(${names.map((n, i) => `${n} => $${i + 1}`).join(", ")}) as r`;
        const { rows } = await asRole(role, call, values);
        return send(res, 200, rows[0]?.r ?? null);
      }
      const table = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/)?.[1];
      if (table && TABLES[table] && req.method === "GET") {
        const { rows } = await asRole(role, TABLES[table]);
        const single = (req.headers.accept ?? "").includes("vnd.pgrst.object");
        return send(res, 200, single ? rows[0] ?? null : rows);
      }
      send(res, 404, { message: "not found" });
    } catch (e) {
      send(res, 400, { message: e.message, code: e.code, details: e.detail ?? null, hint: null });
    }
  })
  .listen(PORT, () => console.log(`local api on :${PORT}`));
