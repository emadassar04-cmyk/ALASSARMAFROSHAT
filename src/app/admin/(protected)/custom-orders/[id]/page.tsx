import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { PageSkeleton } from "@/components/admin/PageSkeleton";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, can } from "@/lib/staff";
import { getDict, fmt } from "@/lib/admin/i18n";
import { formatPhone } from "@/lib/phone";
import { whatsappLink } from "@/lib/format";
import { specLines } from "@/lib/custom-order/spec";
import { Card, PageHeader, StatusBadge } from "@/components/admin/ui";
import { CO_TONE, type CustomOrderRow } from "../shared";
import { Manage } from "./Manage";

export const instant = false;

type Detail = CustomOrderRow & { customer_notes: string | null; preview_image: string | null; reference_image: string | null;
  events: { kind: string; status: string | null; price: number | null; note: string | null; created_at: string; actor: string | null }[] };

async function Content({ params }: PageProps<"/admin/custom-orders/[id]">) {
  const staff = await requireStaff();
  if (!can(staff, "orders.read")) redirect("/admin");
  const t = getDict(staff.locale), f = fmt(staff.locale), C = t.co;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_custom_order", { p_id: id });
  if (error || !data) notFound();
  const o = data as Detail;
  const wa = whatsappLink(o.phone.replace(/^0/, "970"), `مرحباً ${o.customer_name}، بخصوص طلب التفصيل رقم ${o.number} من مفروشات العصار:`);
  const st = (s: string | null) => (s ? C.st[s as keyof typeof C.st] ?? s : "");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/admin/custom-orders" className="inline-flex items-center gap-1.5 text-sm text-[var(--a-muted-ink)] hover:text-[var(--a-text)]"><ArrowRight aria-hidden="true" className="h-4 w-4 ltr:rotate-180" />{C.back}</Link>
      <PageHeader title={`${C.types[o.product_type]} · ${o.number}`} subtitle={f.dateTime(o.created_at)}
        actions={<StatusBadge status={CO_TONE[o.status] ?? "received"} label={st(o.status)} />} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card title={C.specs}>
            <ul className="space-y-2 text-sm leading-7">{specLines(o.product_type, o.specs).map((l) => <li key={l}>{l}</li>)}</ul>
            <p className="mt-4 text-xs text-[var(--a-muted-ink)]">{C.unit}: {o.product_type === "mattress" ? "سم" : o.product_type === "other" ? (o.specs.unit === "m" ? "متر" : "سم") : "متر"}</p>
          </Card>
          {(o.preview_image || o.reference_image) && (
            <div className="grid gap-6 sm:grid-cols-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- صور مخزنة كـ data URL (JPEG) في الطلب نفسه */}
              {o.preview_image && <Card title={C.preview}><img src={o.preview_image} alt={C.preview} className="w-full rounded-lg border border-[var(--a-line)]" /></Card>}
              {/* eslint-disable-next-line @next/next/no-img-element -- صورة مرجعية من العميل (data URL) */}
              {o.reference_image && <Card title={C.reference}><img src={o.reference_image} alt={C.reference} className="w-full rounded-lg border border-[var(--a-line)]" /></Card>}
            </div>
          )}
          <Card title={C.history}>
            <ol className="space-y-3 text-sm">
              {o.events.map((e, i) => (
                <li key={i} className="flex gap-3">
                  <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--a-accent)]" />
                  <div>
                    <p>{e.kind === "created" ? C.created : e.kind === "status" ? `${C.statusTo} ${st(e.status)}` : e.kind === "price" ? (e.price !== null ? `${C.priceSet} ${f.money(e.price)}` : C.priceCleared) : e.note}</p>
                    <p className="text-xs text-[var(--a-muted-ink)]">{f.dateTime(e.created_at)} · {C.by} {e.actor ?? C.system}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={C.customer}>
            <dl className="space-y-2 text-sm">
              <div><dt className="a-label">{C.customer}</dt><dd className="font-medium">{o.customer_name}</dd></div>
              <div><dt className="a-label">{C.phone}</dt><dd dir="ltr" className="tabular-nums rtl:text-end">{formatPhone(o.phone)}</dd></div>
              <div><dt className="a-label">{C.area}</dt><dd>{o.area}</dd></div>
              {o.customer_notes && <div><dt className="a-label">{C.customerNotes}</dt><dd className="whitespace-pre-line">{o.customer_notes}</dd></div>}
            </dl>
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="a-btn a-btn-ghost mt-4 w-full">{C.whatsapp}</a>}
          </Card>
          <Card title={C.manage}>
            {can(staff, "orders.manage") ? <Manage id={o.id} status={o.status} price={o.final_price} /> : <p className="text-sm text-[var(--a-muted-ink)]">{C.readOnly}</p>}
            <p className="mt-4 text-sm">{C.price}: <span className="font-medium tabular-nums">{o.final_price !== null ? f.money(o.final_price) : C.noPrice}</span></p>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function CustomOrderPage(props: PageProps<"/admin/custom-orders/[id]">) {
  return <Suspense fallback={<PageSkeleton variant="form" />}><Content {...props} /></Suspense>;
}
