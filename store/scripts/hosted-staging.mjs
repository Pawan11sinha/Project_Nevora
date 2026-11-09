// Hosted STAGING Supabase project: connectivity check, migrations and the DEF-6 verification.
// Never for production. Secrets are read from the macOS Keychain and never printed, logged or passed on a shell line:
//   nevora-staging-db-password       the project's database password
//   nevora-staging-secret-key        the project's secret key (sb_secret_…), used only by this test script
//   nevora-staging-publishable-key   the project's publishable key (sb_publishable_…)
// Non-secret settings come from the environment:
//   NEVORA_STAGING_REF          the staging project's reference (20 lower-case letters)
//   NEVORA_STAGING_POOLER_HOST  the Session pooler host from the dashboard's Connect dialog (aws-N-<region>.pooler.supabase.com)
//   NEVORA_STAGING_POOLER_HOST_VERIFIED_REF  set to the project reference only after verifying that host in its dashboard
//
//   node scripts/hosted-staging.mjs check            connect, list what's in the database (read-only)
//   node scripts/hosted-staging.mjs migrate --dry-run
//   node scripts/hosted-staging.mjs migrate --apply  apply store/supabase/migrations in order (only onto an empty or NÉVORA-only database)
//   node scripts/hosted-staging.mjs verify-def6      the DEF-6 sequence against hosted Auth, then removes its test users
//   node scripts/hosted-staging.mjs cleanup-def6 <run-id> retry cleanup after an interrupted run; forced termination can bypass cleanup
import { execFileSync } from "node:child_process";
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
} from "./lib/def6-refresh-diagnostics.mjs";

const STORE = new URL("..", import.meta.url).pathname;
const EXPECTED_STAGING_REF = "mlrbxuvahdjtqkcpzwpv";
const mode = process.argv[2];
const ref = process.env.NEVORA_STAGING_REF ?? "";
const poolerHost = process.env.NEVORA_STAGING_POOLER_HOST ?? "";
const verifiedHostRef = process.env.NEVORA_STAGING_POOLER_HOST_VERIFIED_REF ?? "";
if (mode === "verify-def6" || mode === "cleanup-def6") {
  const problem = getStagingTargetProblem({
    ref,
    expectedRef: EXPECTED_STAGING_REF,
    poolerHost,
    verifiedHostRef,
  });
  if (problem) throw new Error(`Staging preflight refused: ${problem}. No request was made.`);
} else {
  if (!/^[a-z]{20}$/.test(ref)) throw new Error("Set NEVORA_STAGING_REF to the staging project's 20-letter reference.");
  if (!/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(poolerHost)) throw new Error("Set NEVORA_STAGING_POOLER_HOST to the Session pooler host from the Connect dialog.");
}
const api = `https://${ref}.supabase.co`;

