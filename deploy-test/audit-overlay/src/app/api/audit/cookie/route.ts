import { NextResponse } from "next/server";
import { cookies } from "next/headers";
export const dynamic = "force-dynamic";
export async function GET() {
  const store = await cookies();
  store.set("audit_a", "1", { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  store.set("audit_b", "2", { httpOnly: true, secure: true, sameSite: "strict", path: "/" });
  return NextResponse.json({ received: store.getAll().map((c) => c.name) });
}
