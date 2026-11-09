// Customer sign-in: validation rules, safe redirects, session cookie settings, configuration, and source-code rules
// from CLAUDE.md (server-only auth, no browser client, no secret key, Supabase imported only from src/lib/supabase).
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { authErrorMessage, GENERIC_ERROR, STATUS_MESSAGES } from "../src/lib/auth/messages.ts";
import { DEFAULT_AFTER_SIGN_IN, safeNext } from "../src/lib/auth/redirects.ts";
import { passwordChecks, profileSchema, signInSchema, signUpSchema } from "../src/lib/auth/validation.ts";
import { accountIdentityCookieOptions, authCookieOptions, readSupabaseConfig } from "../src/lib/supabase/config.ts";
import {
  ACCOUNT_ID_COOKIE,
  bagStorageKey,
  favouritesStorageKey,
  isAccountId,
} from "../src/lib/account-storage.ts";
import {
  beginAccountIdentityChange,
  cancelAccountIdentityChange,
  handleAccountIdentityPageShow,
  isAccountIdentityTransitionPending,
  notifyAccountIdentityChanged,
} from "../src/lib/account-identity-client.ts";
import {
  ACCOUNT_IDENTITY_TRANSITION_TTL_MS,
  beginAccountIdentityTransition,
  endAccountIdentityTransition,
  hasPendingAccountIdentityTransitions,
  identityTransitionKey,
} from "../src/lib/account-storage.ts";

const good = { fullName: "Asha Rao", email: " Asha@Example.COM ", password: "Pearls2026x", confirmPassword: "Pearls2026x" };

test("sign-up accepts a valid form and normalises the email", () => {
  const r = signUpSchema.safeParse(good);
  assert.ok(r.success);
  assert.equal(r.data.email, "asha@example.com");
  assert.equal(r.data.fullName, "Asha Rao");
});

test("passwords need 10+ characters with lower case, upper case and a digit, and at most 72 bytes", () => {
  for (const pw of ["Short1a", "alllowercase1", "ALLUPPERCASE1", "NoDigitsHere", "a".repeat(9) + "A1"]) {
    assert.equal(signUpSchema.safeParse({ ...good, password: pw, confirmPassword: pw }).success, pw === "a".repeat(9) + "A1", pw);
  }
  assert.deepEqual(passwordChecks("abcDEF1234").map((c) => c.met), [true, true, true, true]);
  assert.deepEqual(passwordChecks("abc").map((c) => c.met), [false, true, false, false]);
});

test("mismatched confirmation, bad names and bad emails are refused with a field error", () => {
  const mismatch = signUpSchema.safeParse({ ...good, confirmPassword: "Pearls2026y" });
  assert.equal(mismatch.success, false);
  assert.deepEqual(mismatch.error.issues.map((i) => i.path[0]), ["confirmPassword"]);
  for (const fullName of ["A", "<script>", "Asha 2", " ", "x".repeat(101)]) assert.equal(signUpSchema.safeParse({ ...good, fullName }).success, false, fullName);
  for (const fullName of ["Anaïs D'Souza", "Mary-Jane O’Neil", "Ánh Lê", "Priya S."]) assert.equal(signUpSchema.safeParse({ ...good, fullName }).success, true, fullName);
  for (const email of ["", "asha", "asha@", "a@b"]) assert.equal(signInSchema.safeParse({ email, password: "x" }).success, false, email);
});

test("the optional mobile number accepts Indian mobiles in common formats, or blank", () => {
  const phone = (p) => profileSchema.safeParse({ fullName: "Asha Rao", phone: p });
  for (const [input, out] of [["9876543210", "9876543210"], ["+91 98765 43210", "9876543210"], ["098765-43210", "9876543210"], ["", ""]]) assert.equal(phone(input).data?.phone, out, input);
  for (const bad of ["12345", "5876543210", "98765432101", "abcdefghij"]) assert.equal(phone(bad).success, false, bad);
});

