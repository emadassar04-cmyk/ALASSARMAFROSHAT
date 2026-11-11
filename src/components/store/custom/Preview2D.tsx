import type { PreviewModel } from "./preview-model";

// بديل ثنائي الأبعاد (SVG) للأجهزة الضعيفة أو عند تعذر تحميل المعاينة ثلاثية الأبعاد: نفس الأبعاد ونفس الألوان
const C = { w: "#8a6b2e", l: "#3f5871", h: "#a4483a" };

function Arrow({ x1, y1, x2, y2, color, text, dx = 0, dy = 0 }: { x1: number; y1: number; x2: number; y2: number; color: string; text: string; dx?: number; dy?: number }) {
  const id = `ah${color.slice(1)}`;
  return (
    <g>
      <defs><marker id={id} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill={color} /></marker></defs>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1.6" markerStart={`url(#${id})`} markerEnd={`url(#${id})`} />
      <text x={(x1 + x2) / 2 + dx} y={(y1 + y2) / 2 + dy} fill={color} fontSize="13" fontWeight="500" textAnchor="middle" direction="rtl"
        paintOrder="stroke" stroke="#f3efe6" strokeWidth="5">{text}</text>
    </g>
  );
}

export function Preview2D({ model }: { model: PreviewModel }) {
  const V = 400, H = 300, pad = 60;
  // صورة القماش الحقيقية (إن وُجدت) كتعبئة متكررة، وإلا اللون
  const fill = model.texture ? "url(#fabric2d)" : model.color;
  const defs = model.texture && (
    <defs><pattern id="fabric2d" patternUnits="userSpaceOnUse" width="48" height="48"><image href={model.texture} width="48" height="48" preserveAspectRatio="xMidYMid slice" /></pattern></defs>
  );
  if (model.kind === "curtains") {
    const s = Math.min((V - 2 * pad) / (model.width + 0.6), (H - 2 * pad) / (model.height + 0.5));
    const w = model.width * s, h = model.height * s, x = (V - w) / 2, y = (H - h) / 2 + 10;
    const op = model.blackout === "none" ? 0.55 : model.blackout === "partial" ? 0.85 : 1;
    return (
      <svg viewBox={`0 0 ${V} ${H}`} role="img" aria-label={`معاينة: شباك ${model.label.w} × ${model.label.h}`} className="h-full w-full">
        {defs}<rect width={V} height={H} fill="#f3efe6" />
        <rect x={x} y={y} width={w} height={h} fill="#dfe9ef" stroke="#fff" strokeWidth="5" />
        <line x1={x - 18} y1={y - 12} x2={x + w + 18} y2={y - 12} stroke="#5b4a36" strokeWidth="3" strokeLinecap="round" />
        {[0, 1].map((i) => <rect key={i} x={i ? x + w - w * 0.3 + 18 : x - 18} y={y - 12} width={w * 0.3} height={h + 28} fill={fill} opacity={op} rx="2" />)}
        <Arrow x1={x} y1={y - 30} x2={x + w} y2={y - 30} color={C.w} text={`عرض الشباك ${model.label.w}`} dy={-8} />
        <Arrow x1={x + w + 34} y1={y} x2={x + w + 34} y2={y + h} color={C.h} text={model.label.h ?? ""} dx={28} />
      </svg>
    );
  }
  if (model.kind === "ceiling") {
    const s = Math.min((V - 2 * pad) / model.width, (H - 2 * pad) / model.length);
    const w = model.width * s, l = model.length * s, x = (V - w) / 2, y = (H - l) / 2;
    return (
      <svg viewBox={`0 0 ${V} ${H}`} role="img" aria-label={`معاينة: سقف ${model.label.w} × ${model.label.l}`} className="h-full w-full">
        {defs}<rect width={V} height={H} fill="#f3efe6" />
        <rect x={x} y={y} width={w} height={l} fill={fill} stroke="#c9bfae" />
        {model.design === "pleated" && Array.from({ length: Math.max(2, Math.round(model.width * 3)) }, (_, i) => <line key={i} x1={x + (i + 1) * w / (Math.round(model.width * 3) + 1)} y1={y} x2={x + (i + 1) * w / (Math.round(model.width * 3) + 1)} y2={y + l} stroke="#0002" />)}
        {model.design === "panels" && Array.from({ length: Math.ceil(model.width / 0.6) * Math.ceil(model.length / 0.6) }, (_, i) => { const cols = Math.ceil(model.width / 0.6); return <rect key={i} x={x + (i % cols) * 0.6 * s} y={y + Math.floor(i / cols) * 0.6 * s} width={Math.min(0.6 * s, x + w - (x + (i % cols) * 0.6 * s))} height={Math.min(0.6 * s, y + l - (y + Math.floor(i / cols) * 0.6 * s))} fill="none" stroke="#0002" strokeDasharray="4 3" />; })}
        <Arrow x1={x} y1={y - 18} x2={x + w} y2={y - 18} color={C.w} text={`عرض السقف ${model.label.w}`} dy={-8} />
        <Arrow x1={x - 18} y1={y} x2={x - 18} y2={y + l} color={C.l} text={model.label.l ?? ""} dx={-30} />
      </svg>
    );
  }
  // فرشة / قطعة أخرى: منظر علوي + منظر جانبي للارتفاع
  const s = Math.min((V * 0.55 - pad) / model.width, (H - 2 * pad) / model.length);
  const w = model.width * s, l = model.length * s, x = pad, y = (H - l) / 2;
  const hs = Math.min(70, Math.max(10, model.height * s * 1.5));
  return (
    <svg viewBox={`0 0 ${V} ${H}`} role="img" aria-label={`معاينة: ${model.label.w} × ${model.label.l}${model.label.h ? ` × ${model.label.h}` : ""}`} className="h-full w-full">
      {defs}<rect width={V} height={H} fill="#f3efe6" />
      <rect x={x} y={y} width={w} height={l} rx="8" fill={fill} stroke="#0003" />
      <Arrow x1={x} y1={y + l + 18} x2={x + w} y2={y + l + 18} color={C.w} text={`العرض ${model.label.w}`} dy={16} />
      <Arrow x1={x + w + 18} y1={y} x2={x + w + 18} y2={y + l} color={C.l} text={model.label.l ?? ""} dx={34} />
      {model.label.h && (
        <>
          <rect x={V - 130} y={H / 2 - hs / 2} width={90} height={hs} rx="6" fill={fill} stroke="#0003" />
          <Arrow x1={V - 25} y1={H / 2 - hs / 2} x2={V - 25} y2={H / 2 + hs / 2} color={C.h} text={`الارتفاع ${model.label.h}`} dx={-55} dy={hs / 2 + 22} />
        </>
      )}
    </svg>
  );
}
