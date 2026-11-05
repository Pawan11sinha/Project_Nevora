import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Test 8: session checks run only on protected paths, never on public pages.
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
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  return data.user ? response : redirectToLogin();
}
