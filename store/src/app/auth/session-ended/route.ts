import { NextResponse } from "next/server";
import { getLiveCustomer } from "@/lib/supabase/session";
import { ACCOUNT_ID_COOKIE } from "@/lib/account-storage";
import { accountIdentityCookieOptions } from "@/lib/supabase/config";
import { createSupabaseServerClient, siteUrl } from "@/lib/supabase/server";

// Where a page sends a customer whose session has ended (signed out elsewhere, revoked, or ended because refresh-token
// reuse was detected). Pages can't change cookies, so this clears the dead session's cookies on this device and asks
// the customer to sign in again. A live session is left alone, so a link to this page can't sign anyone out.
export async function GET() {
  const site = siteUrl();
  const base = site ?? "http://localhost";
  const check = await getLiveCustomer();
  if (check.status === "live") return NextResponse.redirect(new URL("/account", base));
  const supabase = await createSupabaseServerClient();
  // Local sign-out removes this device's session cookies even when Supabase has already deleted the session.
  if (supabase) await supabase.auth.signOut({ scope: "local" });
  const response = NextResponse.redirect(new URL(check.status === "unavailable" ? "/auth/login?error=unavailable" : "/auth/login?error=expired", base));
  response.cookies.set(ACCOUNT_ID_COOKIE, "", accountIdentityCookieOptions(base, true));
  return response;
}
