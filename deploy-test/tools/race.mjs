// Sends competing requests for the last unit of a test item. Exactly one should win.
// Run deploy-test/supabase-test.sql first, which sets the test stock to 1.
// Usage: DEPLOY_TEST_TOKEN=... node race.mjs <base-url> [requests]
const base = (process.argv[2] ?? "http://localhost:8787").replace(/\/$/, "");
const count = Number(process.argv[3] ?? 20);
const token = process.env.DEPLOY_TEST_TOKEN;
if (!token) throw new Error("Set DEPLOY_TEST_TOKEN");

const results = await Promise.all(
  Array.from({ length: count }, async () => {
    const res = await fetch(`${base}/api/db-test`, {
      method: "POST",
      headers: { "x-test-token": token },
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  }),
);
const wins = results.filter((r) => r.body.taken === true).length;
const losses = results.filter((r) => r.body.taken === false).length;
const errors = results.filter((r) => r.status !== 200);
console.log({ wins, losses, errors: errors.length, sample: errors[0] });
const pass = wins === 1 && losses === count - 1;
console.log(pass ? "PASS: exactly one request won" : "FAIL: expected exactly one winner");
process.exit(pass ? 0 : 1);
