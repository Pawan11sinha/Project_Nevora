import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/supabase";

// Test 7: a database write through a Postgres function. Each POST tries to take
// one unit of a test item. A token keeps strangers from calling it.
export const dynamic = "force-dynamic";

const noStore = { headers: { "Cache-Control": "no-store" } };

export async function POST(request: Request) {
  const token = process.env.DEPLOY_TEST_TOKEN;
  if (!token || request.headers.get("x-test-token") !== token) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, ...noStore });
  }
  const { url, key } = supabaseConfig();
  if (!url || !key) {
    return NextResponse.json({ error: "not configured" }, { status: 503, ...noStore });
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("deploy_test_take_one");
  if (error) {
    // The detail stays in server logs, and the client gets a generic message.
    console.error("db-test failed", error.code);
    return NextResponse.json({ error: "database error" }, { status: 500, ...noStore });
  }
  return NextResponse.json({ taken: data }, noStore);
}
