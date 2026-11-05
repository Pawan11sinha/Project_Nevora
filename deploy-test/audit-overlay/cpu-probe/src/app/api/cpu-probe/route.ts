import { NextResponse } from "next/server";

// Temporary test-only route: burns a chosen amount of CPU to find when Cloudflare
// actually stops a request. Deployed for the probe, then removed.
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const token = process.env.DEPLOY_TEST_TOKEN;
  if (!token || request.headers.get("x-test-token") !== token) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const iterations = Math.min(Number(new URL(request.url).searchParams.get("n") ?? 0), 5e9);
  let x = 0;
  for (let i = 0; i < iterations; i++) x = (x + i * 31) % 1000003;
  return NextResponse.json({ iterations, x }, { headers: { "Cache-Control": "no-store" } });
}
