import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  const mb = Number(new URL(request.url).searchParams.get("mb") ?? 1);
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < mb; i++) chunks.push(new Uint8Array(1024 * 1024).fill(1));
  return NextResponse.json({ allocatedMb: chunks.length });
}
