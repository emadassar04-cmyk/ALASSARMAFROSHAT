"use client";
import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

// قسم في التذييل: على الهاتف يُطوى ويُفتح بلمسة (تذييل أقصر بكثير)، وعلى الشاشات الكبيرة يبقى ظاهراً دائماً
export function FooterSection({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={`border-b border-white/10 lg:border-0 ${className}`}>
      <h2 className="text-[0.75rem] font-medium tracking-[0.12em] text-gold-light">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={id}
          className="flex w-full items-center justify-between py-4 text-start lg:pointer-events-none lg:mb-5 lg:py-0">
          {title}
          <ChevronDown aria-hidden="true" strokeWidth={1.5} className={`h-4 w-4 transition-transform duration-300 lg:hidden ${open ? "rotate-180" : ""}`} />
        </button>
      </h2>
      <div id={id} className={`${open ? "block" : "hidden"} pb-6 lg:block lg:pb-0`}>{children}</div>
    </div>
  );
}
