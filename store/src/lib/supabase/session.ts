import "server-only";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "./server";

/** Supabase's session cookie (sb-<ref>-auth-token, or its numbered chunks), not the PKCE code-verifier cookies. */
const SESSION_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

// The check every customer page and action uses before touching account data (DEF-6). Two steps:
// 1. getUser() asks Supabase Auth, so a forged or expired token, a deleted user or a signed-out session fails.
// 2. current_session_is_live() asks the database whether this exact session still has an active refresh token. After
//    Supabase detects refresh-token reuse it revokes the tokens but keeps the session, so getUser() alone would still
//    accept access tokens issued before the theft was noticed. The database trigger also ends such sessions; this
//    check doesn't rely on it.
// Anything uncertain (Supabase unreachable, the check erroring) counts as signed out: it fails closed.
export type LiveCustomer = { supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>; user: User };

export async function getLiveCustomer(): Promise<{ status: "live"; customer: LiveCustomer } | { status: "signed-out" | "ended" | "unavailable" }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "unavailable" };
  const hadSession = (await cookies()).getAll().some((c) => SESSION_COOKIE.test(c.name));
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user) {
    // No session cookie at all: simply signed out.
    if (!hadSession) return { status: "signed-out" };
    // A session cookie that Supabase refuses: the session ended (signed out elsewhere, revoked, ended by the trigger
    // after reuse detection) or the token is bad. Supabase reports a deleted session as "session missing", so the
    // cookie, not the error type, tells this apart from never having signed in.
    if (!error || error.name === "AuthSessionMissingError" || error.status === 401 || error.status === 403 || error.code === "session_not_found" || error.code === "bad_jwt" || error.code === "user_not_found") return { status: "ended" };
    return { status: "unavailable" };
  }
  const { data: live, error: liveError } = await supabase.rpc("current_session_is_live");
  if (liveError) return { status: "unavailable" };
  if (live !== true) return { status: "ended" };
  return { status: "live", customer: { supabase, user } };
}
