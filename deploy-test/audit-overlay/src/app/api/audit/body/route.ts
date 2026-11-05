import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const body = await request.arrayBuffer();
  return NextResponse.json({ bytes: body.byteLength });
}
