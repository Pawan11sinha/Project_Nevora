import { NextResponse, type NextRequest } from "next/server";
import { ACCOUNT_ID_COOKIE } from "@/lib/account-storage";
import { accountIdentityCookieOptions } from "@/lib/supabase/config";
import { refreshSession } from "@/lib/supabase/proxy";

// Runs only on /account (CLAUDE.md: never on public pages, so the catalogue stays cheap). It refreshes the session and
// sends signed-out visitors to sign in. It's not the security check: the account page and its actions verify the
// session themselves with getUser(). /admin will get its own, stricter checks with the admin login.
export async function proxy(request: NextRequest) {
  const { response, signedIn, accountId, configured, siteUrl } = await refreshSession(request);
  if (signedIn) {
    if (accountId && siteUrl) response.cookies.set(ACCOUNT_ID_COOKIE, accountId, accountIdentityCookieOptions(siteUrl));
    else if (siteUrl) response.cookies.set(ACCOUNT_ID_COOKIE, "", accountIdentityCookieOptions(siteUrl, true));
    return response;
  }

  const login = request.nextUrl.clone();
  login.pathname = "/auth/login";
  login.search = "";
  if (!configured) login.searchParams.set("error", "unavailable");
  else {
    login.searchParams.set("next", request.nextUrl.pathname);
    // A visitor who had a session that couldn't be refreshed is told it ended.
    if (request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"))) login.searchParams.set("error", "expired");
  }
  const redirect = NextResponse.redirect(login);
  // Carry over any cookie changes (such as clearing a dead session) and the no-store headers.
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  redirect.cookies.set(ACCOUNT_ID_COOKIE, "", accountIdentityCookieOptions(siteUrl ?? request.nextUrl.origin, true));
  redirect.headers.set("Cache-Control", "no-store");
  return redirect;
}

export const config = { matcher: ["/account", "/account/:path*"] };
