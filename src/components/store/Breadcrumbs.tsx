import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Wave } from "./Dividers";

// مسار التصفح المرئي (البيانات المنظمة BreadcrumbList تُضاف من الصفحة نفسها)
export function Breadcrumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="مسار التصفح" className="text-[0.8rem] text-muted-ink">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {it.href ? <Link href={it.href} className="transition-colors hover:text-charcoal">{it.name}</Link> : <span aria-current="page" className="text-charcoal">{it.name}</span>}
            {i < items.length - 1 && <ChevronLeft aria-hidden="true" strokeWidth={1.6} className="h-3.5 w-3.5 text-muted" />}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// رأس موحد للصفحات الداخلية
export function PageHeader({ title, intro, crumbs, children }: { title: string; intro?: React.ReactNode; crumbs?: { name: string; href?: string }[]; children?: React.ReactNode }) {
  return (
    <div>
      <div className="bg-cream">
        <div className="shell pt-8 pb-4 md:pt-11 md:pb-6">
          {crumbs && <Breadcrumbs items={crumbs} />}
          <h1 className={`text-title text-charcoal ${crumbs ? "mt-4" : ""}`}>{title}</h1>
          {intro && <div className="mt-3 max-w-2xl leading-7 text-muted-ink">{intro}</div>}
          {children}
        </div>
      </div>
      <Wave from="cream" to="white" />
    </div>
  );
}
