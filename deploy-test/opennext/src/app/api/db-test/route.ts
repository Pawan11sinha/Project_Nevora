import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/supabase";

// Test 7: a database write through a Postgres function. Each POST tries to take
// one unit of a test item. A token keeps strangers from calling it.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = process.env.DEPLOY_TEST_TOKEN;
  if (!token || request.headers.get("x-test-token") !== token) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { url, key } = supabaseConfig();
  if (!url || !key) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("deploy_test_take_one");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ taken: data });
}
