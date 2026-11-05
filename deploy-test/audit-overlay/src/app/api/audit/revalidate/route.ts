import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
export const dynamic = "force-dynamic";
export function POST(request: Request) {
  const path = new URL(request.url).searchParams.get("path") ?? "/";
  revalidatePath(path);
  return NextResponse.json({ revalidated: path });
}