test("after sign-in, only the store's own customer pages are allowed: no open redirects, never admin", () => {
  for (const ok of ["/account", "/bag", "/checkout", "/favourites", "/account/orders?x=1"]) assert.equal(safeNext(ok), ok);
  for (const bad of [null, "", "https://evil.example", "//evil.example", "/\\evil.example", "/admin", "/admin/login", "/auth/login", "javascript:alert(1)", "/account\n", "/accountx", "/" + "a".repeat(250)]) {
    assert.equal(safeNext(bad), DEFAULT_AFTER_SIGN_IN, String(bad));
  }
});

test("session cookies are HttpOnly and SameSite=Lax, Secure on HTTPS, with no short lifetime", () => {
  const live = authCookieOptions("https://nevora.example");
  assert.deepEqual(live, { path: "/", sameSite: "lax", httpOnly: true, secure: true });
  assert.equal("maxAge" in live, false);
  assert.equal(authCookieOptions("http://localhost:3100").secure, false);
});

test("the account identity cookie is browser-readable but never a session credential", () => {
  assert.equal(ACCOUNT_ID_COOKIE, "nevora-account-id");
  assert.deepEqual(accountIdentityCookieOptions("https://nevora.example"), {
    path: "/", sameSite: "lax", httpOnly: false, secure: true,
  });
  assert.deepEqual(accountIdentityCookieOptions("https://nevora.example", true), {
    path: "/", sameSite: "lax", httpOnly: false, secure: true, maxAge: 0,
  });
  assert.equal(isAccountId("2f0f3d16-0ce6-4b54-9f8d-4c8a93ac42a1"), true);
  assert.equal(isAccountId("not-a-user-id"), false);
  assert.notEqual(bagStorageKey("2f0f3d16-0ce6-4b54-9f8d-4c8a93ac42a1"), bagStorageKey("d3d8b618-2268-49fc-bc1a-1e07f46f02b5"));
  assert.notEqual(favouritesStorageKey("2f0f3d16-0ce6-4b54-9f8d-4c8a93ac42a1"), favouritesStorageKey("d3d8b618-2268-49fc-bc1a-1e07f46f02b5"));
});

