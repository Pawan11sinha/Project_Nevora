// Checks the access gate on a local Worker, against the mock Supabase. Fake values only.
// Lists every route from the build, so a new route can't be missed.
// Usage: GATE_TOKEN=... node gate-check.mjs <base-url> <mock-url> <app-dir> <closed|open>
import { readFileSync } from "node:fs";

const [baseArg, mock, appDir, mode] = process.argv.slice(2);
const base = baseArg.replace(/\/$/, "");
const token = process.env.GATE_TOKEN;
const HEADER = "x-test-gate-token";
let passed = 0, failed = 0;
const check = (name, pass, detail = "") => {
  if (pass) { passed++; return; }
  failed++;
  console.log(`FAIL  ${name}${detail ? `  (${detail})` : ""}`);
};

const manifest = JSON.parse(readFileSync(`${appDir}/.next/app-path-routes-manifest.json`, "utf8"));
const routes = [...new Set(Object.values(manifest))]
  .filter((r) => !r.includes("favicon"))
  .map((r) => r.replace("[slug]", "earrings").replace("[id]", "1"));
const extras = ["/no-such-page", "/_next/image?url=%2Fsample%2Fproduct-400.svg&w=256&q=75", "/_next/data/x/account.json", "/_not-found", "/cdn-cgi/_next_cache/x", "/admin/", "//admin", "/ADMIN", "/%61dmin", "/x/../admin", "/c/%E0%A4%A"];
const paths = [...new Set([...routes, ...extras])];
const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const cookie = "sb-mock-auth-token=forged";
const wrongTokens = {
  "no token": {},
  "empty token": { [HEADER]: "" },
  "wrong token": { [HEADER]: "b".repeat(48) },
  "token with one wrong character": token ? { [HEADER]: `${token.slice(0, -1)}${token.endsWith("x") ? "y" : "x"}` } : { [HEADER]: "x" },
  "shortened token": token ? { [HEADER]: token.slice(0, -1) } : { [HEADER]: "x" },
  "token in another header": token ? { "x-test-gate": token, authorization: `Bearer ${token}` } : { "x-test-gate": "x" },
  "token in a cookie": token ? { cookie: `${HEADER}=${token}` } : { cookie: "x=y" },
  "spoofed internal headers": { "x-middleware-subrequest": "src/proxy:src/proxy:src/proxy:src/proxy:src/proxy", "x-forwarded-host": "localhost", "x-invoke-path": "/", "x-opennext": "1" },
  "RSC request": { RSC: "1" },
  "server action request": { "next-action": "0".repeat(42), origin: base },
  "forged session": { cookie },
};

const rejected = async (path, method, headers, label) => {
  const response = await fetch(base + path, { method, headers, redirect: "manual" });
  const body = await response.text();
  check(`${method} ${path} with ${label}`, response.status === 404 && (method === "HEAD" || body === "Not Found") && !response.headers.get("x-opennext") && response.headers.getSetCookie().length === 0 && response.headers.get("cache-control") === "no-store", `status=${response.status}`);
};

await fetch(`${mock}/__mock/reset`);
let requests = 0;
for (const path of paths) {
  for (const method of methods) { await rejected(path, method, {}, "no token"); requests++; }
  for (const [label, headers] of Object.entries(wrongTokens)) { await rejected(path, "GET", headers, label); requests++; }
  await rejected(path, "POST", wrongTokens["wrong token"], "wrong token"); requests++;
}
const query = await fetch(`${base}/account?${HEADER}=${token ?? "x"}`, { redirect: "manual" });
await query.arrayBuffer();
check("token in the query string is rejected", query.status === 404);

const stats = await (await fetch(`${mock}/__mock/stats`)).json();
const calls = stats.user + stats.password + stats.refresh + stats.rpc;
check("rejected requests never reached the database or auth", calls === 0, JSON.stringify(stats));
console.log(`Routes from build: ${routes.length}. Paths tested: ${paths.length}. Rejection requests: ${requests + 1}. Database or auth calls during them: ${calls}.`);

if (mode === "closed") {
  // No token configured: even a plausible token must fail.
  await rejected("/api/health", "GET", { [HEADER]: "a".repeat(48) }, "any token while no token is configured");
  await rejected("/login", "GET", { [HEADER]: token ?? "a".repeat(48) }, "any token while no token is configured");
}

if (mode === "open") {
  const good = { [HEADER]: token };
  for (const [path, status] of [["/api/health", 200], ["/", 200], ["/login", 200], ["/account", 307], ["/admin", 307], ["/products-live", 200], ["/checkout-load", 200], ["/signup", 200]]) {
    const r = await fetch(base + path, { headers: good, redirect: "manual" });
    await r.arrayBuffer();
    check(`right token reaches ${path}`, r.status === status, `status=${r.status}`);
  }
  const names = (await (await fetch(`${base}/api/audit/headers`, { headers: good })).json()).names;
  check("the app never sees the token header", !names.includes(HEADER), names.join(","));
  const bad = await fetch(`${base}/c/%E0%A4%A`, { headers: good });
  await bad.arrayBuffer();
  check("malformed URLs still return 400 behind the gate", bad.status === 400, `status=${bad.status}`);

  const server = JSON.parse(readFileSync(`${appDir}/.next/server/server-reference-manifest.json`, "utf8"));
  const actionId = Object.entries(server.node).find(([, v]) => v.workers["app/checkout-load/page"])?.[0];
  const form = new FormData();
  form.set("0", '[{"message":""}]');
  const post = await fetch(`${base}/checkout-load`, { method: "POST", headers: { ...good, "next-action": actionId, origin: base, accept: "text/x-component" }, body: form });
  const text = await post.text();
  check("POST server action works through the gate", post.status === 200 && text.includes('"Purchased"'), `status=${post.status}`);
  const after = await (await fetch(`${mock}/__mock/stats`)).json();
  check("allowed requests do reach the database", after.rpc >= 1, JSON.stringify(after));
}
console.log(`${mode}: passed ${passed}, failed ${failed}`);
process.exit(failed ? 1 : 0);
