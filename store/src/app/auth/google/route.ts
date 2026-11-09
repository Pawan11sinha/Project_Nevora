import { NextResponse, type NextRequest } from "next/server";
import { isAccountId } from "@/lib/account-storage";
import { safeNext } from "@/lib/auth/redirects";
import { createSupabaseServerClient, siteUrl } from "@/lib/supabase/server";

// "Continue with Google": starts Google sign-in on the server and sends the browser to Google. It's a plain link rather
// than a form, so the site's form-action CSP never has to allow Google. Supabase uses PKCE: the code verifier goes into
// an HttpOnly cookie here, and only this browser can complete the sign-in at /auth/callback. Google's client ID and
// secret live in Supabase's settings, never in this app.
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const site = siteUrl();
  const transitionId = request.nextUrl.searchParams.get("identity_transition");
  const toLogin = (error: string) => {
    return NextResponse.redirect(new URL(`/auth/login?error=${error}`, site ?? request.url));
  };
  if (!supabase || !site) return toLogin("unavailable");

  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const callback = new URL("/auth/callback", site);
  callback.searchParams.set("next", next);
  if (isAccountId(transitionId)) callback.searchParams.set("identity_transition", transitionId);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback.toString(), skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) return toLogin("oauth");
  return NextResponse.redirect(data.url);
}
