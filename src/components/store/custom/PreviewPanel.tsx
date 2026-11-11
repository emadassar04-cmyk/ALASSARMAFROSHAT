"use client";
import dynamic from "next/dynamic";
import { Component, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Box, Expand, Minus, Plus, RotateCcw, Square, X } from "lucide-react";
import type { PreviewHandle } from "./Preview3D";
import type { PreviewModel } from "./preview-model";
import { Preview2D } from "./Preview2D";

// تحميل مكتبة Three.js فقط عند ظهور المعاينة لأول مرة (لا تُحمّل مع الصفحة)
const Preview3D = dynamic(() => import("./Preview3D"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-muted-ink"><span className="skeleton h-full w-full" /></div>,
});

// يلتقط أي خطأ في تحميل المكتبة نفسها (مثل انقطاع الشبكة) ويحوّل للبديل ثنائي الأبعاد
class Guard extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

// الأجهزة الضعيفة أو التي لا تدعم WebGL: نبدأ بالمعاينة ثنائية الأبعاد
function canUse3D() {
  if (typeof window === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    const ok = !!(c.getContext("webgl2") || c.getContext("webgl"));
    const weak = (navigator as Navigator & { deviceMemory?: number }).deviceMemory !== undefined && (navigator as Navigator & { deviceMemory?: number }).deviceMemory! < 2;
    return ok && !weak;
  } catch { return false; }
}

const ctl = "grid h-10 w-10 place-items-center rounded-full bg-white/95 text-charcoal shadow-soft backdrop-blur transition-colors hover:bg-white";

export function PreviewPanel({ model, handleRef, className = "" }: {
  model: PreviewModel; handleRef: React.RefObject<PreviewHandle | null>; className?: string;
}) {
  const [mode, setMode] = useState<"3d" | "2d" | null>(null);
  const [failed, setFailed] = useState(false);
  const [full, setFull] = useState(false);
  const effective = mode ?? (canUse3D() ? "3d" : "2d");
  const use3D = effective === "3d" && !failed;
  const fail = () => { setFailed(true); handleRef.current = null; };

  const body = (
    <div className={`relative overflow-hidden rounded-[var(--radius-card)] border border-border bg-[#f3efe6] ${full ? "h-full" : "aspect-[4/3]"}`} data-preview-mode={use3D ? "3d" : "2d"}>
      {use3D
        ? <Guard onError={fail}><Preview3D model={model} onError={fail} handleRef={handleRef} /></Guard>
        : <Preview2D model={model} />}
      <div className="absolute start-3 top-3 flex items-center gap-2">
        <span className="rounded-full bg-charcoal px-3 py-1 text-xs font-medium text-ivory">{use3D ? "3D" : "2D"}</span>
        {failed && <span role="status" className="rounded-full bg-white/95 px-3 py-1 text-xs text-warning">تعذرت المعاينة ثلاثية الأبعاد، نعرض المخطط</span>}
      </div>
      <div className="absolute bottom-3 start-3 flex flex-col gap-2">
        {use3D && <>
          <button type="button" onClick={() => handleRef.current?.zoom(0.8)} aria-label="تكبير" className={ctl}><Plus aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" /></button>
          <button type="button" onClick={() => handleRef.current?.zoom(1.25)} aria-label="تصغير" className={ctl}><Minus aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" /></button>
          <button type="button" onClick={() => handleRef.current?.reset()} aria-label="إعادة الزاوية" className={ctl}><RotateCcw aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" /></button>
        </>}
      </div>
      <div className="absolute bottom-3 end-3 flex gap-2">
        {!failed && (
          <button type="button" onClick={() => setMode(use3D ? "2d" : "3d")} className="flex h-10 items-center gap-1.5 rounded-full bg-white/95 px-3.5 text-xs font-medium text-charcoal shadow-soft backdrop-blur transition-colors hover:bg-white" aria-label={use3D ? "عرض المخطط ثنائي الأبعاد" : "عرض ثلاثي الأبعاد"}>
            {use3D ? <Square aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" /> : <Box aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />}{use3D ? "2D" : "3D"}
          </button>
        )}
        <button type="button" onClick={() => setFull((f) => !f)} aria-label={full ? "إغلاق التكبير" : "تكبير المعاينة"} className={ctl}>
          {full ? <X aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" /> : <Expand aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />}
        </button>
      </div>
      {use3D && <p className="pointer-events-none absolute inset-x-0 top-3 text-center text-[0.7rem] text-muted-ink max-sm:hidden">اسحب للتدوير · مرّر للتكبير</p>}
    </div>
  );

  // التكبير يُعرض في أعلى الصفحة (portal) حتى لا تحجبه أي طبقة أخرى
  return full
    ? createPortal(<div className="fixed inset-0 z-[90] bg-charcoal/70 p-3 backdrop-blur-sm sm:p-8" role="dialog" aria-modal="true" aria-label="المعاينة مكبّرة">{body}</div>, document.body)
    : <div className={className}>{body}</div>;
}