test("Supabase settings must all be present and be URLs, or auth reports itself unavailable", () => {
  const env = { SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x", SITE_URL: "http://localhost:3100/" };
  assert.deepEqual(readSupabaseConfig(env), { url: env.SUPABASE_URL, publishableKey: "sb_publishable_x", siteUrl: "http://localhost:3100" });
  for (const key of Object.keys(env)) assert.equal(readSupabaseConfig({ ...env, [key]: "" }), null, key);
  assert.equal(readSupabaseConfig({ ...env, SITE_URL: "localhost" }), null);
});

test("error messages never reveal whether an account exists", () => {
  assert.equal(authErrorMessage({ code: "user_already_exists" }), GENERIC_ERROR);
  assert.equal(authErrorMessage({ code: "user_not_found" }), GENERIC_ERROR);
  assert.match(authErrorMessage({ code: "invalid_credentials" }), /don't match/);
  assert.match(authErrorMessage({ status: 429 }), /Too many/);
});

test("V1 signup requires an immediate session and does not expose verification or recovery actions", () => {
  const actions = sources.find((s) => s.path === "app/auth/actions.ts").text;
  assert.match(actions, /supabase\.auth\.signUp\(/);
  assert.match(actions, /if \(!data\.session\) return \{ error: authErrorMessage\(null\), values \}/);
  assert.match(actions, /redirectAfterIdentityChange\("\/account", text\(form, "identityTransitionId"\)\)/);
  assert.doesNotMatch(actions, /resend|resetPasswordForEmail|updatePasswordAction|verifyOtp/);
  for (const path of ["app/auth/check-email/page.tsx", "app/auth/forgot-password/page.tsx", "app/auth/reset-password/page.tsx", "app/auth/confirm/route.ts"]) {
    assert.equal(sources.some((s) => s.path === path), false, `${path} is removed from V1`);
  }
  const forms = sources.find((s) => s.path === "components/auth/forms.tsx").text;
  assert.doesNotMatch(forms, /Forgot your password|Resend confirmation|confirm your email|verification/i);
});

test("sign-out failures are surfaced instead of reported as success", () => {
  const actions = sources.find((s) => s.path === "app/auth/actions.ts").text;
  const forms = sources.find((s) => s.path === "components/auth/forms.tsx").text;
  const signOutForm = sources.find((s) => s.path === "components/account/SignOutForm.tsx").text;
  const signOut = actions.slice(actions.indexOf("export async function signOutAction"));
  assert.match(signOut, /if \(!supabase\) return \{ error:/);
  assert.match(signOut, /const \{ error \} = await supabase\.auth\.signOut\(\{ scope: "local" \}\)/);
  assert.match(signOut, /if \(error\) return \{ error:/);
  assert.match(signOut, /redirectAfterIdentityChange\("\/auth\/login\?status=signed-out", transitionId\)/);
  assert.match(STATUS_MESSAGES["sign-out-warning"], /may still be active/);
  assert.match(forms, /statusKey === "sign-out-warning" \? "error" : "info"/);
  assert.match(signOutForm, /name="identityTransitionId"/);
  assert.match(signOutForm, /cancelAccountIdentityChange\(transitionId\.current\)/);
});

test("auth transitions use unique locks and clear only the matching transition", () => {
  const actions = sources.find((s) => s.path === "app/auth/actions.ts").text;
  const google = sources.find((s) => s.path === "app/auth/google/route.ts").text;
  const callback = sources.find((s) => s.path === "app/auth/callback/route.ts").text;
  const identity = sources.find((s) => s.path === "components/auth/AccountIdentitySync.tsx").text;
  const storage = sources.find((s) => s.path === "lib/account-storage.ts").text;
  const client = sources.find((s) => s.path === "lib/account-identity-client.ts").text;
  const forms = sources.find((s) => s.path === "components/auth/forms.tsx").text;
  assert.match(identity, /useSearchParams/);
  assert.match(identity, /\[pathname, search\]/);
  assert.match(actions, /setAccountIdentityCookie\(data\.user\.id\)/);
  assert.match(actions, /clearAccountIdentityCookie\(\)/);
  assert.match(callback, /setAccountIdentityCookie\(data\.user\.id\)/);
  assert.match(client, /const id = crypto\.randomUUID\(\)/);
  assert.match(client, /endTransition\(window\.localStorage, id\)/);
  assert.match(identity, /url\.searchParams\.set\(TRANSITION_PARAM, id\)/);
  assert.match(identity, /notifyAccountIdentityChanged\(id\)/);
  assert.match(forms, /name="identityTransitionId"/);
  assert.match(google, /callback\.searchParams\.set\("identity_transition", transitionId\)/);
  assert.match(callback, /destination\.searchParams\.set\("identity_transition", transitionId\)/);
  assert.doesNotMatch(identity, /completeCurrentTabAccountIdentityTransition/);
  assert.match(identity, /handleAccountIdentityPageShow\(event\)/);
  assert.doesNotMatch(callback, /url\.searchParams\.set\("identity_transition", transitionId\)/);
  assert.doesNotMatch(google, /url\.searchParams\.set\("identity_transition", transitionId\)/);
  assert.match(storage, /nevora-bag:\$\{STORAGE_VERSION\}:\$\{accountId \?\? "guest"\}/);
  assert.match(storage, /nevora-favourites:\$\{STORAGE_VERSION\}:\$\{accountId \?\? "guest"\}/);
});

test("duplicated-tab BFCache restoration never completes a copied transition", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
  };
  const originalWindow = globalThis.window;
  globalThis.window = {
    localStorage: storage,
    sessionStorage: { getItem: () => "copied-transition", removeItem: () => assert.fail("copied ID must not be used") },
    dispatchEvent: () => true,
  };
  try {
    const transitionA = beginAccountIdentityChange();
    const transitionB = beginAccountIdentityChange();

    handleAccountIdentityPageShow({ persisted: true });

    assert.equal(isAccountIdentityTransitionPending(), true);
    notifyAccountIdentityChanged(transitionA);
    assert.equal(values.has(`nevora-account-identity-transition:${transitionA}`), false);
    assert.equal(values.has(`nevora-account-identity-transition:${transitionB}`), true);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("failed authentication cancels only its own attempt and preserves other active transitions", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
  };
  const originalWindow = globalThis.window;
  globalThis.window = { localStorage: storage, dispatchEvent: () => true };
  try {
    const failedAttempt = beginAccountIdentityChange();
    const concurrentAttempt = beginAccountIdentityChange();

    cancelAccountIdentityChange(failedAttempt);

    assert.equal(values.has(`nevora-account-identity-transition:${failedAttempt}`), false);
    assert.equal(values.has(`nevora-account-identity-transition:${concurrentAttempt}`), true);
    assert.equal(isAccountIdentityTransitionPending(), true);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("failed and cancelled OAuth callbacks cannot cancel a transition using callback query data", () => {
  const callback = sources.find((s) => s.path === "app/auth/callback/route.ts").text;
  const google = sources.find((s) => s.path === "app/auth/google/route.ts").text;
  assert.match(callback, /if \(providerError\) return toLogin/);
  assert.match(callback, /if \(error \|\| !data\.user\?\.id\) return toLogin/);
  assert.match(callback, /const toLogin = \(error: string\) => \{\s*return NextResponse\.redirect/);
  assert.doesNotMatch(callback, /toLogin[\s\S]{0,180}identity_transition/);
  assert.match(google, /if \(error \|\| !data\.url\) return toLogin/);
  assert.doesNotMatch(google, /const toLogin = \(error: string\) => \{[\s\S]{0,160}identity_transition/);
});

test("an abandoned OAuth transition remains blocking until its TTL expires", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
  };
  const startedAt = 1_000_000;
  const transitionId = "8ac4ae91-938b-47bd-8da5-2d218aa6cb80";
  beginAccountIdentityTransition(storage, transitionId, startedAt);

  assert.equal(hasPendingAccountIdentityTransitions(storage, startedAt + ACCOUNT_IDENTITY_TRANSITION_TTL_MS - 1), true);
  assert.equal(hasPendingAccountIdentityTransitions(storage, startedAt + ACCOUNT_IDENTITY_TRANSITION_TTL_MS + 1), false);
  assert.equal(storage.getItem(identityTransitionKey(transitionId)), null);
});

test("overlapping OAuth attempts and a stale callback cannot clear another attempt", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
  };
  const originalWindow = globalThis.window;
  globalThis.window = { localStorage: storage, dispatchEvent: () => true };
  try {
    const attemptA = beginAccountIdentityChange();
    const attemptB = beginAccountIdentityChange();

    // A replayed failure URL has no transition ID, so it only announces navigation.
    handleAccountIdentityPageShow({ persisted: false });
    assert.equal(isAccountIdentityTransitionPending(), true);

    // Even an explicit completion for A is scoped to A; B remains active.
    notifyAccountIdentityChanged(attemptA);
    assert.equal(values.has(identityTransitionKey(attemptA)), false);
    assert.equal(values.has(identityTransitionKey(attemptB)), true);

    // A callback arriving after A is already finished cannot affect B.
    endAccountIdentityTransition(storage, attemptA);
    assert.equal(isAccountIdentityTransitionPending(), true);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("the account page reports a missing or unreadable profile instead of offering a broken edit form", () => {
  const account = sources.find((s) => s.path === "app/account/page.tsx").text;
  assert.match(account, /error: profileError/);
  assert.match(account, /profileError !== null \|\| profile === null/);
  assert.match(account, /Unable to load your profile details/);
  assert.match(account, /: <ProfileForm fullName=\{name\} phone=\{profile\.phone \?\? ""\} \/>/);
});

// Source rules
const src = join(import.meta.dirname, "..", "src");
const files = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : []; });
const sources = files(src).map((p) => ({ path: relative(src, p), text: readFileSync(p, "utf8") }));

test("Supabase packages are imported only from src/lib/supabase/", () => {
  const offenders = sources.filter((s) => /from "@supabase\//.test(s.text) && !s.path.startsWith("lib/supabase/"));
  assert.deepEqual(offenders.map((s) => s.path), []);
});

test("no browser Supabase client, no NEXT_PUBLIC_ Supabase settings, and no secret key in app code", () => {
  for (const s of sources) {
    assert.doesNotMatch(s.text, /createBrowserClient/, s.path);
    assert.doesNotMatch(s.text, /NEXT_PUBLIC_SUPABASE/, s.path);
    assert.doesNotMatch(s.text, /SERVICE_ROLE|SUPABASE_SECRET|sb_secret_/, s.path);
  }
  const server = sources.find((s) => s.path === "lib/supabase/server.ts");
  assert.match(server.text, /^import "server-only";/m);
});

test("DEF-6: no refresh-token reuse window, and 15-minute access tokens", () => {
  const config = readFileSync(join(import.meta.dirname, "..", "supabase", "config.toml"), "utf8");
  assert.match(config, /^enable_refresh_token_rotation = true$/m);
  assert.match(config, /^refresh_token_reuse_interval = 0$/m);
  assert.match(config, /^jwt_expiry = 900$/m);
  assert.match(config, /^enable_confirmations = false$/m);
  assert.match(config, /^\[auth\.external\.google\]\nenabled = true$/m);
  assert.doesNotMatch(config, /^\[auth\.email\.smtp\]/m);
});

test("DEF-6: every account page and action requires a live session, not just getUser()", () => {
  for (const path of ["app/account/page.tsx", "app/account/actions.ts"]) {
    const s = sources.find((x) => x.path === path);
    assert.match(s.text, /getLiveCustomer\(\)/, path);
    assert.doesNotMatch(s.text, /auth\.getUser\(\)/, `${path} should use getLiveCustomer()`);
  }
  const actions = sources.find((x) => x.path === "app/auth/actions.ts").text;
  assert.match(actions, /export async function signInAction/);
  assert.match(actions, /export async function signOutAction/);
  const session = sources.find((x) => x.path === "lib/supabase/session.ts").text;
  assert.match(session, /rpc\("current_session_is_live"\)/);
});

test("DEF-6: the migration ends dead sessions and the profile policies require a live one", () => {
  const sql = readFileSync(join(import.meta.dirname, "..", "supabase", "migrations", "20261108220000_session_liveness.sql"), "utf8");
  assert.match(sql, /create constraint trigger end_session_without_active_refresh_token\s+after update of revoked on auth\.refresh_tokens\s+deferrable initially deferred/);
  assert.match(sql, /using \(id = \(select auth\.uid\(\)\) and \(select public\.current_session_is_live\(\)\)\)/);
  assert.match(sql, /revoke all on function public\.current_session_is_live\(\) from public, anon;/);
});

test("the account page is always rendered per request, never pre-rendered", () => {
  const page = sources.find((s) => s.path === "app/account/page.tsx");
  assert.match(page.text, /^export const dynamic = "force-dynamic";/m);
});

test("proxy.ts runs only on /account, never on public pages", () => {
  const proxy = sources.find((s) => s.path === "proxy.ts");
  assert.match(proxy.text, /matcher: \["\/account", "\/account\/:path\*"\]/);
  assert.equal(sources.some((s) => s.path === "middleware.ts"), false);
});
