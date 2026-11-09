import { createHmac, randomBytes } from "node:crypto";

export function createRefreshTokenFingerprinter(key = randomBytes(32)) {
  return (token) => createHmac("sha256", key).update(token).digest("hex");
}

export function isSuccessfulDistinctRotation(result, previousFingerprints, fingerprint) {
  if (result?.status !== 200 || typeof result.rt !== "string" || result.rt.length === 0) return false;
  const nextFingerprint = fingerprint(result.rt);
  return previousFingerprints.every((previous) => previous !== nextFingerprint);
}

export function classifyReplayResult({ status, returnedFingerprint, currentFingerprint, activeTokenCount }) {
  if (activeTokenCount > 1) return "multiple-active-refresh-token-rows";
  if (status !== 200) return "rejected";
  if (!returnedFingerprint) return "success-without-refresh-token";
  if (returnedFingerprint === currentFingerprint) return "returned-current-token";
  if (activeTokenCount === 1) return "new-token-with-one-active-row";
  return "success-with-no-active-token-row";
}

export function summarizeConcurrentRefreshes({
  responses,
  submittedFingerprint,
  activeTokenCount,
  sessionCount,
}) {
  const fingerprints = responses.map((response) => response?.fingerprint ?? null);
  const allSuccessful = responses.length === 6 && responses.every((response) => response?.status === 200);
  const allHaveTokens = fingerprints.every((fingerprint) => typeof fingerprint === "string" && fingerprint.length > 0);
  const rotated = allHaveTokens && fingerprints.some((fingerprint) => fingerprint !== submittedFingerprint);
  const singleLiveChain = activeTokenCount === 1 && sessionCount === 1;
  return {
    passed: allSuccessful && allHaveTokens && rotated && singleLiveChain,
    allSuccessful,
    allHaveTokens,
    rotated,
    singleLiveChain,
    distinctResponseFingerprints: new Set(fingerprints.filter(Boolean)).size,
    activeTokenCount,
    sessionCount,
  };
}

