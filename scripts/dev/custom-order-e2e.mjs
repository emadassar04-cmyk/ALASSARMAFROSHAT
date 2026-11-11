// اختبارات قبول «فصّل منتجك على مقاسك» على نسخة محلية (قاعدة الاختبار فقط)
// التشغيل: BASE_URL=http://localhost:3100 node scripts/dev/custom-order-e2e.mjs
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
let passed = 0; const failures = [];
async function check(name, fn) {
  try { await fn(); passed++; console.log(`PASS: ${name}`); }
  catch (e) { failures.push(name); console.log(`FAIL: ${name}\n   ${String(e.message).split("\n")[0]}`); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const sql = (q) => execSync(`psql -X -At -U postgres -h localhost -d alassar_test -c "${q.replace(/"/g, '\\"')}"`, { env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD ?? "postgres" } }).toString().trim();

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: "ar", viewport: { width: 1366, height: 900 } });
await ctx.route(/googletagmanager\.com|connect\.facebook\.net/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
await ctx.route(/wa\.me|api\.whatsapp\.com/, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<html>ok</html>" }));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const next = (label) => page.getByRole("button", { name: new RegExp(`^التالي: ${label}`) }).click();
const preview = () => page.locator("[data-preview-mode]");
const labelText = async () => (await preview().innerText()).replace(/\s+/g, " ");

await check("1) الستائر: البطاقة ← إدخال العرض والارتفاع بالمتر ← المعاينة ثلاثية الأبعاد تعرض القيم", async () => {
  await page.goto(`${BASE}/special-order`);
  await page.getByRole("heading", { level: 1, name: /فصّل منتجك/ }).waitFor();
  assert(await page.getByRole("link", { name: /ابدأ التفصيل/ }).count() === 4, "4 cards");
  await page.getByRole("link", { name: /الستائر.*ابدأ التفصيل/ }).click();
  await page.getByRole("heading", { name: "أدخل المقاسات" }).waitFor();
  await page.getByLabel("عرض الشباك").fill("2.5");
  await page.getByLabel("ارتفاع الشباك").fill("2.8");
  await preview().waitFor();
  assert(await preview().getAttribute("data-preview-mode") === "3d", "3d mode");
  await page.waitForFunction(() => document.querySelector("[data-preview-mode]")?.textContent?.includes("2.5 م"), null, { timeout: 15000 });
  assert((await labelText()).includes("2.8 م"), "height label");
});

await check("2) إضافة شباك ثانٍ بمقاس مختلف، والمعاينة تعرضه", async () => {
  await page.getByRole("button", { name: "إضافة شباك بمقاس مختلف" }).click();
  await page.getByLabel("عرض الشباك").nth(1).fill("3");
  await page.getByLabel("ارتفاع الشباك").nth(1).fill("2.7");
  await page.waitForFunction(() => document.querySelector("[data-preview-mode]")?.textContent?.includes("3 م"), null, { timeout: 10000 });
  assert((await labelText()).includes("2.7 م"), "second window shown");
});

await check("5) تغيير المقاس يحدّث المعاينة فوراً", async () => {
  await page.getByLabel("عرض الشباك").nth(1).fill("3.25");
  await page.waitForFunction(() => document.querySelector("[data-preview-mode]")?.textContent?.includes("3.25 م"), null, { timeout: 5000 });
});

await check("6) تغيير اللون يغيّر المجسم فعلاً (مقارنة صورة المعاينة)", async () => {
  await next("الخامة واللون");
  await page.getByRole("heading", { name: "اختر الخامة واللون" }).waitFor();
  await page.waitForTimeout(600);
  const shot = () => page.evaluate(() => document.querySelector("[data-preview-mode] canvas")?.toDataURL("image/jpeg", 0.5));
  const before = await shot();
  await page.getByTitle("كحلي", { exact: true }).click();
  await page.waitForTimeout(600);
  const after = await shot();
  assert(before && after && before !== after, "canvas changed");
  assert(await page.getByText("المختار: كحلي").isVisible(), "selected color text");
});

await check("12) لا تضيع البيانات عند الرجوع بين الخطوات أو تحديث الصفحة", async () => {
  await page.getByRole("button", { name: "السابق" }).first().click();
  assert(await page.getByLabel("عرض الشباك").nth(1).inputValue() === "3.25", "kept after back");
  await page.reload();
  await page.getByRole("heading", { name: "أدخل المقاسات" }).waitFor();
  assert(await page.getByLabel("عرض الشباك").first().inputValue() === "2.5", "kept after reload");
  assert(await page.getByLabel("عرض الشباك").count() === 2, "two windows kept");
});

await check("7) التحقق: فارغ، صفر، سالب، أكثر من منزلتين، وحدة خاطئة، جوال غير صالح", async () => {
  const w = page.getByLabel("عرض الشباك").first();
  for (const [v, msg] of [["", "أدخل عرض الشباك"], ["0", "رقم غير صحيح|أكبر من صفر|بين"], ["-2", "رقم غير صحيح"], ["2.555", "رقم غير صحيح"], ["250", "بين 0.2 و12 متر"]]) {
    await w.fill(v);
    await next("الخامة واللون");
    await page.getByText(new RegExp(msg)).first().waitFor({ timeout: 3000 });
    assert(await page.getByRole("heading", { name: "أدخل المقاسات" }).isVisible(), `blocked on ${v || "empty"}`);
  }
  await w.fill("2,75"); // فاصلة عشرية عربية/أوروبية مقبولة
  await next("الخامة واللون");
  await page.getByRole("heading", { name: "اختر الخامة واللون" }).waitFor();
});

await check("8 + 9) إرسال الطلب: يُحفظ في قاعدة البيانات برقم، وتُفتح WhatsApp برسالة منظمة", async () => {
  await next("المعاينة");
  await page.getByRole("heading", { name: "معاينة طلبك" }).waitFor();
  await next("بياناتك");
  await page.getByLabel("الاسم").fill("عميل اختبار");
  await page.getByLabel("رقم الجوال").fill("12345");
  await page.getByLabel("المدينة أو المنطقة").fill("دير البلح");
  await next("مراجعة وإرسال");
  await page.getByText("رقم جوال غير صحيح").waitFor();
  await page.getByLabel("رقم الجوال").fill("0599 111 222");
  await next("مراجعة وإرسال");
  await page.getByRole("heading", { name: "راجع طلبك قبل الإرسال" }).waitFor();
  assert(await page.getByText("الشباك 1: عرض 2.75 م × ارتفاع 2.8 م").isVisible(), "review shows window 1");
  assert(await page.getByText("الشباك 2: عرض 3.25 م × ارتفاع 2.7 م").isVisible(), "review shows window 2");
  assert(await page.getByAltText("صورة المعاينة").isVisible(), "preview image in review");
  const popup = ctx.waitForEvent("page");
  const btn = page.getByRole("button", { name: "إرسال الطلب عبر WhatsApp" });
  await btn.dblclick(); // نقر مزدوج: يجب ألا يكرر الطلب
  const wa = await popup;
  await page.getByRole("heading", { name: "تم استلام طلبك" }).waitFor({ timeout: 15000 });
  const number = (await page.getByText(/SO-\d+/).first().textContent()).match(/SO-\d+/)[0];
  await wa.waitForURL(/wa\.me|whatsapp/, { timeout: 10000 });
  const text = decodeURIComponent(new URL(wa.url()).searchParams.get("text") ?? "");
  assert(text.includes(number) && text.includes("الشباك 2: عرض 3.25 م"), "whatsapp message has order details");
  const row = sql(`select count(*) || '|' || max(phone) || '|' || max(product_type) || '|' || max(jsonb_array_length(specs->'windows')) || '|' || bool_and(preview_image like 'data:image/jpeg%') from public.custom_orders where number = '${number}'`);
  assert(/^1\|0599111222\|curtains\|2\|(t|true)$/.test(row), `db row: ${row}`);
  assert(sql(`select count(*) from public.custom_orders where customer_name = 'عميل اختبار'`) === "1", "no duplicate on double click");
});

await check("3) بطانة السقف: العرض والطول بالمتر، وصورتها ليست صورة بطانية", async () => {
  await page.goto(`${BASE}/special-order?type=ceiling#studio`);
  await page.getByLabel("عرض السقف").fill("4");
  await page.getByLabel("طول السقف").fill("5.25");
  await page.waitForFunction(() => document.querySelector("[data-preview-mode]")?.textContent?.includes("طول السقف 5.25 م"), null, { timeout: 15000 });
  const src = await page.locator("a", { hasText: "بطانة السقف" }).locator("img").getAttribute("src");
  assert(src.includes("ceiling") && !/blanket/.test(src), `ceiling image: ${src}`);
});

await check("4) وجه الفرشة: الأبعاد الثلاثة بالسنتيمتر وتسميات مميزة للعرض والطول والارتفاع", async () => {
  await page.goto(`${BASE}/special-order?type=mattress#studio`);
  await page.getByLabel("عرض الفرشة").fill("160");
  await page.getByLabel("طول الفرشة").fill("200");
  await page.getByLabel("ارتفاع الفرشة").fill("25");
  await page.waitForFunction(() => { const t = document.querySelector("[data-preview-mode]")?.textContent ?? ""; return t.includes("العرض 160 سم") && t.includes("الطول 200 سم") && t.includes("الارتفاع 25 سم"); }, null, { timeout: 15000 });
  await page.getByLabel("عرض الفرشة").fill("210");
  await next("الخامة واللون");
  await page.getByText("تأكد أنك لم تبدّل بينهما").waitFor();
});

await check("لا أخطاء JavaScript أثناء الاختبارات", async () => { assert(errors.length === 0, errors.join(" | ")); });
await ctx.close();

await check("10) الجوال: الحقول أولاً، زر المعاينة، أزرار التنقل ظاهرة، ولا تمرير أفقي", async () => {
  const m = await browser.newContext({ locale: "ar", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await m.route(/googletagmanager\.com|connect\.facebook\.net/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
  const p = await m.newPage();
  await p.goto(`${BASE}/special-order?type=curtains#studio`);
  await p.getByLabel("عرض الشباك").fill("1.8");
  assert(await p.locator("[data-preview-mode]").count() === 0, "preview hidden until requested");
  await p.getByRole("button", { name: "عرض المعاينة" }).click();
  await p.locator("[data-preview-mode]").waitFor();
  await p.getByRole("button", { name: "تكبير المعاينة" }).click();
  await p.getByRole("dialog", { name: "المعاينة مكبّرة" }).waitFor();
  await p.getByRole("button", { name: "إغلاق التكبير" }).click();
  assert(await p.getByRole("button", { name: /^التالي/ }).isVisible(), "next visible");
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  assert(sw <= 391, `scrollWidth ${sw}`);
  await m.close();
});

await check("11) فشل المعاينة ثلاثية الأبعاد (بلا WebGL): بديل ثنائي الأبعاد ورسالة واضحة دون تعطل", async () => {
  const b2 = await chromium.launch({ args: ["--disable-webgl", "--disable-webgl2"] });
  const c2 = await b2.newContext({ locale: "ar", viewport: { width: 1366, height: 900 } });
  await c2.route(/googletagmanager\.com|connect\.facebook\.net/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
  const p = await c2.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`${BASE}/special-order?type=mattress#studio`);
  await p.getByLabel("عرض الفرشة").fill("160");
  await p.locator("[data-preview-mode='2d']").waitFor();
  await p.getByRole("button", { name: "عرض ثلاثي الأبعاد" }).click(); // محاولة 3D رغم عدم الدعم
  await p.getByText("تعذرت المعاينة ثلاثية الأبعاد").waitFor({ timeout: 10000 });
  assert(await p.locator("[data-preview-mode='2d'] svg[role=img]").isVisible(), "2d fallback shown");
  assert(await p.getByRole("heading", { name: "أدخل المقاسات" }).isVisible(), "form still works");
  assert(errs.length === 0, errs.join(" | "));
  await b2.close();
});

await browser.close();
console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
