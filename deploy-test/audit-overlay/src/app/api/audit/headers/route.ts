import { NextResponse } from "next/server";
import { headers } from "next/headers";

// Test-only: lists header names the app receives, never values.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ names: [...(await headers()).keys()] });
}
