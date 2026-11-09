import { Suspense } from "react";
import { PageSkeleton } from "@/components/admin/PageSkeleton";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { getBranches, getStoreSettings } from "@/lib/catalog";
import { getDict, fmt } from "@/lib/admin/i18n";
import { variantText } from "@/lib/admin/orders";
import { displayPhone } from "@/lib/maps";
import { PrintButton } from "@/components/admin/PrintButton";

export const instant = false;

// فاتورة قابلة للطباعة أو الحفظ PDF (من المتصفح). لا تعرض التكلفة أو الربح أبداً.
async function InvoicePageContent({ params }: PageProps<"/admin/orders/[id]/invoice">) {
  const staff = await requireStaff();
  const t = getDict(staff.locale), f = fmt(staff.locale);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: o }, { data: items }, settings, branches] = await Promise.all([
    supabase.from("orders").select("order_number, created_at, customer_name, customer_phone, address, fulfillment, payment_method, subtotal, discount_total, delivery_fee, total, delivery_zones(name), coupons(code)").eq("id", id).single(),
    supabase.from("order_items").select("product_name_snapshot, variant_snapshot, quantity, unit_price_snapshot, discount_amount, net_line_amount").eq("order_id", id).order("created_at"),
    getStoreSettings(), getBranches(),
  ]);
  if (!o) notFound();
  const main = branches.find((b) => b.is_main) ?? branches[0];
  const zone = (o.delivery_zones as { name?: string } | null)?.name;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link href={`/admin/orders/${id}`} className="inline-flex items-center gap-1.5 text-sm text-[var(--a-muted-ink)] hover:text-[var(--a-text)]">
          <ArrowRight aria-hidden="true" className="h-4 w-4 ltr:rotate-180" />{t.invoice.back}
        </Link>
        <PrintButton label={t.invoice.printNow} />
      </div>
      <article className="a-card p-8 print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-[var(--a-accent)] pb-6">
          <div>
            <p className="text-2xl font-bold">{settings.store_name}</p>
            {main && <p className="mt-1 text-sm text-[var(--a-muted-ink)]">{[main.city, main.address].filter(Boolean).join(" – ")}</p>}
            {main?.phone && <p dir="ltr" className="text-end text-sm tabular-nums text-[var(--a-muted-ink)] rtl:text-start">{displayPhone(main.phone)}</p>}
          </div>
          <div className="text-end">
            <p className="text-3xl font-bold text-[var(--a-accent-ink)]">{t.invoice.title}</p>
            <p className="mt-1 text-sm">{t.invoice.order} <b dir="ltr">{o.order_number}</b></p>
            <p className="text-sm text-[var(--a-muted-ink)]">{t.invoice.date}: {f.date(o.created_at)}</p>
          </div>
        </header>
        <section className="grid gap-6 py-6 text-sm sm:grid-cols-2">
          <div>
            <p className="a-label">{t.invoice.billTo}</p>
            <p className="font-semibold">{o.customer_name}</p>
            <p dir="ltr" className="text-end tabular-nums rtl:text-start">{o.customer_phone}</p>
            {o.fulfillment === "delivery" && <p className="mt-1">{t.invoice.address}: {[zone, o.address].filter(Boolean).join(" – ")}</p>}
          </div>
          <div className="sm:text-end">
            <p className="a-label">{t.invoice.payment}</p>
            <p>{t.payment[o.payment_method as keyof typeof t.payment]}</p>
            <p className="text-[var(--a-muted-ink)]">{t.fulfillment[o.fulfillment as keyof typeof t.fulfillment]}</p>
          </div>
        </section>
        <table className="a-table">
          <thead><tr><th scope="col">{t.invoice.item}</th><th scope="col">{t.invoice.qty}</th><th scope="col">{t.invoice.unit}</th><th scope="col" className="text-end">{t.invoice.line}</th></tr></thead>
          <tbody>{(items ?? []).map((l, i) => (
            <tr key={i}>
              <td>{l.product_name_snapshot}{variantText(l.variant_snapshot) && <span className="block text-xs text-[var(--a-muted-ink)]">{t.invoice.variant}: {variantText(l.variant_snapshot)}</span>}</td>
              <td className="tabular-nums">{f.number(l.quantity)}</td>
              <td className="tabular-nums">{f.money(l.unit_price_snapshot)}</td>
              <td className="text-end tabular-nums">{f.money(l.net_line_amount)}</td>
            </tr>))}
          </tbody>
        </table>
        <dl className="ms-auto mt-6 grid max-w-xs grid-cols-2 gap-y-1.5 text-sm">
          <dt className="text-[var(--a-muted-ink)]">{t.invoice.subtotal}</dt><dd className="text-end tabular-nums">{f.money(o.subtotal)}</dd>
          {Number(o.discount_total) > 0 && <><dt className="text-[var(--a-muted-ink)]">{t.invoice.discount}</dt><dd className="text-end tabular-nums">− {f.money(o.discount_total)}</dd></>}
          <dt className="text-[var(--a-muted-ink)]">{t.invoice.delivery}</dt><dd className="text-end tabular-nums">{f.money(o.delivery_fee)}</dd>
          <dt className="border-t border-[var(--a-line)] pt-2 font-bold">{t.invoice.total}</dt><dd className="border-t border-[var(--a-line)] pt-2 text-end text-lg font-bold tabular-nums">{f.money(o.total)}</dd>
        </dl>
        <p className="mt-10 border-t border-[var(--a-line)] pt-4 text-center text-sm text-[var(--a-muted-ink)]">{t.invoice.thanks}</p>
      </article>
    </div>
  );
}

// الصفحة تُعرض فوراً بهيكل تحميل، ثم يتدفق المحتوى (تنقل سلس دون انتظار الخادم)
export default function InvoicePage(props: PageProps<"/admin/orders/[id]/invoice">) {
  return <Suspense fallback={<PageSkeleton variant="form" />}><InvoicePageContent {...props} /></Suspense>;
}
