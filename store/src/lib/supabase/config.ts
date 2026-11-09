import { ACCOUNT_ID_COOKIE } from "../account-storage.ts";

// Supabase settings for the server. They're plain server environment variables, never NEXT_PUBLIC_, so nothing reaches
// browser code (CLAUDE.md). Locally they come from the shell or .dev.vars (git-ignored); deployed, from `wrangler secret`
// or vars. The publishable key is designed to be public, but it's still kept server-side because all auth runs there.
//   SUPABASE_URL              the project's API URL
//   SUPABASE_PUBLISHABLE_KEY  the publishable (sb_publishable_…) key. The secret key is never used here.
//   SITE_URL                  the store's own address, used for email and Google redirect links (never the Host header)

export type SupabaseConfig = { url: string; publishableKey: string; siteUrl: string };

export function readSupabaseConfig(env: Record<string, string | undefined> = process.env): SupabaseConfig | null {
  const url = env.SUPABASE_URL?.trim();
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const siteUrl = env.SITE_URL?.trim().replace(/\/+$/, "");
  if (!url || !publishableKey || !siteUrl) return null;
  if (!/^https?:\/\//.test(url) || !/^https?:\/\//.test(siteUrl)) return null;
  return { url, publishableKey, siteUrl };
}

/**
 * Session cookie settings. HttpOnly, so page scripts can never read the session; Secure whenever the site is served
 * over HTTPS; SameSite=Lax, so the session survives arriving from an email or Google's redirect. The lifetime is left
 * at Supabase's long default: the session is remembered on this device until the customer signs out (CLAUDE.md: no
 * short maxAge). A Supabase browser client would need these cookies to be readable, so there isn't one.
 */
export function authCookieOptions(siteUrl: string) {
  return { path: "/", sameSite: "lax" as const, httpOnly: true, secure: siteUrl.startsWith("https://") };
}

export function accountIdentityCookieOptions(siteUrl: string, clear = false) {
  return {
    path: "/",
    sameSite: "lax" as const,
    httpOnly: false,
    secure: siteUrl.startsWith("https://"),
    ...(clear ? { maxAge: 0 } : {}),
  };
}

export { ACCOUNT_ID_COOKIE };
