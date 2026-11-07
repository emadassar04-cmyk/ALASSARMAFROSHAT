// اختبار End-to-End لإتمام الطلب على النسخة المحلية (قاعدة اختبار محلية فقط)
// التشغيل: BASE_URL=http://localhost:3100 NODE_PATH=$(npm root -g) node scripts/dev/checkout-e2e.mjs
import { createRequire } from "node:module";
import pg from "pg";

const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/alassar_test" });
await db.connect();
let passed = 0;
const failures = [];
async function check(name, fn) {
  try { await fn(); passed++; console.log(`PASS: ${name}`); }
  catch (e) { failures.push(name); console.log(`FAIL: ${name}\n   ${String(e.message).split("\n")[0]}`); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const url = (p) => BASE + encodeURI(p);
const one = async (sql, params) => (await db.query(sql, params)).rows[0];

const browser = await chromium.launch();
const page = await (await browser.newContext({ locale: "ar", viewport: { width: 1280, height: 1000 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

async function addToCart(slug, qty = 1) {
  await page.goto(url(`/product/${slug}`));
  for (let i = 1; i < qty; i++) await page.getByRole("button", { name: "زيادة الكمية" }).click();
  await page.getByRole("button", { name: "أضف إلى السلة" }).click();
  await page.getByRole("status").filter({ hasText: "تمت الإضافة" }).waitFor();
}
const summary = () => page.locator("form aside").textContent();

await check("السلة ← إتمام الطلب: الملخص من الخادم", async () => {
  await addToCart("مخدة-فندقية", 2);
  await page.goto(url("/cart"));
  await page.getByRole("link", { name: "إتمام الطلب" }).click();
  await page.getByRole("heading", { name: "إتمام الطلب" }).waitFor();
  await page.locator("form aside").filter({ hasText: "90" }).waitFor();
});

await check("مناطق التوصيل تظهر برسومها ويُحتسب التوصيل", async () => {
  // اختيار المنطقة بالاسم (نص الخيار يحتوي علامة اتجاه ورمز العملة بعد الرقم)
  const zone = await page.getByLabel("المنطقة *").locator("option", { hasText: "النصيرات" }).getAttribute("value");
  await page.getByLabel("المنطقة *").selectOption(zone);
  await page.locator("form aside").filter({ hasText: "105" }).waitFor({ timeout: 5000 });
});

await check("كوبون غير صالح يظهر سببه", async () => {
  await page.getByLabel("كود الخصم").fill("NOPE");
  await page.getByRole("button", { name: "تطبيق" }).click();
  await page.getByText("الكود غير موجود أو منتهي").waitFor();
});

await check("كوبون صالح يخصم من الإجمالي (90 − 9 + 15 = 96)", async () => {
  await page.getByLabel("كود الخصم").fill("welcome10");
  await page.getByRole("button", { name: "تطبيق" }).click();
  await page.getByText("تم تطبيق WELCOME10").waitFor();
  const s = await summary();
  assert(s.includes("96"), `total 96, got: ${s}`);
});

await check("الدفع عند الاستلام يظهر للتوصيل فقط، والدفع في المحل للاستلام فقط", async () => {
  assert(await page.getByText("الدفع نقداً عند الاستلام").count() === 1, "COD for delivery");
  assert(await page.getByText("الدفع نقداً في المحل").count() === 0, "no in-store for delivery");
});

await check("بيانات ناقصة: رسالة خطأ واضحة ولا يُنشأ طلب", async () => {
  const before = (await one("select count(*)::int n from public.orders")).n;
  await page.getByText("تحويل بنكي").click();
  await page.getByText("بيانات الحساب البنكي").first().waitFor();
  await page.getByRole("button", { name: "إرسال الطلب" }).click();
  await page.getByRole("alert").filter({ hasText: /الاسم|الشروط|العنوان/ }).waitFor();
  assert((await one("select count(*)::int n from public.orders")).n === before, "no order created");
});

let orderUrl = "";
await check("طلب صحيح (توصيل + تحويل بنكي + كوبون) ← صفحة التأكيد", async () => {
  await page.getByLabel("الاسم الكامل *").fill("سامي الاختبار");
  await page.getByLabel("رقم الهاتف (WhatsApp) *").fill("0599 555 101");
  await page.getByLabel("العنوان بالتفصيل *").fill("النصيرات، شارع صلاح الدين، قرب المسجد");
  await page.getByText("أوافق على شروط الاستخدام").click();
  await page.getByRole("button", { name: "إرسال الطلب" }).click();
  await page.getByRole("heading", { name: "تم استلام طلبك ✓" }).waitFor({ timeout: 15000 }).catch(async (e) => {
    throw new Error(`no confirmation; alerts: ${JSON.stringify(await page.getByRole("alert").allTextContents())}`);
  });
  orderUrl = page.url();
  assert(/\/order\/ALS-\d+\?t=[0-9a-f]{64}/.test(decodeURI(orderUrl)), orderUrl);
  await page.getByText("سنرسل لك بيانات الحساب عبر WhatsApp").waitFor();
  assert((await page.locator("main").textContent()).includes("96"), "total on confirmation");
});

await check("قاعدة البيانات: الطلب والحجز والخصم والمصدر صحيحة", async () => {
  const o = await one(`select o.total::text, o.discount_total::text, o.delivery_fee::text, o.status, o.payment_status, o.source,
    o.customer_phone, (select sum(reserved) from public.inventory i join public.product_variants v on v.id = i.variant_id
                       join public.products p on p.id = v.product_id where p.slug = 'مخدة-فندقية')::int as reserved
    from public.orders o order by created_at desc limit 1`);
  assert(o.total === "96.00" && o.discount_total === "9.00" && o.delivery_fee === "15.00", JSON.stringify(o));
  assert(o.status === "received" && o.payment_status === "awaiting_review", "status");
  assert(o.customer_phone === "0599555101" && o.reserved === 2 && o.source === "direct", JSON.stringify(o));
});

await check("السلة فُرغت بعد الطلب، والطلب محفوظ في «طلباتي»", async () => {
  await page.goto(url("/track"));
  await page.getByRole("link", { name: /ALS-/ }).first().waitFor();
  assert(await page.getByRole("link", { name: "السلة (0)" }).count() === 1, "cart empty");
});

await check("رمز تتبع خاطئ لا يكشف الطلب", async () => {
  await page.goto(orderUrl.replace(/t=[0-9a-f]+/, "t=" + "0".repeat(64)));
  await page.getByRole("heading", { name: "لم نجد هذا الطلب" }).waitFor();
});

await check("استلام من المحل + دفع في المحل", async () => {
  await addToCart("طقم-شراشف-ساتان");
  await page.goto(url("/checkout"));
  await page.getByText("استلام من المحل").click();
  await page.getByText("الدفع نقداً في المحل").click();
  await page.getByLabel("الاسم الكامل *").fill("هدى الاختبار");
  await page.getByLabel("رقم الهاتف (WhatsApp) *").fill("0599555202");
  await page.getByText("أوافق على شروط الاستخدام").click();
  await page.getByRole("button", { name: "إرسال الطلب" }).click();
  await page.getByRole("heading", { name: "تم استلام طلبك ✓" }).waitFor({ timeout: 15000 });
  const o = await one("select fulfillment, payment_method, total::text, delivery_fee::text from public.orders order by created_at desc limit 1");
  assert(o.fulfillment === "pickup" && o.payment_method === "cash_in_store" && o.total === "140.00" && o.delivery_fee === "0.00", JSON.stringify(o));
});

await check("الكمية غير المتوفرة: تنبيه في الملخص وزر الإرسال معطل", async () => {
  await addToCart("سجادة-تركية-كلاسيك");
  await db.query(`update public.inventory i set reserved = on_hand from public.product_variants v, public.products p
                  where v.id = i.variant_id and p.id = v.product_id and p.slug = 'سجادة-تركية-كلاسيك' and v.is_default`);
  await page.goto(url("/checkout"));
  await page.getByText("الكمية غير متوفرة").waitFor();
  assert(await page.getByRole("button", { name: "إرسال الطلب" }).isDisabled(), "submit disabled");
  await db.query(`update public.inventory i set reserved = 0 from public.product_variants v, public.products p
                  where v.id = i.variant_id and p.id = v.product_id and p.slug = 'سجادة-تركية-كلاسيك' and v.is_default`);
});

await check("الحد من التكرار: الطلب الرابع بنفس الرقم خلال 10 دقائق مرفوض", async () => {
  await page.goto(url("/cart"));
  const phone = "0599555303";
  for (let i = 1; i <= 4; i++) {
    if (i > 1) await addToCart("بطانية-شتوية-ناعمة");
    await page.goto(url("/checkout"));
    await page.getByText("استلام من المحل").click();
    await page.getByText("الدفع نقداً في المحل").click();
    await page.getByLabel("الاسم الكامل *").fill("محاولة متكررة");
    await page.getByLabel("رقم الهاتف (WhatsApp) *").fill(phone);
    await page.getByText("أوافق على شروط الاستخدام").click();
    await page.getByRole("button", { name: "إرسال الطلب" }).click();
    if (i < 4) await page.getByRole("heading", { name: "تم استلام طلبك ✓" }).waitFor({ timeout: 15000 });
    else await page.getByRole("alert").filter({ hasText: "طلبات كثيرة" }).waitFor({ timeout: 15000 });
  }
  const n = (await one("select count(*)::int n from public.orders where customer_phone = $1", [phone])).n;
  assert(n === 3, `orders for phone: ${n}`);
});

await check("لا أخطاء JavaScript", async () => assert(errors.length === 0, errors.join(" | ")));

await browser.close();
await db.end();
console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
