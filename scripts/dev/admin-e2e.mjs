// اختبار End-to-End للوحة الإدارة على نسخة محلية معزولة (admin-harness.sh + admin-gateway.mjs + next start).
// لا يلمس Supabase الحقيقي: الجلسات موقعة بسر اختبار محلي، والبيانات من scripts/dev/admin-seed.sql.
// الاستخدام: node scripts/dev/admin-e2e.mjs [baseUrl]
import { createRequire } from "node:module";
import { sessionCookie } from "./admin-session.mjs";

const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.argv[2] ?? "http://localhost:3200";
let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) { passed++; console.log("PASS:", msg); } else { failed++; console.log("FAIL:", msg); } };

const browser = await chromium.launch();
async function as(who, { width = 1440, height = 900 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, acceptDownloads: true });
  if (who) await ctx.addCookies([{ ...sessionCookie(who), sameSite: "Lax" }]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => { errors.push(e.message); console.log("PAGEERROR:", e.message); });
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  return { ctx, page, errors };
}
// "load" ثم انتظار هدوء الشبكة لمدة محدودة (الجلب المسبق للروابط قد يُبقي الشبكة مشغولة)
const go = async (page, path) => {
  const r = await page.goto(BASE + path, { waitUntil: "load" });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => null);
  return r;
};

