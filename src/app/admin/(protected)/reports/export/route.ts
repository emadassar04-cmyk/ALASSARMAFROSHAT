import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseRange, sourceLabel, type Report } from "@/lib/admin/finance";
import { requireStaff } from "@/lib/staff";
import { getDict } from "@/lib/admin/i18n";

// تصدير التقرير: Excel (عدة أوراق) أو CSV (UTF-8 مع BOM ليفتح بالعربية في Excel)
export async function GET(request: NextRequest) {
  const staff = await requireStaff();
  const t = getDict(staff.locale), R = t.rep;
  const supabase = await createClient();
  const sp = Object.fromEntries(request.nextUrl.searchParams);
  const range = parseRange(sp);
  // التحقق من الصلاحية يتم داخل الدالة (finance.read + جلسة بخطوتين)
  const { data, error } = await supabase.rpc("finance_report", { p_from: range.from, p_to: range.to });
  if (error || !data) return NextResponse.json({ error: "forbidden_or_invalid" }, { status: 403 });
  const r = data as Report;
  const k = r.kpis;
  const name = `alassar-report-${range.from}_${range.to}`;

  const summary: [string, string | number][] = [
    [R.from, r.from], [R.to, r.to], [R.revenue, k.revenue], [R.ordersN, k.orders],
    [R.productsNet, k.products_net], [R.discounts, k.discounts], [R.deliveryFees, k.delivery_fees],
    [R.cogs, k.cogs], [R.managerProfit, k.manager_profit], [R.storeDue, k.store_due],
    [R.missingProfit, k.items_missing_profit], [R.expenses, k.expenses], [R.managerNet, k.manager_net],
    [R.created, k.created_orders], [R.cancelled, k.created_cancelled], [R.delivered, k.created_delivered],
  ];

  if (sp.format === "csv") {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      ...summary.map(([a, b]) => `${esc(a)},${esc(b)}`), "",
      [R.product, R.qty, R.sales, R.cost, R.profit, R.due].map(esc).join(","),
      ...r.products.map((p) => [p.name, p.qty, p.revenue, p.cogs ?? "", p.profit ?? "", p.store_due ?? ""].map(esc).join(",")), "",
      [R.day, t.dashboard.ordersChart, R.sales, R.profit].map(esc).join(","),
      ...r.daily.map((d) => [d.day, d.orders, d.revenue, d.profit].map(esc).join(",")),
    ];
    return new NextResponse("﻿" + lines.join("\r\n"), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}.csv"`, "cache-control": "private, no-store" },
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = t.meta.brand;
  const sheet = (title: string, header: string[], rows: (string | number | null)[][], moneyCols: number[] = []) => {
    const ws = wb.addWorksheet(title, { views: [{ rightToLeft: t.meta.dir === "rtl" }] });
    ws.addRow(header).font = { bold: true };
    rows.forEach((row) => ws.addRow(row));
    ws.columns.forEach((c, i) => {
      c.width = i === 0 ? 30 : 16;
      if (moneyCols.includes(i)) c.numFmt = '#,##0.00 "₪"';
    });
  };
  sheet(R.sheets.summary, [R.item, R.value], summary.map(([a, b]) => [a, typeof b === "string" ? b : Number(b)]));
  sheet(R.sheets.products, [R.product, R.qty, R.sales, R.cost, R.profit, R.due],
    r.products.map((p) => [p.name, Number(p.qty), Number(p.revenue), p.cogs === null ? null : Number(p.cogs),
      p.profit === null ? null : Number(p.profit), p.store_due === null ? null : Number(p.store_due)]), [2, 3, 4, 5]);
  sheet(R.sheets.days, [R.day, t.dashboard.ordersChart, R.sales, R.profit],
    r.daily.map((d) => [d.day, Number(d.orders), Number(d.revenue), Number(d.profit)]), [2, 3]);
  sheet(R.sheets.categories, [R.category, R.qty, R.sales], r.categories.map((c) => [c.name, Number(c.qty), Number(c.revenue)]), [2]);
  sheet(R.sheets.expenses, [R.type, R.count, R.amount], r.expenses.map((e) => [t.exp.cat[e.category] ?? e.category, Number(e.n), Number(e.amount)]), [2]);
  sheet(R.sheets.sources, [R.source, t.dashboard.ordersChart, R.sales], r.sources.map((s) => [sourceLabel(s.source), Number(s.orders), Number(s.revenue)]), [2]);
  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${name}.xlsx"`, "cache-control": "private, no-store",
    },
  });
}
