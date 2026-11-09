// V1 customer authentication in a real browser against a disposable LOCAL Supabase stack: signup with an immediate
// session, password validation, login, session cookies and persistence, refresh of an expired session, revoked
// sessions, sign-out, profile editing, RLS through the API, the role staying customer, Google's redirect (without
// going to Google) and its error handling, and no open redirects.
//
// Local only. The stack's secret key is used here, in the test, to make tokens and inspect rows; never in the app.
//   BASE_URL=http://localhost:8787 SUPABASE_URL=http://127.0.0.1:<port> SUPABASE_PUBLISHABLE_KEY=… \
//   SUPABASE_TEST_SECRET_KEY=… SUPABASE_TEST_WORKDIR=<stack folder> node scripts/check-auth.mjs
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";

const base = (process.env.BASE_URL ?? "http://localhost:8787").replace(/\/$/, "");
const api = process.env.SUPABASE_URL?.replace(/\/$/, "");
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_TEST_SECRET_KEY;
for (const [name, url] of [["BASE_URL", base], ["SUPABASE_URL", api]]) {
  if (!url || !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url)) throw new Error(`${name} must be a local http://127.0.0.1:<port> address; this check never runs against hosted services.`);
}
if (!publishable || !secret) throw new Error("SUPABASE_PUBLISHABLE_KEY and SUPABASE_TEST_SECRET_KEY are required.");
// The disposable local stack's working folder (supabase --workdir), for reading rows with SQL.
const workdir = process.env.SUPABASE_TEST_WORKDIR;
if (!workdir) throw new Error("SUPABASE_TEST_WORKDIR (the local stack's --workdir) is required.");

let failed = 0;
const check = (name, pass, detail = "") => { console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!pass) failed++; };
const errors = [];
const run = Date.now().toString(36);
const emailFor = (who) => `e2e-${run}-${who}@example.com`;
const PASSWORD = "Pearls2026x";

