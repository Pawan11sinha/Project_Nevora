import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  classifyReplayResult,
  cleanupTemporaryUsers,
  createSingleSessionGuard,
  createRefreshTokenFingerprinter,
  getStagingTargetProblem,
  isSuccessfulDistinctRotation,
  SESSION_END_TRIGGER_METADATA_QUERY,
  safeFailureLabel,
  summarizeConcurrentRefreshes,
  validateTriggerMetadata,
} from "../scripts/lib/def6-refresh-diagnostics.mjs";

const root = join(import.meta.dirname, "..");

test("refresh-token fingerprints compare tokens without exposing their values", () => {
  const fingerprint = createRefreshTokenFingerprinter(Buffer.alloc(32, 7));
  assert.equal(fingerprint("token-a"), fingerprint("token-a"));
  assert.notEqual(fingerprint("token-a"), fingerprint("token-b"));
});

test("a successful rotation must return a token different from every earlier token", () => {
  const fingerprint = createRefreshTokenFingerprinter(Buffer.alloc(32, 8));
  const original = fingerprint("token-0");
  const first = fingerprint("token-1");
  assert.equal(isSuccessfulDistinctRotation({ status: 200, rt: "token-1" }, [original], fingerprint), true);
  assert.equal(isSuccessfulDistinctRotation({ status: 200, rt: "token-0" }, [original], fingerprint), false);
  assert.equal(isSuccessfulDistinctRotation({ status: 400, rt: "token-2" }, [first], fingerprint), false);
  assert.equal(isSuccessfulDistinctRotation({ status: 200 }, [first], fingerprint), false);
});

test("a legitimate direct-parent retry returning the current token is not a fork", () => {
  const result = classifyReplayResult({
    status: 200,
    returnedFingerprint: "fingerprint-t1",
    currentFingerprint: "fingerprint-t1",
    activeTokenCount: 1,
  });
  assert.equal(result, "returned-current-token");
});

test("a rejected two-rotations-old replay is classified as rejected", () => {
  const result = classifyReplayResult({
    status: 400,
    returnedFingerprint: null,
    currentFingerprint: "fingerprint-t2",
    activeTokenCount: 0,
  });
  assert.equal(result, "rejected");
});

test("an additional active refresh-token row is required to classify a fork", () => {
  const result = classifyReplayResult({
    status: 200,
    returnedFingerprint: "fingerprint-new",
    currentFingerprint: "fingerprint-t2",
    activeTokenCount: 2,
  });
  assert.equal(result, "multiple-active-refresh-token-rows");
  assert.notEqual(classifyReplayResult({
    status: 200,
    returnedFingerprint: "fingerprint-new",
    currentFingerprint: "fingerprint-t2",
    activeTokenCount: 1,
  }), "multiple-active-refresh-token-rows");
});

test("concurrent responses may contain distinct rotated-token fingerprints without indicating a fork", () => {
  const result = summarizeConcurrentRefreshes({
    responses: [
      { status: 200, fingerprint: "token-a" },
      { status: 200, fingerprint: "token-b" },
      { status: 200, fingerprint: "token-a" },
      { status: 200, fingerprint: "token-b" },
      { status: 200, fingerprint: "token-a" },
      { status: 200, fingerprint: "token-b" },
    ],
    submittedFingerprint: "submitted-token",
    activeTokenCount: 1,
    sessionCount: 1,
  });
  assert.equal(result.passed, true);
  assert.equal(result.distinctResponseFingerprints, 2);
  assert.equal(result.singleLiveChain, true);
});

test("concurrent refresh regression fails on multiple active rows or missing response tokens", () => {
  const responses = [
    { status: 200, fingerprint: "rotated-token" },
    { status: 200, fingerprint: "rotated-token" },
  ];
  assert.equal(summarizeConcurrentRefreshes({
    responses,
    submittedFingerprint: "submitted-token",
    activeTokenCount: 2,
    sessionCount: 1,
  }).passed, false);
  assert.equal(summarizeConcurrentRefreshes({
    responses: [{ status: 200, fingerprint: null }],
    submittedFingerprint: "submitted-token",
    activeTokenCount: 1,
    sessionCount: 1,
  }).passed, false);
  assert.equal(summarizeConcurrentRefreshes({
    responses: [{ status: 400, fingerprint: "token" }],
    submittedFingerprint: "submitted-token",
    activeTokenCount: 1,
    sessionCount: 1,
  }).passed, false);
  assert.equal(summarizeConcurrentRefreshes({
    responses: responses.slice(0, 1),
    submittedFingerprint: "submitted-token",
    activeTokenCount: 1,
    sessionCount: 1,
  }).passed, false);
});

