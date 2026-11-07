import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { ProductForm } from "../ProductForm";
import { createProduct } from "../actions";

export const instant = false;

export default async function NewProduct() {
  await requireStaff();
  const supabase = await createClient();
  const [{ data: categories }, { data: units }] = await Promise.all([
    supabase.from("categories").select("id, name").order("sort_order"),
    supabase.from("units").select("id, name_ar").eq("is_active", true).order("id"),
  ]);
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/admin/products" className="text-sm text-gold-dark hover:underline">→ المنتجات</Link>
      <h1 className="text-2xl font-bold">منتج جديد</h1>
      <p className="text-sm opacity-70">بعد الإضافة ستنتقل إلى صفحة المنتج لرفع الصور وإضافة الخيارات (ألوان ومقاسات).</p>
      <ProductForm action={createProduct} isNew categories={categories ?? []}
        units={(units ?? []).map((u) => ({ id: u.id, name: u.name_ar }))} />
    </div>
  );
}
