import { NextResponse, type NextRequest } from "next/server";
import { isAccountId } from "@/lib/account-storage";
import { safeNext } from "@/lib/auth/redirects";
import { setAccountIdentityCookie } from "@/lib/supabase/account-identity";
import { createSupabaseServerClient, siteUrl } from "@/lib/supabase/server";

// Where Google sign-in returns. Supabase sends ?code= on success, or ?error= if the customer cancelled or Google
// refused. The code works only with the PKCE verifier cookie set by /auth/google in this same browser.
// The first Google sign-in creates the auth user and, through the database trigger, a customer profile. A Google
// account with the same verified email as an existing NÉVORA account joins that account (Supabase's automatic
// identity linking), so there's still one auth user and one profile.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const site = siteUrl() ?? request.nextUrl.origin;
  const transitionId = params.get("identity_transition");
  const toLogin = (error: string) => {
    return NextResponse.redirect(new URL(`/auth/login?error=${error}`, site));
  };

  const providerError = params.get("error");
  if (providerError) return toLogin(providerError === "access_denied" ? "oauth-cancelled" : "oauth");

  const code = params.get("code");
  const supabase = await createSupabaseServerClient();
  if (!supabase) return toLogin("unavailable");
  if (!code) return toLogin("oauth");

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user?.id) return toLogin("oauth");
  await setAccountIdentityCookie(data.user.id);
  const destination = new URL(safeNext(params.get("next")), site);
  if (isAccountId(transitionId)) destination.searchParams.set("identity_transition", transitionId);
  return NextResponse.redirect(destination);
}
