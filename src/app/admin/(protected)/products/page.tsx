import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { formatPrice } from "@/lib/format";

// صفحات الإدارة تقرأ الجلسة: تُعرض على الخادم في كل طلب
export const instant = false;

const STATUS: Record<string, string> = { draft: "مسودة", active: "منشور", archived: "مؤرشف" };

type Row = {
  id: string; name: string; slug: string; status: string; price: string | null; requires_measurement: boolean;
  is_featured: boolean; low_stock_threshold: number;
  product_variants: { id: string; is_active: boolean; inventory: { on_hand: number; reserved: number }[] }[];
  product_media: { id: string }[];
};

export default async function AdminProducts({ searchParams }: PageProps<"/admin/products">) {
  await requireStaff();
  const { q, status } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("products")
    .select("id, name, slug, status, price, requires_measurement, is_featured, low_stock_threshold, product_variants(id, is_active, inventory(on_hand, reserved)), product_media(id)")
    .order("created_at", { ascending: false }).limit(200);
  if (typeof status === "string" && status) query = query.eq("status", status);
  if (typeof q === "string" && q.trim()) query = query.ilike("name", `%${q.trim().replace(/[%_]/g, "")}%`);
  const { data, error } = await query;
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">المنتجات</h1>
        <Link href="/admin/products/new" className="rounded-lg bg-charcoal px-4 py-2 font-medium text-white hover:bg-[#3d372e]">＋ منتج جديد</Link>
      </div>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={typeof q === "string" ? q : ""} placeholder="ابحث بالاسم" className="rounded-lg border border-gold/30 px-3 py-2 text-sm" />
        <select name="status" defaultValue={typeof status === "string" ? status : ""} className="rounded-lg border border-gold/30 px-3 py-2 text-sm">
          <option value="">كل الحالات</option><option value="active">منشور</option><option value="draft">مسودة</option><option value="archived">مؤرشف</option>
        </select>
        <button className="rounded-lg border border-gold/30 px-3 py-2 text-sm hover:bg-beige">بحث</button>
      </form>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">تعذر تحميل المنتجات.</p>}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gold/40 bg-white p-10 text-center">
          <p>لا توجد منتجات بعد.</p>
          <Link href="/admin/products/new" className="mt-3 inline-block text-gold-dark underline">أضف أول منتج</Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gold/20 bg-white">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-beige/60 text-start">
              <tr>
                <th className="p-3 text-start">المنتج</th><th className="p-3 text-start">الحالة</th><th className="p-3 text-start">السعر</th>
                <th className="p-3 text-start">المتاح / المحجوز</th><th className="p-3 text-start">الصور</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const inv = p.product_variants.filter((v) => v.is_active).flatMap((v) => v.inventory);
                const onHand = inv.reduce((s, i) => s + i.on_hand, 0);
                const reserved = inv.reduce((s, i) => s + i.reserved, 0);
                const low = onHand - reserved <= p.low_stock_threshold;
                return (
                  <tr key={p.id} className="border-t border-gold/10">
                    <td className="p-3"><Link href={`/admin/products/${p.id}`} className="font-medium text-gold-dark hover:underline">{p.name}</Link>
                      {p.is_featured && <span className="ms-2 text-xs">★</span>}</td>
                    <td className="p-3">{STATUS[p.status]}</td>
                    <td className="p-3">{p.requires_measurement ? "حسب المقاس" : formatPrice(p.price) || "—"}</td>
                    <td className={`p-3 ${low && !p.requires_measurement ? "font-medium text-amber-700" : ""}`}>{onHand - reserved} / {reserved}</td>
                    <td className={`p-3 ${p.product_media.length < 5 ? "text-amber-700" : ""}`}>{p.product_media.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
