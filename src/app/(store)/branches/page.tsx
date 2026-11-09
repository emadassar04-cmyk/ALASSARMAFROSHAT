import type { Metadata } from "next";
import { Suspense } from "react";
import { getBranches, getStoreSettings } from "@/lib/catalog";
import { PageHeader } from "@/components/store/Breadcrumbs";
import { BranchCards, branchLd } from "@/components/store/Branches";
import { JsonLd } from "@/components/store/JsonLd";

export const metadata: Metadata = {
  title: "فروعنا",
  description: "فروع مفروشات العصار: فرع دير البلح (الرئيسي) عند دوار البركة، وفرع النصيرات مقابل Ooredoo. العناوين والخرائط وأرقام التواصل.",
  alternates: { canonical: "/branches" },
};

async function BranchesContent() {
  const [branches, s] = await Promise.all([getBranches(), getStoreSettings()]);
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@graph": branches.map((b) => ({ ...branchLd(b), url: `${s.site_url}/branches` })) }} />
      <BranchCards branches={branches} />
    </>
  );
}

export default function BranchesPage() {
  return (
    <>
      <PageHeader title="فروعنا" crumbs={[{ name: "الرئيسية", href: "/" }, { name: "فروعنا" }]}
        intro="زورونا في أقرب فرع إليكم. المخزون مشترك بين الفرعين، ونوصل الطلبات لكل مناطق قطاع غزة." />
      <div className="shell py-8 md:py-10">
        <Suspense fallback={<div className="grid gap-6 md:grid-cols-2"><div className="skeleton h-96 rounded-[var(--radius-card)]" /><div className="skeleton h-96 rounded-[var(--radius-card)]" /></div>}>
          <BranchesContent />
        </Suspense>
      </div>
    </>
  );
}
