import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Values come from server environment variables. Nothing here reaches the browser.
export const supabaseConfig = () => ({
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_PUBLISHABLE_KEY,
});

export async function getSupabase() {
  const { url, key } = supabaseConfig();
  if (!url || !key) return null;
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Cookies can't be set while rendering a page. proxy.ts refreshes them.
        }
      },
    },
  });
}