test("hosted DEF-6 harness uses one guarded user/session for two rotations and exact replay", () => {
  const harness = readFileSync(join(root, "scripts", "hosted-staging.mjs"), "utf8");
  assert.match(harness, /identityGuard\.beginUserCreation\(\)/);
  assert.match(harness, /identityGuard\.beginSessionCreation\(\)/);
  assert.match(harness, /const initial = await createSession\(\)/);
  assert.match(harness, /const firstRotation = await refresh\(initial\.rt\)/);
  assert.match(harness, /const secondRotation = await refresh\(firstRotation\.rt\)/);
  assert.ok(harness.indexOf("const secondRotation = await refresh(firstRotation.rt)")
    < harness.indexOf("const concurrentRetries = await Promise.all"));
  assert.match(harness, /Array\.from\(\{ length: 6 \}, \(\) => refresh\(firstRotation\.rt\)\)/);
  assert.match(harness, /const replay = await refresh\(initial\.rt\)/);
  assert.equal((harness.match(/admin\("\/auth\/v1\/admin\/users"/g) ?? []).length, 1);
  assert.equal((harness.match(/grant_type=password/g) ?? []).length, 1);
  assert.equal((harness.match(/createSession\(\)/g) ?? []).length, 1);
  assert.match(harness, /active_refresh_tokens/);
  assert.match(harness, /classifyReplayResult/);
});

test("the session guard refuses a second user or Auth session creation attempt", () => {
  const guard = createSingleSessionGuard();
  guard.beginUserCreation();
  assert.throws(() => guard.beginUserCreation(), /only one temporary user/);
  guard.recordUser("temporary-user");
  guard.beginSessionCreation();
  assert.throws(() => guard.beginSessionCreation(), /only one Auth session/);
  guard.recordSession("temporary-session");
  assert.equal(guard.userCount, 1);
  assert.equal(guard.sessionCount, 1);
});

test("staging preflight requires exact project identity and an explicitly verified pooler host", () => {
  const expectedRef = "mlrbxuvahdjtqkcpzwpv";
  assert.match(getStagingTargetProblem({
    ref: "",
    expectedRef,
    poolerHost: "",
    verifiedHostRef: "",
  }), /NEVORA_STAGING_REF, NEVORA_STAGING_POOLER_HOST, NEVORA_STAGING_POOLER_HOST_VERIFIED_REF/);
  assert.match(getStagingTargetProblem({
    ref: "anotherprojectreference",
    expectedRef,
    poolerHost: "aws-0-us-east-1.pooler.supabase.com",
    verifiedHostRef: expectedRef,
  }), /does not match the pinned/);
  assert.match(getStagingTargetProblem({
    ref: expectedRef,
    expectedRef,
    poolerHost: "aws-0-us-east-1.pooler.supabase.com",
    verifiedHostRef: "anotherprojectreference",
  }), /not attested/);
  assert.equal(getStagingTargetProblem({
    ref: expectedRef,
    expectedRef,
    poolerHost: "aws-0-us-east-1.pooler.supabase.com",
    verifiedHostRef: expectedRef,
  }), null);
});

test("cleanup attempts Auth deletion even when profile deletion fails and sanitizes the failure", async () => {
  const calls = [];
  const result = await cleanupTemporaryUsers({
    userIds: ["temporary-user-id"],
    deleteProfile: async () => {
      calls.push("profile");
      throw new Error("private@example.com password=secret refresh_token=raw-token");
    },
    deleteAuthUser: async () => {
      calls.push("auth");
      return { ok: true };
    },
    readRemaining: async () => [],
    wait: async () => {},
  });

  assert.deepEqual(calls, ["profile", "auth"]);
  assert.equal(result.clean, true);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].reason, "operation failed");
  assert.doesNotMatch(JSON.stringify(result), /private@example|secret|raw-token/);
});

