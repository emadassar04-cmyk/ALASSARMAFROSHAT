import Link from "next/link";
import { ChevronLeft } from "lucide-react";

// مسار التصفح المرئي (البيانات المنظمة BreadcrumbList تُضاف من الصفحة نفسها)
export function Breadcrumbs({ items, tone = "light" }: { items: { name: string; href?: string }[]; tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <nav aria-label="مسار التصفح" className={`text-[0.8rem] ${dark ? "text-ivory/75" : "text-muted-ink"}`}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {it.href ? <Link href={it.href} className={`transition-colors ${dark ? "hover:text-ivory" : "hover:text-charcoal"}`}>{it.name}</Link> : <span aria-current="page" className={dark ? "text-ivory" : "text-charcoal"}>{it.name}</span>}
            {i < items.length - 1 && <ChevronLeft aria-hidden="true" strokeWidth={1.4} className={`h-3.5 w-3.5 ${dark ? "text-ivory/50" : "text-muted"}`} />}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// رأس تحريري موحد للصفحات الداخلية: سطح شمباني هادئ وعنوان كبير بوزن خفيف
export function PageHeader({ title, intro, crumbs, children }: { title: string; intro?: React.ReactNode; crumbs?: { name: string; href?: string }[]; children?: React.ReactNode }) {
  return (
    <div className="border-b border-border bg-champagne">
      <div className="shell pt-10 pb-12 md:pt-14 md:pb-16">
        {crumbs && <Breadcrumbs items={crumbs} />}
        <h1 className={`text-[clamp(2rem,1.5rem+2vw,3.25rem)] font-light leading-[1.2] ${crumbs ? "mt-6" : ""}`}>{title}</h1>
        {intro && <div className="mt-4 max-w-2xl text-[1.02rem] leading-8 text-muted-ink">{intro}</div>}
        {children}
      </div>
    </div>
  );
}
