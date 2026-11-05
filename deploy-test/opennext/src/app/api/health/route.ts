import { NextResponse } from "next/server";

// Test 6: the lightest possible server-side route.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { ok: true, at: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
