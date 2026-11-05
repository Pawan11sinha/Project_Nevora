import { NextResponse, after } from "next/server";
export const dynamic = "force-dynamic";
const state = globalThis as unknown as { auditAfterRan?: number };
export function GET() {
  const seen = state.auditAfterRan ?? 0;
  after(() => { state.auditAfterRan = (state.auditAfterRan ?? 0) + 1; });
  return NextResponse.json({ afterRunsSeen: seen });
}
