// Tests real signup and email verification only. It never touches the dashboard test users, and
// calls no admin or purchase function. It prints no email addresses, passwords, keys or tokens.
// Usage: node tools/email-signup-test.mjs <phase1|phase2> <expected-project-ref>
import { readFileSync } from "node:fs";

const [phase, expectedRef] = process.argv.slice(2);
if (!["phase1", "phase2"].includes(phase) || !expectedRef) {
  throw new Error("Usage: email-signup-test.mjs <phase1|phase2> <expected-project-ref>");
}

const readEnv = (relative) =>
  Object.fromEntries(
    readFileSync(new URL(relative, import.meta.url), "utf8")
      .split("\n")
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()]),
  );
const env = { ...readEnv("../.env.test"), ...readEnv("../opennext/.dev.vars") };
const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key, TEST_SIGNUP_EMAIL: email, TEST_SIGNUP_PASSWORD: password } = env;

// Guards, all before any network request.
if (!url || !key || !email || !password) throw new Error("A required value is blank");
if (new URL(url).hostname !== `${expectedRef}.supabase.co`) throw new Error("Project ref doesn't match");
if (!key.startsWith("sb_publishable_")) throw new Error("Use the publishable key only");
if (/@example\.com$|^nevora-test-/i.test(email)) throw new Error("Signup address must not be a test address");
if (password === env.TEST_PASSWORD) throw new Error("Signup password must differ from the test users' password");

let failed = 0;
const check = (name, pass, detail = "") => {
  if (!pass) failed++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const call = async (path, { token, method = "GET", body } = {}) => {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: { apikey: key, "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: response.status, json };
};
const logIn = () => call("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
const errorCode = (result) => result.json?.error_code ?? result.json?.code ?? "";

const settings = await call("/auth/v1/settings");
check("Confirm email is on", settings.json?.mailer_autoconfirm === false, `autoconfirm=${settings.json?.mailer_autoconfirm}`);
if (settings.json?.mailer_autoconfirm !== false) {
  console.log("\nStopping: Confirm email isn't on, and this test must not run without it.");
  process.exit(1);
}

if (phase === "phase1") {
  const existing = await logIn();
  if (existing.status === 200) {
    console.log("NOTE  This account already exists and is confirmed. No signup sent. Run phase2.");
    process.exit(0);
  }
  if (errorCode(existing) === "email_not_confirmed") {
    console.log("NOTE  This account already exists and isn't confirmed. No signup or email sent.");
    check("unverified account can't log in", true, errorCode(existing));
    process.exit(failed ? 1 : 0);
  }

  const signup = await call("/auth/v1/signup", { method: "POST", body: { email, password, data: { role: "admin" } } });
  check("signup accepted", signup.status === 200, `status=${signup.status} ${errorCode(signup)}`);
  if (signup.status !== 200) {
    console.log("\nStopping: signup wasn't accepted, so no email is expected.");
    process.exit(1);
  }
  check("no session before verification", !signup.json?.access_token);
  check("confirmation email recorded as sent", Boolean(signup.json?.confirmation_sent_at));

  const blocked = await logIn();
  check("login blocked before verification", blocked.status !== 200 && errorCode(blocked) === "email_not_confirmed", `status=${blocked.status} ${errorCode(blocked)}`);
  console.log(failed ? `\n${failed} check(s) failed` : "\nPhase 1 passed. Waiting for the email link to be clicked.");
  process.exit(failed ? 1 : 0);
}

const login = await logIn();
check("login works after verification", login.status === 200 && Boolean(login.json?.access_token), `status=${login.status} ${errorCode(login)}`);
if (login.status !== 200) {
  console.log("\nStopping: the account can't log in yet.");
  process.exit(1);
}
const token = login.json.access_token;
const user = login.json.user;
check("email is recorded as confirmed", Boolean(user?.email_confirmed_at));
check("the admin request reached signup", user?.user_metadata?.role === "admin", `metadata role=${user?.user_metadata?.role}`);
const profile = await call(`/rest/v1/deploy_test_profiles?id=eq.${user.id}&select=role`, { token });
check("role in the database stays customer", profile.json?.[0]?.role === "customer", `role=${profile.json?.[0]?.role}`);
const isAdmin = await call("/rest/v1/rpc/deploy_test_is_admin", { token, method: "POST", body: {} });
check("database admin check returns false", isAdmin.json === false, `result=${JSON.stringify(isAdmin.json)}`);
console.log(failed ? `\n${failed} check(s) failed` : "\nPhase 2 passed.");
process.exit(failed ? 1 : 0);