const keychain = (service) => {
  try {
    return execFileSync("security", ["find-generic-password", "-s", service, "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    throw new Error(`Keychain item "${service}" not found. See the setup steps.`);
  }
};
const dbUrl = () => `postgresql://postgres.${ref}:${encodeURIComponent(keychain("nevora-staging-db-password"))}@${poolerHost}:5432/postgres`;
const cli = (args) => execFileSync("npm", ["run", "-s", "supabase", "--", ...args], { cwd: STORE, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const redact = (text) => String(text).replaceAll(/postgres(ql)?:\/\/[^@\s]+@/g, "postgresql://postgres.***:***@");
// Every query runs in a read-only transaction unless a caller explicitly needs to write (only the DEF-6 test cleanup).
const sql = (query, { write = false } = {}) => {
  try {
    const out = JSON.parse(cli(["db", "query", `--remote=${dbUrl()}`, ...(write ? ["--yes"] : ["--read-only"]), "--output-format", "json", query]));
    return out.rows ?? out;
  } catch {
    throw new Error("SQL command failed.");
  }
};

const OUR_TABLES = ["profiles"];
const recoveryRunId = process.argv[3];

if (mode === "cleanup-def6") {
  if (!await cleanupDef6(recoveryRunId)) process.exitCode = 1;
} else if (mode === "check" || mode === "inspect") {
  // Read-only: every query below runs in a read-only transaction.
  const one = (q) => sql(q)[0];
  const v = one("select current_setting('server_version') as version, current_user as role, (select rolsuper from pg_roles where rolname = current_user) as superuser, current_setting('transaction_read_only') as read_only");
  console.log(`Connected to ${ref}: PostgreSQL ${v.version}, as ${v.role} (superuser: ${v.superuser}; this transaction read-only: ${v.read_only})`);
  const objects = one(`select
    (select count(*) from information_schema.tables where table_schema = 'public')::int as public_tables,
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public')::int as public_functions,
    (select count(*) from pg_policies where schemaname = 'public')::int as public_policies,
    (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('auth', 'public') and not t.tgisinternal)::int as auth_public_triggers,
    (select count(*) from auth.users)::int as auth_users,
    (select count(*) from auth.sessions)::int as auth_sessions,
    (select count(*) from auth.refresh_tokens)::int as refresh_tokens,
    (select count(*) from pg_namespace where nspname = 'supabase_migrations')::int as migrations_schema`);
  console.log("objects:", JSON.stringify(objects));
  if (objects.public_tables) console.log("public tables:", sql("select table_name from information_schema.tables where table_schema = 'public' order by 1").map((r) => r.table_name).join(", "));
  if (objects.public_functions) console.log("public functions:", sql("select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by 1").map((r) => r.proname).join(", "));
  if (objects.auth_public_triggers) console.log("triggers:", JSON.stringify(sql("select n.nspname || '.' || c.relname as on_table, t.tgname from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('auth','public') and not t.tgisinternal")));
  if (objects.migrations_schema) console.log("recorded migrations:", sql("select version from supabase_migrations.schema_migrations order by 1").map((r) => r.version).join(", ") || "(none)");
  if (mode === "inspect") {
    // What the migrations need, checked with PostgreSQL's privilege functions: nothing is created or changed.
    const priv = sql(`select
      pg_get_userbyid(c.relowner) as owner, n.nspname || '.' || c.relname as tbl,
      has_table_privilege(current_user, c.oid, 'TRIGGER') as can_trigger,
      has_table_privilege(current_user, c.oid, 'SELECT') as can_select,
      has_table_privilege(current_user, c.oid, 'DELETE') as can_delete,
      has_table_privilege(current_user, c.oid, 'UPDATE') as can_update,
      c.relrowsecurity as rls_on
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where (n.nspname, c.relname) in (('auth','users'), ('auth','sessions'), ('auth','refresh_tokens'))
      order by 2`);
    console.log("auth table privileges for", v.role + ":");
    for (const p of priv) console.log(`  ${p.tbl.padEnd(20)} owner ${p.owner}; trigger ${p.can_trigger}, select ${p.can_select}, delete ${p.can_delete}, update ${p.can_update}; RLS ${p.rls_on}`);
    const cols = sql(`select table_name, string_agg(column_name || ':' || data_type, ', ' order by ordinal_position) as cols
      from information_schema.columns where table_schema = 'auth' and table_name in ('sessions','refresh_tokens')
        and column_name in ('id','user_id','session_id','revoked','token','not_after','parent') group by 1 order by 1`);
    for (const c of cols) console.log(`  auth.${c.table_name} columns used: ${c.cols}`);
    const misc = one(`select
      has_schema_privilege(current_user, 'public', 'CREATE') as create_in_public,
      has_schema_privilege(current_user, 'auth', 'USAGE') as use_auth_schema,
      exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'auth' and p.proname = 'uid') as auth_uid,
      exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'auth' and p.proname = 'jwt') as auth_jwt,
      exists (select 1 from pg_roles where rolname = 'authenticated') as role_authenticated,
      exists (select 1 from pg_roles where rolname = 'anon') as role_anon,
      (select string_agg(defaclobjtype::text || ':' || array_to_string(defaclacl, ' '), ' | ') from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace where n.nspname = 'public' and pg_get_userbyid(d.defaclrole) = current_user) as default_privileges_public`);
    console.log("other prerequisites:", JSON.stringify(misc));
  }
} else if (mode === "migrate") {
  // Refuse a database that has anything we didn't create: it's not the NÉVORA staging project.
  const tables = sql("select table_name from information_schema.tables where table_schema = 'public'").map((r) => r.table_name);
  const foreign = tables.filter((t) => !OUR_TABLES.includes(t));
  if (foreign.length) throw new Error(`Refusing: this database has tables NÉVORA's migrations don't create (${foreign.join(", ")}). Is NEVORA_STAGING_REF the staging project?`);
  const flag = process.argv[3];
  if (flag !== "--dry-run" && flag !== "--apply") throw new Error("Use migrate --dry-run or migrate --apply.");
  try {
    // The CLI refuses changes to a remote database without --yes; it's passed only for --apply, which the owner approves.
    const out = cli(["db", "push", `--remote=${dbUrl()}`, "--skip-vault", ...(flag === "--dry-run" ? ["--dry-run"] : ["--yes"])]);
    console.log(redact(out ? "Migration command completed." : "Migration command completed with no output."));
  } catch {
    throw new Error("Migration command failed.");
  }
} else if (mode === "verify-def6") {
  await verifyDef6();
} else {
  console.log("Usage: node scripts/hosted-staging.mjs check | migrate --dry-run | migrate --apply | verify-def6 | cleanup-def6 <run-id>");
}

async function cleanupDef6(runId, knownIds = []) {
  if (typeof runId !== "string" || !/^[a-z0-9]{1,32}$/.test(runId)) {
    console.error("Cleanup refused: provide only the alphanumeric temporary run identifier.");
    return false;
  }
  if (knownIds.length > 1) {
    console.error(`Cleanup refused for temporary run ${runId}: more than one temporary user identifier was supplied.`);
    return false;
  }
  const email = `def6-hosted-${runId}@example.com`;
  const userIds = [...new Set(knownIds)];
  if (userIds.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
    console.error(`Cleanup refused for temporary run ${runId}: invalid user identifier.`);
    return false;
  }

  try {
    const secret = keychain("nevora-staging-secret-key");
    const discovered = sql(`select id::text from auth.users where email = '${email}'`).map((row) => row.id);
    userIds.push(...discovered);
    const ids = [...new Set(userIds)];
    if (ids.length > 1) {
      console.error(`Cleanup refused for temporary run ${runId}: exact identifier lookup found more than one user.`);
      return false;
    }
    const idSql = ids.length ? ids.map((id) => `'${id}'::uuid`).join(",") : null;
    const result = await cleanupTemporaryUsers({
      userIds: ids,
      deleteProfile: async (id) => {
        sql(`delete from public.profiles where id = '${id}'::uuid`, { write: true });
        return { ok: true };
      },
      deleteAuthUser: async (id) => {
        const response = await fetch(`${api}/auth/v1/admin/users/${id}`, {
          method: "DELETE",
          headers: { apikey: secret, Authorization: `Bearer ${secret}` },
        });
        return { ok: response.ok || response.status === 404, status: response.status };
      },
      readRemaining: async () => {
        if (!idSql) return [];
        return sql(`select id::text from auth.users where id in (${idSql}) or email = '${email}'
          union select id::text from public.profiles where id in (${idSql})
          union select user_id::text from auth.sessions where user_id in (${idSql})
          union select user_id::text from auth.refresh_tokens where user_id in (${idSql})`).map((row) => row.id);
      },
    });

    let counts = { users: 0, profiles: 0, sessions: 0, refresh_tokens: 0 };
    if (ids.length) {
      counts = sql(`select
        (select count(*) from auth.users where id in (${idSql}) or email = '${email}')::int as users,
        (select count(*) from public.profiles where id in (${idSql}))::int as profiles,
        (select count(*) from auth.sessions where user_id in (${idSql}))::int as sessions,
        (select count(*) from auth.refresh_tokens where user_id in (${idSql}))::int as refresh_tokens`)[0];
    }
    const clean = result.clean && counts.users === 0 && counts.profiles === 0 && counts.sessions === 0 && counts.refresh_tokens === 0;
    console.log(`Cleanup for temporary run ${runId}: ${clean ? "verified clean" : "INCOMPLETE"}; users=${counts.users}, profiles=${counts.profiles}, sessions=${counts.sessions}, refresh_tokens=${counts.refresh_tokens}; attempts=${result.attemptsUsed}.`);
    for (const failure of result.failures) {
      console.error(`Cleanup ${failure.operation} failed for temporary user #${failure.userIndex ?? "?"}, attempt ${failure.attempt}: ${failure.reason}.`);
    }
    if (!clean) console.error("Recovery is still required; forced process termination can bypass cleanup.");
    return clean;
  } catch (error) {
    console.error(`Cleanup for temporary run ${runId} failed: ${safeFailureLabel(error)}.`);
    return false;
  }
}

async function verifyDef6() {
  const secret = keychain("nevora-staging-secret-key");
  const publishable = keychain("nevora-staging-publishable-key");
  let failed = 0;
  const check = (name, pass, detail = "") => { console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!pass) failed++; };
  const requireCheck = (name, pass, detail = "") => {
    check(name, pass, detail);
    if (!pass) throw new Error(`Required DEF-6 condition failed: ${name}.`);
  };
  const claims = (jwt) => JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
  const parseJson = async (response) => {
    try {
      return await response.json();
    } catch {
      throw Object.assign(new Error("Invalid JSON response."), { status: response.status });
    }
  };
  const safeCode = (value) => typeof value === "string" && /^[a-z][a-z0-9_]{0,63}$/i.test(value) ? value : undefined;
  const fingerprint = createRefreshTokenFingerprinter();
  const tokenFingerprint = (token) => typeof token === "string" ? fingerprint(token) : null;
  const identityGuard = createSingleSessionGuard();
  const admin = (path, init = {}) => fetch(`${api}${path}`, { ...init, headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json", ...init.headers } });
  const refresh = async (rt) => {
    const response = await fetch(`${api}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: publishable, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
    });
    const body = await parseJson(response);
    return { status: response.status, code: safeCode(body.error_code), rt: body.refresh_token, at: body.access_token };
  };
  const getUser = async (at) => (await fetch(`${api}/auth/v1/user`, {
    headers: { apikey: publishable, Authorization: `Bearer ${at}` },
  })).status;
  const live = async (at) => {
    const response = await fetch(`${api}/rest/v1/rpc/current_session_is_live`, {
      method: "POST",
      headers: { apikey: publishable, Authorization: `Bearer ${at}`, "Content-Type": "application/json" },
      body: "{}",
    });
    if (response.status !== 200) return `HTTP ${response.status}`;
    const result = await parseJson(response);
    return typeof result === "boolean" ? result : "unexpected response";
  };
  const profiles = async (at) => {
    const response = await fetch(`${api}/rest/v1/profiles?select=id`, {
      headers: { apikey: publishable, Authorization: `Bearer ${at}` },
    });
    return response.status === 200 ? (await parseJson(response)).length : `HTTP ${response.status}`;
  };
  const run = Date.now().toString(36);
  const email = `def6-hosted-${run}@example.com`;
  const made = [];
  const sessionState = (sid, uid) => {
    const validUuid = (id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    if (!validUuid(sid) || !validUuid(uid)) throw new Error("Auth returned an invalid temporary user or session ID.");
    return sql(`select
      count(s.id)::int as session_rows,
      (select count(*)::int from auth.sessions u where u.user_id = '${uid}'::uuid) as user_session_rows,
      coalesce(bool_or(
        (s.not_after is null or s.not_after > now())
        and exists (select 1 from auth.refresh_tokens t where t.session_id = s.id and not t.revoked)
      ), false) as session_live,
      (select count(*)::int from auth.refresh_tokens t where t.session_id = '${sid}'::uuid and not t.revoked) as active_refresh_tokens
      from auth.sessions s where s.id = '${sid}'::uuid`)[0];
  };
  const createSession = async () => {
    identityGuard.beginUserCreation();
    const createResponse = await admin("/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({ email, password: `Def6-${run}-Aa1`, email_confirm: true, user_metadata: { full_name: "DEF-6 hosted test" } }),
    });
    if (!createResponse.ok) throw Object.assign(new Error("Test user creation failed."), { status: createResponse.status });
    const created = await parseJson(createResponse);
    const validUuid = (id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    if (!validUuid(created.id)) throw new Error("Auth returned an invalid temporary user identifier.");
    identityGuard.recordUser(created.id);
    made.push(created.id);

    identityGuard.beginSessionCreation();
    const loginResponse = await fetch(`${api}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: publishable, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: `Def6-${run}-Aa1` }),
    });
    if (!loginResponse.ok) throw Object.assign(new Error("Temporary test login failed."), { status: loginResponse.status });
    const login = await parseJson(loginResponse);
    const sessionId = claims(login.access_token).session_id;
    identityGuard.recordSession(sessionId);
    const state = sessionState(sessionId, created.id);
    if (state.user_session_rows !== 1 || state.session_rows !== 1 || state.active_refresh_tokens !== 1) {
      throw new Error("The temporary user did not establish exactly one live Auth session.");
    }
    return { uid: created.id, sid: sessionId, rt: login.refresh_token, at: login.access_token };
  };

  try {
    console.log(`DEF-6 verification on hosted staging project ${ref}; temporary cleanup identifier: ${run}`);
    requireCheck("the one-user/one-session creation guard is armed", identityGuard.userCount === 0 && identityGuard.sessionCount === 0);

    const trigger = sql(SESSION_END_TRIGGER_METADATA_QUERY);
    const triggerChecks = validateTriggerMetadata(trigger[0]);
    requireCheck(
      "session-ending trigger metadata matches the enabled deferred constraint trigger and function",
      trigger.length === 1 && Object.values(triggerChecks).every(Boolean),
      JSON.stringify(triggerChecks),
    );
    console.log("Trigger invocation itself is not independently instrumented; later session deletion is evidence of outcome, not proof of trigger execution.");
    const policies = sql("select policyname, qual from pg_policies where schemaname = 'public' and tablename = 'profiles'");
    requireCheck("both profile policies require a live session", policies.length === 2 && policies.every((policy) => /current_session_is_live/.test(policy.qual ?? "")));

    const initial = await createSession();
    const accessClaims = claims(initial.at);
    requireCheck("access tokens last 900 seconds", accessClaims.exp - accessClaims.iat === 900, `${accessClaims.exp - accessClaims.iat} s`);
    const profile = sql(`select role from public.profiles where id = '${initial.uid}'::uuid`);
    requireCheck("the temporary user has a customer profile", profile.length === 1 && profile[0].role === "customer");
    requireCheck("the single session is live and reads its own profile", await live(initial.at) === true && await profiles(initial.at) === 1);
    const initialState = sessionState(initial.sid, initial.uid);
    requireCheck(
      "exactly one Auth session and one active refresh-token row exist initially",
      initialState.user_session_rows === 1 && initialState.session_rows === 1 && initialState.active_refresh_tokens === 1,
      `sessions=${initialState.user_session_rows}; active rows=${initialState.active_refresh_tokens}`,
    );

    const originalFingerprint = tokenFingerprint(initial.rt);
    const firstRotation = await refresh(initial.rt);
    requireCheck("rotation one succeeds with a distinct refresh token", isSuccessfulDistinctRotation(firstRotation, [originalFingerprint], tokenFingerprint), `HTTP ${firstRotation.status}`);
    const afterFirst = sessionState(initial.sid, initial.uid);
    requireCheck("one active refresh-token row remains after rotation one", afterFirst.active_refresh_tokens === 1 && afterFirst.user_session_rows === 1, `active rows=${afterFirst.active_refresh_tokens}; sessions=${afterFirst.user_session_rows}`);

    const directRetry = await refresh(initial.rt);
    const firstFingerprint = tokenFingerprint(firstRotation.rt);
    const afterDirectRetry = sessionState(initial.sid, initial.uid);
    const directOutcome = classifyReplayResult({
      status: directRetry.status,
      returnedFingerprint: tokenFingerprint(directRetry.rt),
      currentFingerprint: firstFingerprint,
      activeTokenCount: afterDirectRetry.active_refresh_tokens,
    });
    requireCheck(
      "direct-parent retry returns the existing current token without a fork",
      directOutcome === "returned-current-token" && afterDirectRetry.user_session_rows === 1,
      `HTTP ${directRetry.status}; active rows=${afterDirectRetry.active_refresh_tokens}`,
    );

    const secondRotation = await refresh(firstRotation.rt);
    const secondRotationOk = isSuccessfulDistinctRotation(secondRotation, [originalFingerprint, firstFingerprint], tokenFingerprint);
    requireCheck("rotation two succeeds with a token distinct from both earlier tokens", secondRotationOk, `HTTP ${secondRotation.status}`);
    const afterSecond = sessionState(initial.sid, initial.uid);
    requireCheck("one active refresh-token row remains after rotation two", afterSecond.active_refresh_tokens === 1 && afterSecond.user_session_rows === 1, `active rows=${afterSecond.active_refresh_tokens}; sessions=${afterSecond.user_session_rows}`);

    const concurrentRetries = await Promise.all(Array.from({ length: 6 }, () => refresh(firstRotation.rt)));
    const afterConcurrentRetries = sessionState(initial.sid, initial.uid);
    const concurrency = summarizeConcurrentRefreshes({
      responses: concurrentRetries.map((response) => ({
        status: response.status,
        fingerprint: tokenFingerprint(response.rt),
      })),
      submittedFingerprint: firstFingerprint,
      activeTokenCount: afterConcurrentRetries.active_refresh_tokens,
      sessionCount: afterConcurrentRetries.user_session_rows,
    });
    requireCheck(
      "concurrent direct-parent retries succeed with one active token chain",
      concurrency.passed,
      `HTTP ${concurrentRetries.map((response) => response.status).join(",")}; ` +
      `distinct response tokens=${concurrency.distinctResponseFingerprints}; ` +
      `active rows=${concurrency.activeTokenCount}; sessions=${concurrency.sessionCount}`,
    );

    const currentFingerprint = tokenFingerprint(secondRotation.rt);
    const replay = await refresh(initial.rt);
    const returnedFingerprint = tokenFingerprint(replay.rt);
    const afterReplay = sessionState(initial.sid, initial.uid);
    const replayOutcome = classifyReplayResult({
      status: replay.status,
      returnedFingerprint,
      currentFingerprint,
      activeTokenCount: afterReplay.active_refresh_tokens,
    });
    const authSessionLive = await live(secondRotation.at);
    console.log(
      `Two-rotations-old replay: HTTP ${replay.status} ${replay.code ?? ""}; outcome=${replayOutcome}; `
      + `returned_current=${returnedFingerprint !== null && returnedFingerprint === currentFingerprint}; `
      + `returned_different_token=${returnedFingerprint !== null && returnedFingerprint !== currentFingerprint}; `
      + `active_refresh_token_rows=${afterReplay.active_refresh_tokens}; session_rows=${afterReplay.user_session_rows}; `
      + `database_session_live=${afterReplay.session_live}; Auth_RPC_live=${authSessionLive}`,
    );
    check("the two-rotations-old token is rejected", replay.status === 400, `HTTP ${replay.status} ${replay.code ?? ""}`);
    check(
      "replay does not create multiple active refresh-token rows or sessions",
      afterReplay.active_refresh_tokens <= 1 && afterReplay.user_session_rows <= 1,
      `active rows=${afterReplay.active_refresh_tokens}; sessions=${afterReplay.user_session_rows}; ${replayOutcome}`,
    );
    if (replay.status === 400) {
      check(
        "replay detection terminates the session and invalidates its prior access token",
        afterReplay.user_session_rows === 0 && afterReplay.active_refresh_tokens === 0 && authSessionLive === false && await getUser(secondRotation.at) === 403,
      );
      check("the terminated session cannot read its profile", await profiles(secondRotation.at) !== 1);
    }
    check("the run created exactly one temporary user and one Auth session", identityGuard.userCount === 1 && identityGuard.sessionCount === 1);
  } catch (error) {
    console.error(`DEF-6 verification stopped: ${safeFailureLabel(error)}.`);
    failed++;
  } finally {
    if (!await cleanupDef6(run, made)) failed++;
  }
  console.log(failed === 0 ? "\nDEF-6 hosted verification: all passed" : `\nDEF-6 hosted verification: ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
