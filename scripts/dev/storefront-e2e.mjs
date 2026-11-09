// اختبار End-to-End لواجهة المتجر على النسخة المحلية (بيانات تجريبية في قاعدة الاختبار فقط)
// التشغيل: BASE_URL=http://localhost:3100 node scripts/dev/storefront-e2e.mjs [مجلد_لقطات_الشاشة]
import { createRequire } from "node:module";

// Playwright مثبت عالمياً في بيئة الاختبار (NODE_PATH)، أو محلياً إن وُجد
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const SHOTS = process.argv[2];
let passed = 0;
const failures = [];

async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`FAIL: ${name}\n   ${String(e.message).split("\n")[0]}`);
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const url = (path) => BASE + encodeURI(path);

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: "ar", viewport: { width: 1280, height: 900 } });
// معرّفات التحليلات في بيانات الاختبار تجريبية: نعترض مكتبات Google/Meta ونرد بملف فارغ،
// فتبقى الأحداث في قوائم الانتظار (dataLayer / fbq.queue) ونفحصها دون أي اتصال خارجي
await ctx.route(/googletagmanager\.com|connect\.facebook\.net/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
// خرائط Google تُعترض أيضاً (لا اتصال خارجي في الاختبار)
await ctx.route(/maps\.google\.com/, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<p>map</p>" }));
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(e.message));

await check("الرئيسية: العنوان والتصنيفات السبعة وأقسام المنتجات", async () => {
  await page.goto(url("/"));
  assert((await page.locator("h1").first().textContent()).includes("كل تفاصيل بيتك"), "h1");
  await page.getByRole("heading", { name: "منتجات مميزة" }).waitFor();
  assert(await page.locator('section[aria-labelledby="cats"] li').count() === 7, "7 categories");
  assert(await page.locator("article").count() >= 4, "product cards");
  assert(await page.getAttribute("html", "dir") === "rtl", "rtl");
});

await check("لا تظهر أي بيانات داخلية في HTML المتجر", async () => {
  const html = await page.content();
  assert(!/unit_cost|on_hand|reserved|manager_profit|store_due|low_stock_threshold/.test(html), "leak found");
});

await check("اقتراحات البحث أثناء الكتابة بكلمة لهجة (حرام ← بطانية)", async () => {
  const box = page.getByRole("combobox", { name: "بحث في المنتجات" });
  await box.fill("حرام");
  await page.getByRole("option").filter({ hasText: "بطانية شتوية ناعمة" }).waitFor({ timeout: 5000 });
});

await check("صفحة البحث تتحمل الخطأ الإملائي (محدة ← مخدة)", async () => {
  await page.goto(url("/search?q=محدة"));
  await page.getByRole("heading", { name: /نتائج البحث عن/ }).waitFor();
  await page.locator("article", { hasText: "مخدة فندقية" }).waitFor();
});

await check("بحث بلا نتائج يعرض رسالة واضحة", async () => {
  await page.goto(url("/search?q=ثلاجة"));
  await page.getByText("لم نجد نتائج").waitFor();
});

await check("الترتيب بالسعر تصاعدياً", async () => {
  await page.goto(url("/products?sort=price_asc"));
  await page.locator("article").first().waitFor();
  assert((await page.locator("article h3").first().textContent()).includes("مخدة فندقية"), "cheapest first");
});

await check("فلتر التصنيف عبر صفحة التصنيف", async () => {
  await page.goto(url("/category/مراتب-ومفروشات"));
  await page.locator("article", { hasText: "مرتبة طبية فاخرة" }).waitFor();
  assert(await page.locator("article").count() === 1, "only mattresses");
});

await check("فلتر اللون + المتوفر فقط", async () => {
  await page.goto(url("/products?color=أبيض&available=1"));
  await page.locator("article").first().waitFor();
  const names = await page.locator("article h3").allTextContents();
  assert(names.some((n) => n.includes("مخدة فندقية")), "white pillow");
  assert(!names.some((n) => n.includes("لحاف قطن مصري")), "out-of-stock excluded");
});

await check("صفحة المنتج: سعر الخصم والسعر قبل الخصم والبيانات المنظمة", async () => {
  await page.goto(url("/product/سجادة-تركية-كلاسيك"));
  await page.getByRole("heading", { level: 1, name: "سجادة تركية كلاسيك" }).waitFor();
  const buy = page.locator("main");
  assert((await buy.textContent()).includes("380"), "sale price");
  assert(await page.locator("s", { hasText: "450" }).count() > 0, "compare-at");
  const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').first().textContent());
  assert(ld.offers?.priceCurrency === "ILS" && Number(ld.offers.price) === 380, "json-ld offer");
});

await check("اختيار خيار بسعر مختلف وإضافته للسلة", async () => {
  await page.getByText(/كبيرة/).first().click();
  assert((await page.locator("main").textContent()).includes("520"), "variant price");
  await page.getByRole("button", { name: "زيادة الكمية" }).click();
  await page.getByRole("button", { name: "أضف إلى السلة" }).click();
  await page.getByRole("status").filter({ hasText: "تمت الإضافة" }).waitFor();
  await page.getByRole("link", { name: "السلة (2)" }).waitFor();
});

await check("السلة: السعر من الخادم والمجموع صحيح ويبقى بعد إعادة التحميل", async () => {
  await page.goto(url("/cart"));
  await page.getByText("ملخص السلة").waitFor();
  await page.reload();
  await page.getByText("ملخص السلة").waitFor();
  const summary = await page.locator("aside").textContent();
  assert(summary.includes("1,040") || summary.includes("1040"), `subtotal 1040, got: ${summary}`);
  await page.getByRole("link", { name: /أرسل السلة عبر WhatsApp/ }).waitFor();
});

await check("التلاعب بالسعر في المتصفح لا يؤثر: السلة تحفظ المعرّف والكمية فقط", async () => {
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("alassar-store-v1"));
    s.cart[0].price = 1;
    localStorage.setItem("alassar-store-v1", JSON.stringify(s));
  });
  await page.reload();
  await page.getByText("ملخص السلة").waitFor();
  const summary = await page.locator("aside").textContent();
  assert(summary.includes("1,040") || summary.includes("1040"), "server price kept");
});

