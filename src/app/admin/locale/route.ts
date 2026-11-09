import { NextResponse, type NextRequest } from "next/server";
import { isLocale, LOCALE_COOKIE } from "@/lib/admin/i18n";
import { safeNextPath } from "@/lib/safe-redirect";

// تبديل لغة صفحات الدخول (قبل وجود جلسة): كوكي فقط، والرجوع لمسار داخلي آمن
export function GET(request: NextRequest) {
  const l = request.nextUrl.searchParams.get("l");
  const back = safeNextPath(request.nextUrl.searchParams.get("next"), "/admin/login");
  const res = NextResponse.redirect(new URL(back.startsWith("/admin") ? back : "/admin/login", request.url));
  if (isLocale(l)) res.cookies.set(LOCALE_COOKIE, l, { path: "/admin", sameSite: "lax", secure: true, httpOnly: true, maxAge: 60 * 60 * 24 * 365 });
  return res;
}