test("cleanup retries boundedly and verifies scoped residual user IDs", async () => {
  let deletionAttempts = 0;
  const waits = [];
  const result = await cleanupTemporaryUsers({
    userIds: ["temporary-user-id"],
    deleteProfile: async () => ({ ok: true }),
    deleteAuthUser: async () => {
      deletionAttempts++;
      return deletionAttempts === 1 ? { ok: false, status: 503 } : { ok: true };
    },
    readRemaining: async () => deletionAttempts < 2 ? ["temporary-user-id"] : [],
    attempts: 3,
    retryDelayMs: 10,
    wait: async (ms) => waits.push(ms),
  });
  assert.equal(result.clean, true);
  assert.equal(result.attemptsUsed, 2);
  assert.equal(deletionAttempts, 2);
  assert.deepEqual(waits, [10]);
  assert.equal(result.failures[0].reason, "HTTP 503");
});

test("cleanup refuses to operate on more than one temporary user", async () => {
  await assert.rejects(cleanupTemporaryUsers({
    userIds: ["temporary-user-1", "temporary-user-2"],
    deleteProfile: async () => ({ ok: true }),
    deleteAuthUser: async () => ({ ok: true }),
    readRemaining: async () => [],
  }), /more than one temporary user/);
});

test("safe failure labels expose only bounded HTTP statuses and safe codes", () => {
  assert.equal(safeFailureLabel({
    status: 502,
    code: "upstream_unavailable",
    message: "private@example.com password=secret",
    body: "raw response token",
  }), "HTTP 502 code=upstream_unavailable");
  assert.equal(safeFailureLabel({ code: "private@example.com", message: "raw token" }), "operation failed");
  assert.equal(safeFailureLabel({ status: 700 }), "operation failed");
});

test("trigger metadata validation requires enabled deferred constraint and safe function behavior", () => {
  const metadata = {
    trigger_enabled: true,
    is_constraint: true,
    deferrable: true,
    initially_deferred: true,
    trigger_definition: "CREATE CONSTRAINT TRIGGER end_session AFTER UPDATE OF revoked ON auth.refresh_tokens DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN ((new.revoked AND NOT old.revoked)) EXECUTE FUNCTION public.end_session_without_active_refresh_token()",
    security_definer: true,
    function_search_path_empty: true,
    function_definition: "CREATE FUNCTION public.end_session() SECURITY DEFINER SET search_path TO '' AS $$ BEGIN IF NOT EXISTS (SELECT 1 FROM auth.refresh_tokens t WHERE t.session_id = new.session_id AND NOT t.revoked) THEN DELETE FROM auth.sessions s WHERE s.id = new.session_id; END IF; END $$",
  };
  assert.deepEqual(validateTriggerMetadata(metadata), {
    enabled: true,
    constraint: true,
    deferred: true,
    triggerDefinition: true,
    functionSecurity: true,
    functionBehavior: true,
  });
  assert.equal(validateTriggerMetadata({ ...metadata, trigger_enabled: false }).enabled, false);
  assert.equal(validateTriggerMetadata({ ...metadata, function_search_path_empty: false }).functionSecurity, false);
  assert.equal(validateTriggerMetadata({ ...metadata, initially_deferred: false }).deferred, false);
});

test("session-ending trigger metadata SQL uses valid PostgreSQL catalog fields", () => {
  const query = SESSION_END_TRIGGER_METADATA_QUERY.toLowerCase();
  assert.match(query, /t\.tgconstraint\s*<>\s*0\s+as is_constraint/);
  assert.match(query, /t\.tgenabled in \('o', 'a'\)\s+as trigger_enabled/);
  assert.match(query, /t\.tgdeferrable as deferrable/);
  assert.match(query, /t\.tginitdeferred as initially_deferred/);
  assert.doesNotMatch(query, /tgisconstraint/);
});

test("hosted cleanup is keyed by a validated run ID and reports forced-termination limits", () => {
  const harness = readFileSync(join(root, "scripts", "hosted-staging.mjs"), "utf8");
  assert.match(harness, /cleanup-def6 <run-id>/);
  assert.match(harness, /email = '\$\{email\}'/);
  assert.match(harness, /NEVORA_STAGING_POOLER_HOST_VERIFIED_REF/);
  assert.match(harness, /No request was made/);
  assert.ok(harness.includes("!/^[a-z0-9]{1,32}$/.test(runId)"));
  assert.match(harness, /forced process termination can bypass cleanup/);
  assert.match(harness, /union select user_id::text from auth\.sessions/);
  assert.match(harness, /union select user_id::text from auth\.refresh_tokens/);
});