await check("تعديل الكمية وحذف المنتج من السلة", async () => {
  await page.getByLabel("الكمية").fill("3");
  await page.locator("aside", { hasText: "1,560" }).waitFor();
  await page.getByRole("button", { name: "حذف" }).click();
  await page.getByText("سلتك فارغة").waitFor();
});

await check("منتج نافد: زر الإضافة معطل", async () => {
  await page.goto(url("/product/لحاف-قطن-مصري"));
  const btn = page.getByRole("button", { name: "غير متوفر حالياً" });
  await btn.waitFor();
  assert(await btn.isDisabled(), "disabled");
});

await check("منتج حسب المقاس: بلا سعر تقديري ومع طلب عرض سعر", async () => {
  await page.goto(url("/product/ستارة-مخمل-ملكية"));
  await page.getByText("السعر حسب المقاس").first().waitFor();
  assert(await page.getByRole("button", { name: "أضف إلى السلة" }).count() === 0, "no add to cart");
  const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').first().textContent());
  assert(!ld.offers, "no offer for measured product");
  await page.getByRole("link", { name: "أرسل المقاسات واطلب عرض سعر" }).click();
  await page.getByRole("heading", { name: "طلب منتج حسب المقاس" }).waitFor();
  await page.getByLabel("العرض").fill("220");
  await page.getByLabel("الارتفاع أو الطول").fill("260");
  await page.getByRole("button", { name: /أرسل الطلب عبر WhatsApp/ }).waitFor();
});

await check("المفضلة: الإضافة تظهر في صفحة المفضلة", async () => {
  await page.goto(url("/product/مخدة-فندقية"));
  await page.getByRole("button", { name: "إضافة مخدة فندقية إلى المفضلة" }).click();
  await page.goto(url("/wishlist"));
  await page.locator("article", { hasText: "مخدة فندقية" }).waitFor();
});

await check("المقارنة: 3 منتجات كحد أقصى", async () => {
  const items = [["مخدة-فندقية", "مخدة فندقية"], ["سجادة-تركية-كلاسيك", "سجادة تركية كلاسيك"],
    ["مرتبة-طبية-فاخرة", "مرتبة طبية فاخرة"], ["بطانية-شتوية-ناعمة", "بطانية شتوية ناعمة"]];
  for (const [slug, name] of items) {
    await page.goto(url(`/product/${slug}`));
    await page.getByRole("button", { name: `إضافة ${name} إلى المقارنة`, exact: true }).first().click();
  }
  await page.getByRole("status").filter({ hasText: "يمكن مقارنة 3 منتجات كحد أقصى" }).waitFor();
  await page.goto(url("/compare"));
  await page.locator("table").waitFor();
  assert(await page.locator("thead th").count() === 4, "3 products + label column");
});

