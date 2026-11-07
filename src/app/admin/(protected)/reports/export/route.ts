import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EXPENSE_LABEL, parseRange, sourceLabel, type Report } from "@/lib/admin/finance";

// تصدير التقرير: Excel (عدة أوراق) أو CSV (UTF-8 مع BOM ليفتح بالعربية في Excel)
export async function GET(request: NextRequest) {
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
    ["من", r.from], ["إلى", r.to], ["المبيعات المؤكدة", k.revenue], ["عدد الطلبات المؤكدة", k.orders],
    ["صافي المنتجات", k.products_net], ["خصومات الكوبونات", k.discounts], ["رسوم التوصيل", k.delivery_fees],
    ["تكلفة البضاعة", k.cogs], ["ربح المدير من المنتجات", k.manager_profit], ["مستحقات المحل", k.store_due],
    ["بنود بلا ربح مسجل", k.items_missing_profit], ["المصروفات", k.expenses], ["صافي ربح المدير", k.manager_net],
    ["طلبات أُنشئت", k.created_orders], ["ملغاة", k.created_cancelled], ["مُسلَّمة", k.created_delivered],
  ];

  if (sp.format === "csv") {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      ...summary.map(([a, b]) => `${esc(a)},${esc(b)}`), "",
      ["المنتج", "الكمية", "المبيعات", "التكلفة", "ربح المدير", "مستحق المحل"].map(esc).join(","),
      ...r.products.map((p) => [p.name, p.qty, p.revenue, p.cogs ?? "", p.profit ?? "", p.store_due ?? ""].map(esc).join(",")), "",
      ["اليوم", "الطلبات", "المبيعات", "ربح المدير"].map(esc).join(","),
      ...r.daily.map((d) => [d.day, d.orders, d.revenue, d.profit].map(esc).join(",")),
    ];
    return new NextResponse("﻿" + lines.join("\r\n"), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}.csv"`, "cache-control": "private, no-store" },
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "مفروشات العصار";
  const sheet = (title: string, header: string[], rows: (string | number | null)[][], moneyCols: number[] = []) => {
    const ws = wb.addWorksheet(title, { views: [{ rightToLeft: true }] });
    ws.addRow(header).font = { bold: true };
    rows.forEach((row) => ws.addRow(row));
    ws.columns.forEach((c, i) => {
      c.width = i === 0 ? 30 : 16;
      if (moneyCols.includes(i)) c.numFmt = '#,##0.00 "₪"';
    });
  };
  sheet("الملخص", ["البند", "القيمة"], summary.map(([a, b]) => [a, typeof b === "string" ? b : Number(b)]));
  sheet("المنتجات", ["المنتج", "الكمية", "المبيعات", "التكلفة", "ربح المدير", "مستحق المحل"],
    r.products.map((p) => [p.name, Number(p.qty), Number(p.revenue), p.cogs === null ? null : Number(p.cogs),
      p.profit === null ? null : Number(p.profit), p.store_due === null ? null : Number(p.store_due)]), [2, 3, 4, 5]);
  sheet("الأيام", ["اليوم", "الطلبات", "المبيعات", "ربح المدير"],
    r.daily.map((d) => [d.day, Number(d.orders), Number(d.revenue), Number(d.profit)]), [2, 3]);
  sheet("التصنيفات", ["التصنيف", "الكمية", "المبيعات"], r.categories.map((c) => [c.name, Number(c.qty), Number(c.revenue)]), [2]);
  sheet("المصروفات", ["النوع", "العدد", "المبلغ"], r.expenses.map((e) => [EXPENSE_LABEL[e.category] ?? e.category, Number(e.n), Number(e.amount)]), [2]);
  sheet("المصادر", ["المصدر", "الطلبات", "المبيعات"], r.sources.map((s) => [sourceLabel(s.source), Number(s.orders), Number(s.revenue)]), [2]);
  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${name}.xlsx"`, "cache-control": "private, no-store",
    },
  });
}