export function validateTriggerMetadata(metadata) {
  const triggerDefinition = String(metadata?.trigger_definition ?? "").toLowerCase().replace(/\s+/g, " ");
  const functionDefinition = String(metadata?.function_definition ?? "").toLowerCase().replace(/\s+/g, " ");
  const functionConfig = Array.isArray(metadata?.function_config) ? metadata.function_config : [];
  const searchPathEmpty = metadata?.function_search_path_empty === true || functionConfig.some((entry) => {
    const [name, value] = String(entry).split("=");
    return name?.toLowerCase() === "search_path" && value === '""';
  });
  return {
    enabled: metadata?.trigger_enabled === true,
    constraint: metadata?.is_constraint === true,
    deferred: metadata?.deferrable === true && metadata?.initially_deferred === true,
    triggerDefinition: /after update of revoked on auth\.refresh_tokens/.test(triggerDefinition)
      && /deferrable initially deferred/.test(triggerDefinition)
      && /new\.revoked/.test(triggerDefinition)
      && /old\.revoked/.test(triggerDefinition),
    functionSecurity: metadata?.security_definer === true && searchPathEmpty,
    functionBehavior: /not exists\s*\(\s*select 1 from auth\.refresh_tokens/.test(functionDefinition)
      && /not t\.revoked/.test(functionDefinition)
      && /delete from auth\.sessions/.test(functionDefinition)
      && /new\.session_id/.test(functionDefinition),
  };
}

export const SESSION_END_TRIGGER_METADATA_QUERY = `select
  t.tgenabled in ('O', 'A') as trigger_enabled,
  t.tgconstraint <> 0 as is_constraint,
  t.tgdeferrable as deferrable,
  t.tginitdeferred as initially_deferred,
  pg_get_triggerdef(t.oid) as trigger_definition,
  p.prosecdef as security_definer,
  p.proconfig as function_config,
  coalesce(p.proconfig @> array['search_path=""']::text[], false) as function_search_path_empty,
  pg_get_functiondef(p.oid) as function_definition
  from pg_trigger t
  join pg_proc p on p.oid = t.tgfoid
  where t.tgrelid = 'auth.refresh_tokens'::regclass
    and t.tgname = 'end_session_without_active_refresh_token'`;

export function safeFailureLabel(error) {
  const status = Number.isInteger(error?.status) && error.status >= 100 && error.status <= 599
    ? `HTTP ${error.status}`
    : null;
  const code = typeof error?.code === "string" && /^[a-z][a-z0-9_]{0,63}$/i.test(error.code)
    ? `code=${error.code}`
    : null;
  return [status, code].filter(Boolean).join(" ") || "operation failed";
}

export function getStagingTargetProblem({ ref, expectedRef, poolerHost, verifiedHostRef }) {
  const missing = [];
  if (!ref) missing.push("NEVORA_STAGING_REF");
  if (!poolerHost) missing.push("NEVORA_STAGING_POOLER_HOST");
  if (!verifiedHostRef) missing.push("NEVORA_STAGING_POOLER_HOST_VERIFIED_REF");
  if (missing.length) return `missing ${missing.join(", ")}`;
  if (ref !== expectedRef) return "NEVORA_STAGING_REF does not match the pinned nevora-staging project";
  if (!/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(poolerHost)) return "NEVORA_STAGING_POOLER_HOST is not a valid Supabase Session pooler hostname";
  if (verifiedHostRef !== expectedRef) return "the pooler host is not attested for the pinned nevora-staging project";
  return null;
}

export function createSingleSessionGuard() {
  let userCreationStarted = false;
  let sessionCreationStarted = false;
  let userId;
  let sessionId;

  return {
    beginUserCreation() {
      if (userCreationStarted) throw new Error("DEF-6 may create only one temporary user.");
      userCreationStarted = true;
    },
    recordUser(id) {
      if (!userCreationStarted || userId || typeof id !== "string" || id.length === 0) {
        throw new Error("DEF-6 temporary user limit or identity check failed.");
      }
      userId = id;
    },
    beginSessionCreation() {
      if (!userId || sessionCreationStarted) throw new Error("DEF-6 may create only one Auth session for its temporary user.");
      sessionCreationStarted = true;
    },
    recordSession(id) {
      if (!sessionCreationStarted || sessionId || typeof id !== "string" || id.length === 0) {
        throw new Error("DEF-6 Auth session limit or identity check failed.");
      }
      sessionId = id;
    },
    get userCount() {
      return Number(userCreationStarted);
    },
    get sessionCount() {
      return Number(sessionCreationStarted);
    },
  };
}

export async function cleanupTemporaryUsers({
  userIds,
  deleteProfile,
  deleteAuthUser,
  readRemaining,
  attempts = 3,
  retryDelayMs = 500,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  const allUserIds = [...new Set(userIds)];
  if (allUserIds.length > 1) throw new Error("DEF-6 cleanup refuses more than one temporary user.");
  const failures = [];
  let remaining = allUserIds;
  let verified = false;
  let attemptsUsed = 0;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    attemptsUsed = attempt;
    for (const [index, userId] of remaining.entries()) {
      for (const [operation, action] of [["profile deletion", deleteProfile], ["Auth user deletion", deleteAuthUser]]) {
        try {
          const result = await action(userId);
          if (result?.ok === false) {
            failures.push({ operation, userIndex: index + 1, attempt, reason: safeFailureLabel(result) });
          }
        } catch (error) {
          failures.push({ operation, userIndex: index + 1, attempt, reason: safeFailureLabel(error) });
        }
      }
    }

    try {
      remaining = await readRemaining(allUserIds);
      verified = true;
      if (remaining.length === 0) break;
    } catch (error) {
      verified = false;
      remaining = allUserIds;
      failures.push({ operation: "cleanup verification", attempt, reason: safeFailureLabel(error) });
    }

    if (attempt < attempts && remaining.length > 0) await wait(retryDelayMs * attempt);
  }

  if (!verified || remaining.length > 0) {
    try {
      remaining = await readRemaining(allUserIds);
      verified = true;
    } catch (error) {
      verified = false;
      failures.push({ operation: "final cleanup verification", attempt: attemptsUsed, reason: safeFailureLabel(error) });
    }
  }

  return { clean: verified && remaining.length === 0, remainingCount: remaining.length, attemptsUsed, failures };
}