// الصفحة تُبث قبل معرفة وجود المنتج، فيضيف Next.js وسم noindex بدلاً من رمز 404 (سلوك موثّق)
await check("منتج غير موجود: صفحة عربية + noindex لمحركات البحث", async () => {
  await page.goto(url("/product/غير-موجود"));
  await page.getByRole("heading", { name: "الصفحة غير موجودة" }).waitFor();
  assert(await page.locator('meta[name="robots"][content*="noindex"]').count() > 0, "noindex meta");
});

await check("التحليلات: أحداث مشاهدة المنتج والإضافة للسلة تصل إلى GA وMeta Pixel دون بيانات شخصية", async () => {
  await page.goto(url("/product/سجادة-تركية-كلاسيك"));
  await page.getByRole("button", { name: "أضف إلى السلة" }).click();
  await page.waitForFunction(() => (window.fbq?.queue ?? []).some((a) => a[1] === "AddToCart"), null, { timeout: 8000 });
  // الأحداث تنتظر جاهزية كل أداة (حتى ربع ثانية)، فننتظر وصول حدثي GA أيضاً
  await page.waitForFunction(() => {
    const ev = (window.dataLayer ?? []).map((x) => Array.from(x)).filter((x) => x[0] === "event").map((x) => x[1]);
    return ev.includes("view_item") && ev.includes("add_to_cart");
  }, null, { timeout: 8000 }).catch(() => {});
  const r = await page.evaluate(() => ({
    ga: (window.dataLayer ?? []).map((a) => Array.from(a)).filter((a) => a[0] === "event").map((a) => a[1]),
    gaConfig: (window.dataLayer ?? []).map((a) => Array.from(a)).some((a) => a[0] === "config" && a[1] === "G-TEST12345"),
    fb: (window.fbq?.queue ?? []).map((a) => Array.from(a)),
  }));
  assert(r.gaConfig, "GA config");
  assert(r.ga.includes("view_item") && r.ga.includes("add_to_cart"), `GA events: ${r.ga}`);
  const names = r.fb.map((a) => a[1]);
  assert(names.includes("1234567890123456") && names.includes("PageView") && names.includes("ViewContent") && names.includes("AddToCart"), `Pixel: ${names}`);
  assert(!/phone|customer|address/i.test(JSON.stringify(r)), "no personal data in analytics");
});

await check("SEO: عنوان الصفحة بصيغة موحدة وبيانات منظمة لمسار التصفح وللمحل", async () => {
  await page.goto(url("/product/سجادة-تركية-كلاسيك"));
  assert((await page.title()) === "سجادة تركية كلاسيك | مفروشات العصار", `title: ${await page.title()}`);
  const lds = await page.locator('script[type="application/ld+json"]').allTextContents();
  const crumbs = lds.map((t) => JSON.parse(t)).find((d) => d["@type"] === "BreadcrumbList");
  assert(crumbs && crumbs.itemListElement.length >= 3 && crumbs.itemListElement.at(-1).name === "سجادة تركية كلاسيك", "breadcrumb ld");
  assert(await page.locator('meta[property="og:url"]').count() > 0, "og:url");
  await page.goto(url("/"));
  const home = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((t) => JSON.parse(t));
  assert(home.some((d) => d["@type"] === "HomeGoodsStore" && d.department?.length >= 1), "store ld");
  assert(/^https:\/\/[^/]+\/?$/.test(await page.locator('link[rel="canonical"]').getAttribute("href")), "home canonical");
});

await check("robots.txt: يمنع الإدارة والسلة والطلبات ويشير لخريطة الموقع", async () => {
  const t = await (await fetch(BASE + "/robots.txt")).text();
  for (const p of ["/admin", "/checkout", "/order", "/cart"]) assert(t.includes(`Disallow: ${p}`), `missing ${p}`);
  assert(/Sitemap: https:\/\/.+\/sitemap\.xml/.test(t), "sitemap line");
});