// --- helpers -------------------------------------------------------------------------------------------------------
const admin = (path, init = {}) => fetch(`${api}${path}`, { ...init, headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json", ...init.headers } });
// Profiles are read with SQL on the local stack: the secret key's role has no access to profiles (by design).
const queryLocal = (sql) => JSON.parse(execFileSync("npm", ["run", "-s", "supabase", "--", "--workdir", workdir, "db", "query", "--output-format", "json", sql], { cwd: new URL("..", import.meta.url).pathname, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
const profilesByEmail = async (email) => {
  if (!/^[a-z0-9.@-]+$/.test(email)) throw new Error("unexpected test email");
  return queryLocal(`select id, full_name, email, role, phone from public.profiles where email = '${email}'`).rows;
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
async function newPage(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  // Never actually go to Google.
  await context.route(/accounts\.google\.com/, (r) => r.abort());
  return { context, page };
}
const authCookies = async (context) => (await context.cookies()).filter((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token") && !c.name.endsWith("-code-verifier"));
const sessionFromCookies = async (context) => {
  const parts = (await authCookies(context)).filter((c) => !c.name.endsWith("-code-verifier")).sort((a, b) => a.name.localeCompare(b.name));
  const raw = parts.map((c) => c.value).join("");
  return JSON.parse(Buffer.from(raw.replace(/^base64-/, ""), "base64url").toString("utf8"));
};
async function signUp(page, { name, email, password = PASSWORD, confirm = password }) {
  await page.goto(`${base}/auth/signup`, { waitUntil: "networkidle" });
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(confirm);
  await page.getByRole("button", { name: "Create account" }).click();
}
async function signIn(page, email, password, next) {
  await page.goto(`${base}/auth/login${next ? `?next=${encodeURIComponent(next)}` : ""}`, { waitUntil: "networkidle" });
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
// The form's own alert, inside <main> (Next.js's route announcer is also role=alert).
const alertText = (page) => page.locator('main [role="alert"]').first().textContent({ timeout: 5000 }).catch(() => "");

async function cleanupTestUsers() {
  const prefix = `e2e-${run}-`;
  const list = await admin("/auth/v1/admin/users?page=1&per_page=1000");
  if (!list.ok) throw new Error(`Local Auth test cleanup could not list users (HTTP ${list.status}).`);
  const body = await list.json();
  const users = (body.users ?? []).filter((user) => user.email?.startsWith(prefix) && user.email.endsWith("@example.com"));
  if (users.length >= 1000 || users.some((user) => !/^[0-9a-f-]{36}$/i.test(user.id))) throw new Error("Local Auth test cleanup found an invalid or excessive user set.");

  const profiles = queryLocal(`delete from public.profiles where email like '${prefix}%' returning id`).rows ?? [];
  for (const user of users) {
    const response = await admin(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`, { method: "DELETE" });
    if (!response.ok) throw new Error(`Local Auth test cleanup could not delete a user (HTTP ${response.status}).`);
  }

  const idArray = `{${users.map((user) => user.id).join(",")}}`;
  const counts = queryLocal(`select (select count(*) from public.profiles where email like '${prefix}%')::int as profiles, (select count(*) from auth.sessions where user_id = any('${idArray}'::uuid[]))::int as sessions`).rows?.[0];
  const verify = await admin("/auth/v1/admin/users?page=1&per_page=1000");
  if (!verify.ok) throw new Error(`Local Auth test cleanup could not verify users (HTTP ${verify.status}).`);
  const remaining = (await verify.json()).users?.filter((user) => user.email?.startsWith(prefix) && user.email.endsWith("@example.com")).length ?? 0;
  if (remaining !== 0 || counts?.profiles !== 0 || counts?.sessions !== 0) throw new Error("Local Auth test cleanup verification failed.");
  console.log(`CLEANUP  removed ${profiles.length} local test profiles and ${users.length} Auth users; no matching sessions remain`);
}

try {
// --- 1. Signed out ------------------------------------------------------------------------------------------------
{
  const { context, page } = await newPage();
  await page.goto(`${base}/account`);
  check("signed-out visitors to /account are sent to sign in, and come back after", new URL(page.url()).pathname === "/auth/login" && new URL(page.url()).searchParams.get("next") === "/account");
  const head = await fetch(`${base}/auth/login`);
  check("sign-in pages are never cached", head.headers.get("cache-control") === "no-store", head.headers.get("cache-control"));
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  check("the header links to the account page", (await page.getByRole("link", { name: "Your account" }).getAttribute("href")) === "/account");
  await context.close();
}

// --- 2. Sign-up validation -------------------------------------------------------------------------------------------
{
  const { context, page } = await newPage();
  await page.goto(`${base}/auth/signup`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(800);
  check("an empty sign-up shows an error for each field", (await page.getByText("Enter your full name.").count()) === 1 && (await page.getByText("Enter your email address.").count()) === 1);
  const pw = page.getByLabel("Password", { exact: true });
  await pw.fill("abc");
  const rules = page.getByRole("list", { name: "Password requirements" });
  check("the password checklist updates as you type", (await rules.getByText(/, done/).count()) === 1 && (await rules.getByText(/, not yet/).count()) === 3);
  await page.getByRole("button", { name: "Show password" }).first().click();
  check("the visibility toggle shows the password", (await pw.getAttribute("type")) === "text" && (await page.getByRole("button", { name: "Hide password" }).first().getAttribute("aria-pressed")) === "true");
  await signUp(page, { name: "Asha Rao", email: emailFor("weak"), password: "weakpassword" });
  await page.waitForTimeout(800);
  check("a weak password is refused on the server", (await page.getByText(/at least 10 characters, with an upper-case letter/).count()) >= 1 && new URL(page.url()).pathname === "/auth/signup");
  await signUp(page, { name: "Asha Rao", email: emailFor("mismatch"), confirm: "Pearls2026z" });
  await page.waitForTimeout(800);
  check("mismatched passwords are refused", (await page.getByText("The passwords don't match.").count()) === 1);
  check("the name and email are kept after an error, the password isn't", (await page.getByLabel("Full name").inputValue()) === "Asha Rao" && (await page.getByLabel("Password", { exact: true }).inputValue()) === "");
  await context.close();
}

// --- 3. Sign-up creates a live session and profile immediately --------------------------------------------------------
const asha = emailFor("asha");
let ashaCookies;
{
  const { context, page } = await newPage();
  await signUp(page, { name: "Asha Rao", email: asha });
  await page.waitForURL("**/account**");
  check("sign-up immediately creates an authenticated account", new URL(page.url()).pathname === "/account");
  check("the new account has a live Auth session", (await authCookies(context)).length > 0 && (await page.locator("h1").textContent()) === "Hello, Asha");
  const profile = await profilesByEmail(asha);
  check("the profile is created at sign-up, as a customer, with the name", profile.length === 1 && profile[0].role === "customer" && profile[0].full_name === "Asha Rao");
  check("the account page shows the profile", (await page.locator("h1").textContent()) === "Hello, Asha" && (await page.getByText(asha).count()) === 1 && (await page.getByText("Member since").count()) === 1);

  const cookies = await authCookies(context);
  check("session cookies are HttpOnly and SameSite=Lax", cookies.length > 0 && cookies.every((c) => c.httpOnly && c.sameSite === "Lax"), JSON.stringify(cookies.map((c) => [c.name.replace(/sb-[^-]+-/, "sb-…-"), c.httpOnly, c.sameSite])));
  check("session cookies are long-lived, not session-only", cookies.every((c) => c.expires === -1 ? false : c.expires * 1000 - Date.now() > 300 * 86400 * 1000));
  check("page scripts can't read the session", !(await page.evaluate(() => document.cookie)).includes("auth-token"));
  const res = await page.request.get(`${base}/account`);
  check("the account page is never cached", res.headers()["cache-control"] === "no-store", res.headers()["cache-control"]);
  ashaCookies = await context.storageState();

  // Profile editing
  await page.getByLabel("Mobile number (optional)").fill("12345");
  await page.getByRole("button", { name: "Save details" }).click();
  await page.waitForTimeout(800);
  check("an invalid mobile number is refused", (await page.getByText(/10-digit Indian mobile number, or leave it blank/).count()) === 1);
  await page.getByLabel("Full name").fill("Asha R. Rao");
  await page.getByLabel("Mobile number (optional)").fill("+91 98765 43210");
  await page.getByRole("button", { name: "Save details" }).click();
  const confirmed = await page.getByText("Your details are saved.").waitFor({ timeout: 5000 }).then(() => true, () => false);
  const saved = (await profilesByEmail(asha))[0];
  check("the customer updates their name and mobile number", confirmed && saved.full_name === "Asha R. Rao" && saved.phone === "9876543210");
  await context.close();
}

// --- 4. Session persistence, refresh of an expired session -----------------------------------------------------------
{
  const { context, page } = await newPage({ storageState: ashaCookies });
  await page.goto(`${base}/account`);
  check("the session is remembered in a new window", new URL(page.url()).pathname === "/account");
  // Make the stored access token look expired, so the proxy has to refresh it with the refresh token.
  const session = await sessionFromCookies(context);
  const tampered = { ...session, expires_at: Math.floor(Date.now() / 1000) - 60 };
  const name = (await authCookies(context)).find((c) => !c.name.endsWith("-code-verifier")).name.replace(/\.\d+$/, "");
  await context.clearCookies();
  await context.addCookies([{ name, value: `base64-${Buffer.from(JSON.stringify(tampered)).toString("base64url")}`, url: base, httpOnly: true, sameSite: "Lax" }]);
  await page.goto(`${base}/account`);
  const refreshed = await sessionFromCookies(context).catch(() => null);
  check("an expired access token is refreshed, and the customer stays signed in", new URL(page.url()).pathname === "/account" && refreshed && refreshed.refresh_token !== session.refresh_token && refreshed.expires_at > tampered.expires_at);

  // Revoked everywhere (as after "sign out of all devices"): the next request is refused.
  await fetch(`${api}/auth/v1/logout?scope=global`, { method: "POST", headers: { apikey: publishable, Authorization: `Bearer ${refreshed.access_token}` } });
  await page.goto(`${base}/account`);
  check("a revoked session is refused and the customer is asked to sign in", new URL(page.url()).pathname === "/auth/login", page.url());
  await context.close();
}

// --- 5. Sign-in, wrong password, safe redirects, sign-out ------------------------------------------------------------
{
  const { context, page } = await newPage();
  await signIn(page, asha, "Wrong-password-1");
  await page.waitForTimeout(800);
  check("a wrong password gets a neutral message", /don't match/.test(await alertText(page)));
  await signIn(page, emailFor("nobody"), "Whatever-123x");
  await page.waitForTimeout(800);
  check("an unknown email gets the same message (no account discovery)", /don't match/.test(await alertText(page)));
  await signIn(page, asha, PASSWORD, "https://evil.example/steal");
  await page.waitForURL("**/account**");
  check("an off-site ?next= is ignored", new URL(page.url()).origin === base && new URL(page.url()).pathname === "/account");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/auth/login**");
  check("sign-out clears the session", (await authCookies(context)).length === 0 && (await page.getByText("You've signed out.").count()) === 1);
  await page.goto(`${base}/account`);
  check("after sign-out, /account asks to sign in again", new URL(page.url()).pathname === "/auth/login");
  await signIn(page, asha, PASSWORD, "/bag");
  await page.waitForURL("**/bag**");
  check("?next= returns the customer to the store page they came from", new URL(page.url()).pathname === "/bag");
  await context.close();
}

// --- 6. Duplicate sign-up fails without creating a session or duplicate profile --------------------------------------
{
  const { context, page } = await newPage();
  await signUp(page, { name: "Someone Else", email: asha });
  await page.waitForTimeout(800);
  check("an existing email does not appear to sign in successfully", new URL(page.url()).pathname === "/auth/signup" && (await authCookies(context)).length === 0 && /Something went wrong/.test(await alertText(page)));
  const rows = await profilesByEmail(asha);
  check("... and never creates a second profile or changes the first", rows.length === 1 && rows[0].full_name === "Asha R. Rao");
  await context.close();
}

// --- 7. Former email verification and password recovery routes are absent from V1 ----------------------------------
{
  const { context, page } = await newPage();
  await page.goto(`${base}/auth/login`, { waitUntil: "networkidle" });
  check("V1 login has no email verification or password recovery links", (await page.getByRole("link", { name: /Forgot your password|confirmation/i }).count()) === 0);
  for (const path of ["/auth/check-email", "/auth/confirm", "/auth/forgot-password", "/auth/reset-password"]) {
    const response = await page.request.get(`${base}${path}`);
    check(`V1 route ${path} is removed`, response.status() === 404, `HTTP ${response.status()}`);
  }
  await page.goto(`${base}/auth/signup`, { waitUntil: "networkidle" });
  check("V1 signup has no confirmation-email message", (await page.getByText(/confirm your email|confirmation email|verification email|we.ll send a link/i).count()) === 0);
  await context.close();
}

// --- 8. RLS and roles through the API, as a customer ------------------------------------------------------------------
{
  const signInApi = async (email, password) => (await (await fetch(`${api}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: publishable, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) })).json()).access_token;
  const token = await signInApi(asha, PASSWORD);
  const meera = emailFor("meera");
  const otherCustomer = await newPage();
  await signUp(otherCustomer.page, { name: "Meera Iyer", email: meera });
  await otherCustomer.page.waitForURL("**/account**");
  await otherCustomer.context.close();
  check("a second email/password customer also signs up immediately", (await profilesByEmail(meera))[0]?.full_name === "Meera Iyer");
  const rest = (path, init = {}) => fetch(`${api}/rest/v1${path}`, { ...init, headers: { apikey: publishable, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation", ...init.headers } });
  const mine = await (await rest("/profiles?select=email,role")).json();
  check("through the API, a customer reads only their own profile", Array.isArray(mine) && mine.length === 1 && mine[0].email === asha);
  const role = await rest(`/profiles?email=eq.${encodeURIComponent(asha)}`, { method: "PATCH", body: JSON.stringify({ role: "admin" }) });
  check("a customer can't make themselves an admin", role.status === 401 || role.status === 403, String(role.status));
  const other = await rest(`/profiles?email=eq.${encodeURIComponent(meera)}`, { method: "PATCH", body: JSON.stringify({ full_name: "Changed" }) });
  check("a customer can't change another customer's profile", JSON.stringify(await other.json()) === "[]" && (await profilesByEmail(meera))[0].full_name === "Meera Iyer");
  const anon = await fetch(`${api}/rest/v1/profiles?select=*`, { headers: { apikey: publishable } });
  check("signed-out API requests can't read profiles", anon.status === 401 || anon.status === 403 || JSON.stringify(await anon.json()) === "[]", String(anon.status));

  // Sign-up metadata can't set the role.
  const sneaky = emailFor("sneaky");
  await fetch(`${api}/auth/v1/signup`, { method: "POST", headers: { apikey: publishable, "Content-Type": "application/json" }, body: JSON.stringify({ email: sneaky, password: PASSWORD, data: { full_name: "Sneaky", role: "admin" } }) });
  check("sign-up metadata asking for admin still makes a customer", (await profilesByEmail(sneaky))[0]?.role === "customer");
  const adminPage = await fetch(`${base}/admin`, { redirect: "manual" });
  check("there's no admin area reachable through customer sign-in", adminPage.status === 404, String(adminPage.status));
}

// --- 10. Google -----------------------------------------------------------------------------------------------------
{
  const { context, page } = await newPage();
  await page.goto(`${base}/auth/login?next=/favourites`, { waitUntil: "networkidle" });
  const google = page.getByRole("link", { name: "Continue with Google" });
  check("sign-in offers Continue with Google", (await google.getAttribute("href")) === "/auth/google");
  const start = await page.request.get(`${base}/auth/google?next=/favourites`, { maxRedirects: 0 });
  const toSupabase = new URL(start.headers().location);
  check("Google sign-in starts on the server with PKCE", toSupabase.origin === api && toSupabase.pathname === "/auth/v1/authorize" && toSupabase.searchParams.get("provider") === "google" && toSupabase.searchParams.get("code_challenge_method") === "s256");
  check("... returning to the store's own callback, keeping ?next=", toSupabase.searchParams.get("redirect_to") === `${base}/auth/callback?next=%2Ffavourites`);
  const verifier = (await context.cookies()).find((c) => c.name.endsWith("-code-verifier"));
  check("... with the PKCE verifier in an HttpOnly cookie", !!verifier && verifier.httpOnly);
  const toGoogle = await fetch(toSupabase, { redirect: "manual" });
  const g = new URL(toGoogle.headers.get("location"));
  check("Supabase sends the browser to Google with the configured client ID and no secret", g.hostname === "accounts.google.com" && g.searchParams.get("client_id") === "local-test-client.apps.googleusercontent.com" && !/not-a-secret/.test(g.href));
  await page.goto(`${base}/auth/callback?error=access_denied&error_description=cancelled`);
  check("cancelling at Google returns to sign-in with a clear message", /cancelled/.test(await alertText(page)));
  await page.goto(`${base}/auth/callback?code=not-a-real-code`);
  check("a bad or replayed Google code is refused", /didn.t complete/.test(await alertText(page)));
  await context.close();
}

// --- 10. DEF-6: refresh-token reuse, concurrency, retries, revocation -----------------------------------------------
{
  const testUser = async (who) => {
    const email = emailFor(who);
    await admin("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: "Def Six" } }) });
    return email;
  };
  const signedIn = async (who) => { const email = await testUser(who); const s = await newPage(); await signIn(s.page, email, PASSWORD); await s.page.waitForURL("**/account**"); return { ...s, email }; };
  const cookieName = async (context) => (await authCookies(context)).find((c) => !c.name.includes("code-verifier")).name.replace(/\.\d+$/, "");
  // The session cookie's name is the same for every customer of this project (sb-<project ref>-auth-token).
  let sessionCookie;
  const setSession = async (context, session) => {
    sessionCookie ??= await cookieName(context);
    const name = sessionCookie;
    await context.clearCookies();
    await context.addCookies([{ name, value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`, url: base, httpOnly: true, sameSite: "Lax" }]);
  };
  const expired = (s) => ({ ...s, expires_at: Math.floor(Date.now() / 1000) - 60 });
  const apiRefresh = async (rt) => { const r = await fetch(`${api}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: { apikey: publishable, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: rt }) }); const b = await r.json(); return { status: r.status, code: b.error_code, session: b }; };
  const authUser = async (at) => (await fetch(`${api}/auth/v1/user`, { headers: { apikey: publishable, Authorization: `Bearer ${at}` } })).status;
  const restProfiles = async (at) => { const r = await fetch(`${api}/rest/v1/profiles?select=id`, { headers: { apikey: publishable, Authorization: `Bearer ${at}` } }); return r.status === 200 ? (await r.json()).length : `HTTP ${r.status}`; };
  const accountStatus = async (page) => (await page.request.get(`${base}/account`, { maxRedirects: 0 })).status();

  // Access tokens last 15 minutes.
  {
    const v = await signedIn("lifetime");
    const s = await sessionFromCookies(v.context);
    const c = JSON.parse(Buffer.from(s.access_token.split(".")[1], "base64url").toString());
    check("DEF-6: access tokens last 15 minutes", c.exp - c.iat === 900, `${c.exp - c.iat} s`);
    await v.context.close();
  }

  // R1. A thief copies the session and refreshes it twice; the customer's next refresh (with the older token) is
  //     detected as reuse. The customer is signed out, and none of the thief's tokens work anywhere.
  {
    const v = await signedIn("theft1");
    const stolen = await sessionFromCookies(v.context);
    const t1 = await apiRefresh(stolen.refresh_token);
    const t2 = await apiRefresh(t1.session.refresh_token);
    check("R1: the thief can refresh a copied session (before anyone notices)", t1.status === 200 && t2.status === 200);
    await setSession(v.context, expired(stolen));
    await v.page.goto(`${base}/account`);
    check("R1: the customer's next refresh detects the reuse and asks them to sign in again", new URL(v.page.url()).pathname === "/auth/login" && /session has ended/.test(await alertText(v.page)));
    check("R1: the customer's dead session cookies are cleared", (await authCookies(v.context)).filter((c) => !c.name.includes("code-verifier")).length === 0);
    const revive = await apiRefresh(t2.session.refresh_token);
    check("R1: the thief's newest refresh token is refused (no revival window)", revive.status === 400, `${revive.status} ${revive.code}`);
    check("R1: the thief's unexpired access token is refused by Supabase Auth", (await authUser(t2.session.access_token)) === 403);
    check("R1: ... and reads no customer data through the API", (await restProfiles(t2.session.access_token)) === 0);
    const x = await newPage();
    await setSession(x.context, t2.session);
    await x.page.goto(`${base}/account`);
    check("R1: ... and gets nothing from the store's account page", new URL(x.page.url()).pathname === "/auth/login");
    await x.context.close();
    await v.context.close();
  }

  // R2. The customer refreshes normally; a thief then uses an old copied token. The reuse ends the session at once, so
  //     the customer's still-unexpired access token is refused by the app on the next page, and its cookies cleared.
  {
    const v = await signedIn("theft2");
    const stolen = await sessionFromCookies(v.context);
    await setSession(v.context, expired(stolen));
    await v.page.goto(`${base}/account`);
    const s1 = await sessionFromCookies(v.context);
    await setSession(v.context, expired(s1));
    await v.page.goto(`${base}/account`);
    const s2 = await sessionFromCookies(v.context);
    check("R2: normal refreshes keep the customer signed in", new URL(v.page.url()).pathname === "/account" && s2.refresh_token !== s1.refresh_token);
    const thief = await apiRefresh(stolen.refresh_token);
    check("R2: the thief's old token is detected as reuse", thief.status === 400 && thief.code === "refresh_token_already_used", `${thief.status} ${thief.code}`);
    check("R2: the customer's access token, issued before detection, is refused by Supabase Auth", (await authUser(s2.access_token)) === 403);
    await v.page.goto(`${base}/account`);
    check("R2: the app refuses it on the next page and asks the customer to sign in again", new URL(v.page.url()).pathname === "/auth/login" && /session has ended/.test(await alertText(v.page)));
    check("R2: and clears the dead session's cookies", (await authCookies(v.context)).filter((c) => !c.name.includes("code-verifier")).length === 0);
    await v.context.close();
  }

  // R3. Concurrency: six requests at once, all needing a refresh with the same cookie, and three tabs opening at once.
  {
    const v = await signedIn("concurrent");
    const s0 = await sessionFromCookies(v.context);
    await setSession(v.context, expired(s0));
    const statuses = await Promise.all(Array.from({ length: 6 }, () => accountStatus(v.page)));
    check("R3: six simultaneous requests that each refresh the same session all succeed", statuses.every((s) => s === 200), statuses.join(" "));
    check("R3: the session is still live afterwards", (await accountStatus(v.page)) === 200);
    const s1 = await sessionFromCookies(v.context);
    await setSession(v.context, expired(s1));
    const tabs = await Promise.all([1, 2, 3].map(() => v.context.newPage()));
    await Promise.all(tabs.map((t) => t.goto(`${base}/account`)));
    check("R3: three tabs opening at once with an expired token all stay signed in", tabs.every((t) => new URL(t.url()).pathname === "/account"), tabs.map((t) => new URL(t.url()).pathname).join(" "));
    check("R3: ... and the session is still live", (await accountStatus(v.page)) === 200);
    await v.context.close();
  }

  // R4. Retries: a refreshed cookie that never reached the browser (it retries with the previous token) still works;
  //     replaying a cookie two rotations old is treated as theft and ends the session.
  {
    const v = await signedIn("retry");
    const s0 = await sessionFromCookies(v.context);
    await setSession(v.context, expired(s0));
    check("R4: first refresh", (await accountStatus(v.page)) === 200);
    await setSession(v.context, expired(s0));
    check("R4: a retry with the previous token (response lost) still works", (await accountStatus(v.page)) === 200);
    const s1 = await sessionFromCookies(v.context);
    await setSession(v.context, expired(s1));
    await accountStatus(v.page);
    await setSession(v.context, expired(s0));
    await v.page.goto(`${base}/account`);
    check("R4: replaying a token two rotations old ends the session (fails closed)", new URL(v.page.url()).pathname === "/auth/login");
    await v.context.close();
  }

  // R5. Sign-out: the old access token is refused everywhere, immediately.
  {
    const v = await signedIn("signout");
    const s = await sessionFromCookies(v.context);
    await v.page.getByRole("button", { name: "Sign out" }).click();
    await v.page.waitForURL("**/auth/login**");
    check("R5: after sign-out, the old access token is refused by Supabase Auth and reads no data", (await authUser(s.access_token)) === 403 && (await restProfiles(s.access_token)) === 0);
    await v.context.close();
  }

  // The session-ended page never signs out a live session, so a link to it can't be used to sign someone out.
  {
    const v = await signedIn("ended-link");
    await v.page.goto(`${base}/auth/session-ended`);
    check("a live session visiting /auth/session-ended stays signed in", new URL(v.page.url()).pathname === "/account" && (await accountStatus(v.page)) === 200);
    await v.context.close();
  }
}

// --- 11. Phone layout -----------------------------------------------------------------------------------------------
{
  const { context, page } = await newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  for (const path of ["/auth/login", "/auth/signup"]) {
    await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
    check(`phone: ${path} has no sideways scrolling`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  }
  await context.close();
}

check("no page errors or console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(`\n${failed === 0 ? "All passed" : `${failed} failed`}`);
process.exitCode = failed ? 1 : 0;
} finally {
  try {
    await browser.close();
  } finally {
    await cleanupTestUsers();
  }
}