try {
  // 1) بلا جلسة: تحويل للدخول، وتبديل لغة صفحة الدخول
  {
    const { ctx, page } = await as(null);
    await go(page, "/admin/orders");
    ok(page.url().includes("/admin/login"), "بلا جلسة ← صفحة الدخول");
    ok((await page.locator("h1").textContent())?.includes("دخول"), "صفحة الدخول بالعربية افتراضياً");
    await page.getByRole("link", { name: "English" }).click();
    await page.waitForLoadState("networkidle");
    ok((await page.locator("h1").textContent())?.includes("Admin sign-in") && (await page.locator("main").getAttribute("dir")) === "ltr", "صفحة الدخول بالإنجليزية واتجاه LTR");
    const r = await page.goto(BASE + "/admin/locale?l=en&next=//evil.com");
    ok(new URL(page.url()).host === new URL(BASE).host, "تبديل اللغة لا يسمح بإعادة توجيه خارجية");
    ok(r.status() < 400, "مسار تبديل اللغة يعمل");
    await ctx.close();
  }

  // 2) المدير: لوحة المعلومات بالعربية
  {
    const { ctx, page, errors } = await as("owner");
    await go(page, "/admin?preset=30d");
    ok((await page.locator("html").getAttribute("dir")) === "rtl", "العربية: html dir=rtl");
    ok(await page.getByRole("heading", { name: "لوحة المعلومات", level: 1 }).isVisible(), "عنوان لوحة المعلومات");
    const cards = await page.locator("section[aria-label] a [data-kpi-value]").count();
    ok(cards >= 10, `بطاقات الإحصاء العشر (${cards})`);
    ok(await page.locator("section[aria-label] svg path").count() >= 4, "منحنيات صغيرة داخل البطاقات");
    ok(await page.getByText("توزيع الطلبات").isVisible(), "حلقة توزيع الطلبات");
    ok(await page.locator("figure svg[role=img]").count() >= 3, "الرسوم البيانية (الإيرادات/الطلبات/الربح)");
    const sidebar = await page.locator("aside").boundingBox();
    ok(sidebar && sidebar.x > 1000, "القائمة الجانبية على اليمين في العربية");
    // تغيير الفترة يغيّر البيانات
    const before = await page.locator("[data-kpi-value]").nth(2).textContent();
    await go(page, "/admin?preset=today");
    const after = await page.locator("[data-kpi-value]").nth(2).textContent();
    ok(before !== after, `تغيير الفترة يغيّر الأرقام (${before} ← ${after})`);
    // تلميح الرسم عند المرور
    await go(page, "/admin?preset=30d");
    const svg = page.locator("figure svg[role=img]").first();
    await svg.scrollIntoViewIfNeeded(); // الرسم صار تحت البانر، فقد يكون خارج الشاشة
    await page.waitForTimeout(300);
    const box = await svg.boundingBox();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    ok(await page.locator("figure [role=status]").first().isVisible(), "تلميح الرسم يظهر عند المرور");
    // الإشعارات والبحث
    await page.getByRole("button", { name: /الإشعارات/ }).click();
    ok(await page.getByText("طلبات جديدة بانتظار التأكيد").isVisible(), "مركز الإشعارات يعرض عناصر حقيقية");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "بحث شامل" }).click();
    await page.getByRole("textbox", { name: "بحث شامل" }).fill("ALS-10");
    await page.waitForSelector('[role=search] a[href^="/admin/orders/"]', { timeout: 10000 }).catch(() => null);
    ok(await page.locator('[role=search] a[href^="/admin/orders/"]').count() > 0, "البحث الشامل يجد الطلبات");
    await page.keyboard.press("Escape");

    // 3) تبديل اللغة: الإنجليزية + LTR + القائمة يساراً
    await page.getByRole("button", { name: /اللغة/ }).click();
    await page.getByRole("menuitemradio", { name: "English" }).click();
    await page.waitForFunction(() => document.documentElement.lang === "en", null, { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    ok((await page.locator("html").getAttribute("dir")) === "ltr", "الإنجليزية: html dir=ltr");
    ok(await page.getByRole("heading", { name: "Dashboard", level: 1 }).isVisible(), "العنوان بالإنجليزية");
    const sb2 = await page.locator("aside").boundingBox();
    ok(sb2 && sb2.x < 10, "القائمة الجانبية على اليسار في الإنجليزية");
    for (const path of ["/admin/orders", "/admin/customers", "/admin/products", "/admin/inventory", "/admin/reports", "/admin/profits", "/admin/expenses",
      "/admin/coupons", "/admin/staff", "/admin/activity", "/admin/categories", "/admin/campaigns", "/admin/purchases", "/admin/settings/delivery",
      "/admin/settings/branches", "/admin/settings/marketing", "/admin/settings/integrations", "/admin/products/new", "/admin/sales"]) {
      await go(page, path);
      const text = await page.locator("#admin-main").innerText();
      const arabic = (text.match(/[؀-ۿ]+/g) ?? []).join(" ");
      // بيانات المتجر نفسها عربية (أسماء المنتجات والعملاء والفروع والسياسات) — نتحقق أن واجهة الصفحة نفسها إنجليزية
      const h1 = await page.locator("#admin-main h1").first().innerText();
      ok(!/[؀-ۿ]/.test(h1), `EN ${path}: عنوان الصفحة بالإنجليزية (${h1})`);
      if (arabic.length > 400 && !["/admin/customers", "/admin/orders", "/admin/activity", "/admin/settings/marketing", "/admin/purchases"].includes(path)) console.log(`  note ${path}: arabic data chars ${arabic.length}`);
    }
    // صفحة تعديل منتج وصفحة عميل (بالإنجليزية)
    await go(page, "/admin/products");
    await go(page, (await page.locator("tbody tr a").first().getAttribute("href")));
    ok(await page.getByRole("heading", { name: "Options & quantities" }).isVisible(), "EN صفحة تعديل المنتج");
    // رجوع للعربية
    await go(page, "/admin");
    await page.getByRole("button", { name: /Language/ }).click();
    await page.getByRole("menuitemradio", { name: "العربية" }).click();
    await page.waitForFunction(() => document.documentElement.lang === "ar", null, { timeout: 10000 });
    ok(true, "الرجوع إلى العربية");
    ok(errors.length === 0, `لا أخطاء JavaScript (${errors.slice(0, 2).join(" | ")})`);
    await ctx.close();
  }

  // 4) الطلبات: ترقيم، فلترة، تصدير، فاتورة، تغيير حالة
  {
    const { ctx, page } = await as("owner");
    await go(page, "/admin/orders");
    const first = await page.locator("tbody tr").first().locator("td").first().innerText();
    await page.getByRole("link", { name: /التالي/ }).click();
    await page.waitForURL(/page=2/);
    await page.waitForFunction((f) => document.querySelector("tbody tr td")?.textContent !== f, first, { timeout: 10000 }).catch(() => null);
    ok(page.url().includes("page=2") && (await page.locator("tbody tr").first().locator("td").first().innerText()) !== first, "ترقيم صفحات حقيقي");
    await go(page, "/admin/orders?status=cancelled");
    const statuses = await page.locator("tbody tr td:nth-child(7)").allInnerTexts();
    ok(statuses.length > 0 && statuses.every((s) => s.includes("ملغى")), "تبويب الحالة يفلتر");
    await go(page, "/admin/orders?sort=total&dir=asc");
    const totals = (await page.locator("tbody tr td:nth-child(5)").allInnerTexts()).map((s) => Number(s.replace(/[^\d.]/g, "")));
    ok(totals.every((v, i) => i === 0 || totals[i - 1] <= v), "الفرز بالمبلغ تصاعدياً");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: /CSV/ }).click()]);
    const csv = await (await dl.createReadStream()).toArray().then((c) => Buffer.concat(c).toString("utf8"));
    ok(csv.startsWith("﻿") && csv.split("\r\n").length > 10 && csv.includes("ALS-"), "تصدير CSV بالطلبات (UTF-8 BOM)");
    // تغيير حالة طلب جديد إلى «بدأت التواصل»
    await go(page, "/admin/orders?status=received");
    await page.locator("tbody tr").first().getByRole("link", { name: "عرض التفاصيل" }).click();
    await page.waitForURL(/\/admin\/orders\/[0-9a-f-]{36}$/);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "بدأت التواصل عبر WhatsApp" }).click();
    await page.getByText("تم ✓").waitFor({ timeout: 15000 }).catch(() => null);
    await page.locator("ol li").filter({ hasText: "بانتظار التأكيد" }).first().waitFor({ timeout: 15000 }).catch(() => null);
    ok(await page.getByText("بانتظار التأكيد").first().isVisible(), "تغيير حالة الطلب من الصفحة");
    ok(await page.locator("ol li").filter({ hasText: "بانتظار التأكيد" }).count() > 0, "السجل الزمني يعرض التغيير");
    // طلب مكتمل بربح مسجل (أرقام قاعدة البيانات تصل كأرقام): الصفحة تعمل وحقل الربح يعرض القيمة
    await go(page, "/admin/orders?status=delivered");
    await page.locator("tbody tr").first().getByRole("link", { name: "عرض التفاصيل" }).click();
    await page.waitForURL(/\/admin\/orders\/[0-9a-f-]{36}$/);
    await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 10000 }).catch(() => null);
    ok(await page.getByRole("textbox", { name: "ربحك من هذا البند" }).first().isVisible(), "صفحة طلب مكتمل بربح مسجل تعمل");
    await page.getByRole("link", { name: "طباعة الفاتورة" }).click();
    await page.waitForLoadState("networkidle");
    await page.locator("article").waitFor();
    const inv = await page.locator("#admin-main").innerText();
    ok(inv.includes("فاتورة") && !inv.includes("ربحك") && !inv.includes("التكلفة") && !inv.includes("مستحق"), "الفاتورة بلا تكلفة أو ربح");
    await ctx.close();
  }

  // 5) العملاء
  {
    const { ctx, page } = await as("owner");
    await go(page, "/admin/customers?segment=top");
    const spent = (await page.locator("tbody tr td:nth-child(4)").allInnerTexts()).map((s) => Number(s.replace(/[^\d.]/g, "")));
    ok(spent.length > 0 && spent.every((v, i) => i === 0 || spent[i - 1] >= v), "الأكثر شراءً مرتبون تنازلياً");
    await page.locator("tbody tr").first().locator("a").first().click();
    await page.waitForURL(/\/admin\/customers\/[0-9a-f-]{36}/);
    await page.getByRole("heading", { name: "سجل الطلبات" }).waitFor({ timeout: 10000 }).catch(() => null);
    ok(await page.getByRole("heading", { name: "سجل الطلبات" }).isVisible(), "ملف العميل مع سجل الطلبات");
    await ctx.close();
  }

  // 6) الصلاحيات: المشاهد ومدير الطلبات والاستقبال
  {
    const { ctx, page } = await as("viewer");
    await go(page, "/admin");
    const nav = await page.locator("aside nav a").allInnerTexts();
    ok(nav.some((n) => n.includes("الطلبات")) && !nav.some((n) => n.includes("المنتجات") || n.includes("الأرباح") || n.includes("الموظفون")), "المشاهد يرى أقسامه فقط");
    ok(!(await page.locator("#admin-main").innerText()).includes("إجمالي المبيعات"), "المشاهد لا يرى الأرقام المالية");
    await go(page, "/admin/activity");
    ok(await page.getByText("لا تملك صلاحية").isVisible(), "صفحة سجل النشاط ترفض المشاهد (من قاعدة البيانات)");
    await go(page, "/admin/staff");
    ok(page.url().endsWith("/admin"), "صفحة الموظفين تحوّل المشاهد");
    await go(page, "/admin/orders?status=received");
    await page.locator("tbody tr").first().getByRole("link", { name: "عرض التفاصيل" }).click();
    await page.waitForURL(/\/admin\/orders\/[0-9a-f-]{36}$/);
    await page.getByRole("heading", { level: 1 }).waitFor();
    ok(await page.getByRole("button", { name: /تأكيد الطلب/ }).count() === 0, "المشاهد لا يرى أزرار تغيير الحالة");
    const r = await page.request.get(BASE + "/admin/reports/export?format=csv");
    ok(r.status() === 403, "تصدير التقارير محمي في الخادم للمشاهد");
    await ctx.close();
  }
  {
    const { ctx, page } = await as("reception");
    await go(page, "/admin");
    ok(page.url().endsWith("/admin/sales"), "موظف الاستقبال ← صفحة تسجيل البيع");
    await ctx.close();
  }

  // 7) مصفوفة الصلاحيات تُحفظ وتطبق فوراً
  {
    const { ctx, page } = await as("owner");
    await go(page, "/admin/staff");
    const row = page.locator("form").filter({ has: page.locator('input[name=role][value=viewer]') });
    await row.getByLabel("عرض سجل النشاط").check();
    await row.getByRole("button", { name: "حفظ" }).click();
    await row.getByText("✓").waitFor({ timeout: 10000 });
    const v = await as("viewer");
    await go(v.page, "/admin/activity");
    ok(!(await v.page.getByText("لا تملك صلاحية").isVisible()), "المشاهد يرى سجل النشاط بعد منحه الصلاحية");
    ok(await v.page.getByText("staff.role_permissions").first().isVisible(), "تغيير الصلاحيات مسجل في سجل النشاط");
    await row.getByLabel("عرض سجل النشاط").uncheck();
    await row.getByRole("button", { name: "حفظ" }).click();
    await v.ctx.close();
    await ctx.close();
  }

  // 8) الجوال: قائمة منسدلة، بطاقات بدل الجداول، لا تمرير أفقي
  {
    const { ctx, page } = await as("owner", { width: 390, height: 844 });
    for (const path of ["/admin", "/admin/orders", "/admin/customers", "/admin/products", "/admin/inventory", "/admin/reports", "/admin/staff", "/admin/profits"]) {
      await go(page, path);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const culprit = over > 1 ? await page.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1 || e.getBoundingClientRect().left < -1).slice(0, 3).map((e) => `${e.tagName}.${String(e.className).slice(0, 50)}`).join(" | ")) : "";
      ok(over <= 1, `جوال ${path}: لا تمرير أفقي (${over}px) ${culprit}`);
    }
    await go(page, "/admin");
    await page.getByRole("button", { name: "فتح القائمة" }).click();
    ok(await page.locator("dialog[open] nav a").first().isVisible(), "القائمة الجانبية تفتح في الجوال");
    await page.locator("dialog[open] nav a", { hasText: "الطلبات" }).click();
    await page.waitForURL(/\/admin\/orders/);
    await page.waitForFunction(() => !document.querySelector("dialog[open]"), null, { timeout: 10000 }).catch(() => null);
    ok(!(await page.locator("dialog[open]").count()), "القائمة تُغلق بعد الانتقال");
    await page.locator("ul.md\\:hidden li").first().waitFor({ timeout: 10000 }).catch(() => null);
    ok(await page.locator("ul.md\\:hidden li").first().isVisible(), "الطلبات كبطاقات في الجوال");
    await ctx.close();
  }
  // طلبات التفصيل: القائمة والتصفية والتفاصيل وتحديث الحالة والسعر والملاحظة وسجل التحديثات، والمشاهد للعرض فقط
  {
    const { ctx, page, errors } = await as("owner");
    await go(page, "/admin/custom-orders");
    ok(await page.getByRole("heading", { name: "طلبات التفصيل" }).isVisible(), "صفحة طلبات التفصيل في الإدارة");
    ok(await page.getByRole("link", { name: "SO-1001" }).isVisible() && await page.getByRole("link", { name: "SO-1002" }).isVisible(), "الطلبات المحفوظة تظهر في القائمة");
    await go(page, "/admin/custom-orders?type=mattress");
    ok(await page.getByRole("link", { name: "SO-1002" }).isVisible() && !(await page.getByRole("link", { name: "SO-1001" }).count()), "التصفية حسب نوع المنتج");
    await go(page, "/admin/custom-orders?q=سارة");
    ok(await page.getByRole("link", { name: "SO-1001" }).isVisible() && !(await page.getByRole("link", { name: "SO-1002" }).count()), "البحث باسم العميل");
    await page.getByRole("link", { name: "SO-1001" }).click();
    await page.getByRole("heading", { name: /SO-1001/ }).waitFor();
    ok(await page.getByText("الشباك 2: عرض 3 م × ارتفاع 2.7 م").first().isVisible(), "التفاصيل تعرض كل شباك بمقاسه ووحدته");
    await page.getByRole("combobox", { name: "الحالة" }).selectOption("awaiting_customer");
    await page.getByLabel("السعر النهائي (₪)").fill("480");
    await page.getByLabel("ملاحظة داخلية (لا تظهر للعميل)").fill("تم حساب القماش مع الكسرات");
    await page.getByRole("button", { name: "حفظ التحديث" }).click();
    await page.getByText("تم الحفظ ✓").waitFor({ timeout: 10000 });
    await page.getByText("تم حساب القماش مع الكسرات").waitFor({ timeout: 10000 });
    ok(await page.getByText("الحالة ← بانتظار تأكيد العميل").first().isVisible() && await page.getByText(/السعر النهائي:.*480/).first().isVisible(), "تحديث الحالة والسعر والملاحظة يظهر في سجل التحديثات");
    ok(errors.length === 0, `بلا أخطاء في صفحات طلبات التفصيل ${errors.join(" | ")}`);
    await ctx.close();
  }
  {
    const { ctx, page } = await as("viewer");
    await go(page, "/admin/custom-orders");
    await page.getByRole("link", { name: "SO-1002" }).click();
    await page.getByRole("heading", { name: /SO-1002/ }).waitFor();
    ok(await page.getByText("عرض فقط").first().isVisible() && !(await page.getByRole("button", { name: "حفظ التحديث" }).count()), "المشاهد يرى طلبات التفصيل دون تعديل");
    await ctx.close();
  }
} catch (e) {
  failed++;
  console.log("FAIL: exception", e.message);
} finally {
  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