await check("sitemap.xml: المنتجات والتصنيفات والسياسات المنشورة فقط، دون الإدارة", async () => {
  const x = decodeURI(await (await fetch(BASE + "/sitemap.xml")).text());
  assert(x.includes("/product/سجادة-تركية-كلاسيك") && x.includes("/category/") && x.includes("/products"), "pages");
  assert(x.includes("/policies/privacy") && !x.includes("/policies/returns"), "published policies only");
  assert(!x.includes("/admin") && !x.includes("/checkout"), "private pages");
});

await check("السياسات: المنشورة تظهر في التذييل، وغير المنشورة «قيد الإعداد» وغير مفهرسة، والتوصيل يعرض المناطق", async () => {
  await page.goto(url("/"));
  await page.locator("footer").getByRole("link", { name: "سياسة الخصوصية" }).click();
  await page.getByRole("heading", { level: 1, name: "سياسة الخصوصية" }).waitFor();
  await page.getByRole("heading", { level: 2, name: "البيانات التي نجمعها" }).waitFor();
  assert(await page.locator("article li").count() === 2, "list items");
  await page.goto(url("/policies/returns"));
  await page.getByText("نعمل على إعداد هذه الصفحة").waitFor();
  assert(await page.locator('meta[name="robots"][content*="noindex"]').count() > 0, "noindex draft");
  await page.goto(url("/policies/delivery"));
  await page.getByRole("heading", { name: "مناطق التوصيل ورسومها" }).waitFor();
  assert(await page.locator("table tbody tr").count() >= 1, "zones");
});

await check("الفروع: صفحة «فروعنا» بالفرعين والعناوين والاتصال والاتجاهات والخرائط، وقسم الفروع في الرئيسية", async () => {
  await page.goto(url("/branches"));
  await page.getByRole("heading", { level: 1, name: "فروعنا" }).waitFor();
  const cards = page.locator("main li.panel");
  await cards.nth(1).waitFor();
  assert(await cards.count() === 2, `two branches, got ${await cards.count()}`);
  const first = await cards.first().textContent();
  assert(first.includes("فرع دير البلح") && first.includes("الفرع الرئيسي") && first.includes("دوار البركة"), first);
  assert((await cards.nth(1).textContent()).includes("مقابل Ooredoo"), "nuseirat address");
  assert(await page.locator('main a[href="tel:+970594793301"]').count() >= 2, "tel links");
  await page.locator("main iframe[title^='موقع']").first().waitFor({ state: "attached" });
  const dir = await page.getByRole("link", { name: "الاتجاهات" }).first().getAttribute("href");
  assert(dir === "https://maps.app.goo.gl/FtsQN71RsBLmkqxD6", dir);
  const src = await page.locator("main iframe[title^='موقع']").first().getAttribute("src");
  assert(src.includes(encodeURIComponent("31.418326,34.349009")), src);
  const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((t) => JSON.parse(t));
  assert(ld.some((d) => d["@graph"]?.length === 2 && d["@graph"][0].address.addressLocality === "دير البلح" && d["@graph"][1].geo?.latitude === 31.450171), "branches ld");
  await page.goto(url("/"));
  await page.getByRole("heading", { name: "فروعنا" }).waitFor();
  // الخريطة ظاهرة مباشرة في الرئيسية، بتحميل كسول
  const homeMap = page.locator("iframe[title^='موقع']").first();
  assert(await homeMap.getAttribute("loading") === "lazy", "lazy map");
  assert((await homeMap.getAttribute("src")).includes(encodeURIComponent("31.418326,34.349009")), "home map pin");
});

await check("لا أخطاء JavaScript في المتصفح", async () => {
  const real = consoleErrors.filter((e) => !/favicon|404 \(Not Found\)/.test(e));
  assert(real.length === 0, real.join(" | "));
});

if (SHOTS) {
  const mobile = await browser.newContext({ locale: "ar", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const m = await mobile.newPage();
  for (const [name, path] of [["home", "/"], ["product", "/product/سجادة-تركية-كلاسيك"], ["search", "/search?q=حرام"]]) {
    await m.goto(url(path));
    await m.waitForLoadState("networkidle");
    await m.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: name !== "home" });
  }
  await m.goto(url("/"));
  await m.waitForLoadState("networkidle");
  await m.screenshot({ path: `${SHOTS}/home-full.png`, fullPage: true });
  await mobile.close();
}

await browser.close();
console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
