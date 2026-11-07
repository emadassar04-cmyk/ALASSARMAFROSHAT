import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// يحدّث جلسة Supabase في كل طلب، ويمنع الوصول إلى /admin دون تسجيل دخول.
// التحقق الكامل (موظف + خطوتين) يتم في الخادم داخل requireStaff.
export async function proxy(request: NextRequest) {
  // إذا أعاد Supabase رمز الدخول إلى صفحة أخرى (مثلاً Site URL بدلاً من /auth/callback)،
  // نحوّله إلى مسار إكمال الدخول بدلاً من تجاهله
  const code = request.nextUrl.searchParams.get("code");
  if (code && request.nextUrl.pathname !== "/auth/callback") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    url.search = "";
    url.searchParams.set("code", code);
    url.searchParams.set("next", "/admin/mfa");
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;
  const isAdminArea = path.startsWith("/admin");
  const isPublicAdminPage = path === "/admin/login";

  if (isAdminArea && !isPublicAdminPage && !data?.claims) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isAdminArea) {
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)"],
};
