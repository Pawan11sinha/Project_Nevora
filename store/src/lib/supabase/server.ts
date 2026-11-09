import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { authCookieOptions, readSupabaseConfig } from "./config";

export type { EmailOtpType } from "@supabase/supabase-js";

// The Supabase client for server components, server actions and route handlers. A new one per request, using the
// publishable key and the customer's own HttpOnly session cookies, so the database applies RLS as that customer.
// Returns null when Supabase isn't configured, so pages can show "sign-in unavailable" instead of failing.
export async function createSupabaseServerClient() {
  const config = readSupabaseConfig();
  if (!config) return null;
  const store = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookieOptions: authCookieOptions(config.siteUrl),
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Server components can't set cookies. proxy.ts refreshes /account sessions before the page renders, and
          // server actions and route handlers can set them, so nothing is lost here.
        }
      },
    },
  });
}

export function siteUrl() {
  return readSupabaseConfig()?.siteUrl ?? null;
}
