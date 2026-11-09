import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAccountId } from "../account-storage";
import { authCookieOptions, readSupabaseConfig } from "./config";

// Used only by src/proxy.ts, on /account. It refreshes an expired session (Supabase rotates the refresh token, so the
// new cookies must be written here, before the page renders) and reports whether anyone is signed in. It doesn't
// authorise anything: pages and actions check the session again with getUser() (CLAUDE.md).
export async function refreshSession(request: NextRequest) {
  const config = readSupabaseConfig();
  if (!config) return { response: NextResponse.next({ request }), signedIn: false, accountId: null, configured: false, siteUrl: null };

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookieOptions: authCookieOptions(config.siteUrl),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
        // Responses that set session cookies must never be cached (Supabase passes no-store headers here).
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });
  // getClaims verifies the access token and refreshes it first if it has expired.
  const { data, error } = await supabase.auth.getClaims();
  const accountId = !error && isAccountId(data?.claims?.sub) ? data.claims.sub : null;
  return { response, signedIn: !error && !!data?.claims?.sub, accountId, configured: true, siteUrl: config.siteUrl };
}
