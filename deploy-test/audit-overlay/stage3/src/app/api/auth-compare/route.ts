import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Temporary test-only route: compares getClaims and getUser. Reports results only, never tokens.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = process.env.DEPLOY_TEST_TOKEN;
  if (!token || request.headers.get("x-test-token") !== token) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const store = await cookies();
  const run = async (method: "getClaims" | "getUser") => {
    let fetches = 0;
    const client = createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      global: { fetch: (...args: Parameters<typeof fetch>) => { fetches++; return fetch(...args); } },
      cookies: { getAll: () => store.getAll(), setAll: () => {} },
    });
    const result = method === "getClaims"
      ? Boolean((await client.auth.getClaims()).data?.claims)
      : Boolean((await client.auth.getUser()).data.user);
    return { accepted: result, fetches };
  };
  return NextResponse.json(
    { getClaims: await run("getClaims"), getUser: await run("getUser") },
    { headers: { "Cache-Control": "no-store" } },
  );
}
