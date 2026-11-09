// فواصل زخرفية بين الأقسام: SVG خفيف داخل الصفحة (لا صور ولا طلبات إضافية)

type Tone = "white" | "cream" | "charcoal";
const FILL: Record<Tone, string> = { white: "var(--warm-white)", cream: "var(--cream)", charcoal: "var(--charcoal)" };

/**
 * موجة انتقال بين قسمين بلونين مختلفين: الجزء العلوي بلون القسم السابق، والسفلي بلون القسم التالي،
 * مع خيط ذهبي رفيع ينساب بمحاذاة الحافة ويُرسم تدريجياً عند التمرير.
 */
export function Wave({ from, to, flip = false, thread = true, className = "" }: {
  from: Tone; to: Tone; flip?: boolean; thread?: boolean; className?: string;
}) {
  return (
    <div aria-hidden="true" className={`relative -my-px h-12 overflow-hidden sm:h-16 lg:h-20 ${className}`} style={{ background: FILL[to] }}>
      <svg viewBox="0 0 1440 80" preserveAspectRatio="none" className={`thread-svg absolute inset-0 h-full w-full ${flip ? "-scale-x-100" : ""}`}>
        <path d="M0 0H1440V34C1300 62 1180 70 1030 52C880 34 760 8 600 18C440 28 330 66 190 62C110 60 50 48 0 36Z" fill={FILL[from]} />
        {thread && (
          <path className="thread-draw" pathLength={1} d="M0 40C50 52 110 64 190 66C330 70 440 32 600 22C760 12 880 38 1030 56C1180 74 1300 66 1440 38"
            fill="none" stroke="var(--gold)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" opacity=".55" />
        )}
      </svg>
    </div>
  );
}

/**
 * زخرفة حلزونية بين قسمين بنفس اللون: خطان ينحنيان نحو الوسط ويلتفّان في حلزون صغير.
 */
export function Flourish({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`shell flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 480 40" className="thread-svg h-7 w-full max-w-[30rem] sm:h-9" fill="none" stroke="var(--gold)" strokeWidth="1.2" strokeLinecap="round">
        <path className="thread-draw" pathLength={1} d="M0 20C60 20 120 12 170 14C196 15 210 22 214 26" opacity=".6" />
        <path className="thread-draw" pathLength={1} d="M480 20C420 20 360 28 310 26C284 25 270 18 266 14" opacity=".6" />
        {/* الحلزون في الوسط */}
        <path className="thread-draw" pathLength={1} d="M214 26C222 33 236 34 244 28C252 22 250 10 240 8C230 6 222 14 226 22C229 28 238 28 241 22C243 18 240 14 236 15" />
        <path className="thread-draw" pathLength={1} d="M266 14C258 7 244 6 236 12" opacity=".6" />
        <circle cx="240" cy="20" r="1.6" fill="var(--gold)" stroke="none" />
      </svg>
    </div>
  );
}
