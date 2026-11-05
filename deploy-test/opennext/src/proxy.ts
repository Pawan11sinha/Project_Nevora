import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authCookieOptions } from "@/lib/auth-cookies";

// Refreshes sessions and redirects on protected paths only, never on public pages.
//
// Kept as proxy.ts rather than middleware.ts because Next.js 16 deprecates middleware.ts.
// OpenNext warns that Node.js proxy support is experimental, so this must never be the
// only protection: pages and actions check the session and role themselves.
export const config = { matcher: ["/admin/:path*", "/account/:path*"] };

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const loginPath = pathname.startsWith("/admin") ? "/admin/login" : "/login";
  if (pathname === loginPath) return NextResponse.next();

  const redirectToLogin = () => NextResponse.redirect(new URL(loginPath, request.url));
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return redirectToLogin();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items, headers) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        // Supabase sends cache headers so a refreshed token can never be cached.
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  return data.user ? response : redirectToLogin();
}
