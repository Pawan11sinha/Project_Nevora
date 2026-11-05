// Checks whether GET /auth/v1/user is rate-limited. One login first, to get a token, then 35 reads,
// one per second. Stops at the first 429 or any other non-200, with no retries, and makes no writes.
// Prints statuses and timings only, never tokens, keys or passwords.
// Usage: node tools/auth-read-check.mjs <expected-project-ref>
import { readFileSync } from "node:fs";

const REQUESTS = 35;
const INTERVAL_MS = 1000;
const expectedRef = process.argv[2];
const readEnv = (relative) =>
  Object.fromEntries(
    readFileSync(new URL(relative, import.meta.url), "utf8")
      .split("\n")
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()]),
  );
const env = { ...readEnv("../.env.test"), ...readEnv("../opennext/.dev.vars") };
const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key, TEST_PASSWORD: password } = env;
if (!expectedRef || new URL(url).hostname !== `${expectedRef}.supabase.co`) throw new Error("Project ref doesn't match");
if (!key?.startsWith("sb_publishable_")) throw new Error("Use the publishable key only");
if (!password) throw new Error("TEST_PASSWORD is blank");

const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: key, "content-type": "application/json" },
  body: JSON.stringify({ email: "nevora-test-customer-a@example.com", password }),
});
const session = await login.json().catch(() => ({}));
console.log(`Login before the test: status ${login.status}`);
if (login.status !== 200 || !session.access_token) {
  console.log("Stopping: no session, so no read requests were sent.");
  process.exit(1);
}

const statuses = [];
const started = performance.now();
let stopReason = null;
for (let i = 1; i <= REQUESTS; i++) {
  const sent = performance.now();
  let status = 0;
  let detail = "";
  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, authorization: `Bearer ${session.access_token}` },
      signal: AbortSignal.timeout(30_000),
    });
    status = response.status;
    const body = await response.json().catch(() => null);
    detail = response.status === 200 ? "" : ` ${body?.error_code ?? body?.code ?? ""}`;
  } catch (error) {
    detail = ` ${[error.name, error.cause?.code].filter(Boolean).join(" ")}`;
  }
  const ms = Math.round(performance.now() - sent);
  statuses.push(status);
  console.log(`Request ${String(i).padStart(2)}: status ${status}${detail}, ${ms} ms, at ${((performance.now() - started) / 1000).toFixed(1)} s`);
  if (status !== 200) {
    stopReason = status === 429 ? "429 received" : `non-200 result (${status})`;
    break;
  }
  if (i < REQUESTS) await new Promise((resolve) => setTimeout(resolve, Math.max(0, INTERVAL_MS - (performance.now() - sent))));
}
const counts = statuses.reduce((all, s) => ((all[s] = (all[s] ?? 0) + 1), all), {});
console.log(`\nSent ${statuses.length} of ${REQUESTS}. Statuses: ${JSON.stringify(counts)}. Duration: ${((performance.now() - started) / 1000).toFixed(1)} s.`);
console.log(stopReason ? `Stopped: ${stopReason}. No retries.` : "All requests completed. No retries.");
process.exit(stopReason ? 1 : 0);
