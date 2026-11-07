// Sends a fixed number of requests to each route and records every status code, for the CPU decision rule
// (zero exceededCpu across at least 1,000 requests per route, paced and sustained). CPU itself comes from wrangler tail;
// a CPU-limit kill shows up here as a 5xx response.
//   BASE_URL=https://… node scripts/cpu-run.mjs paced 1000 200      (one at a time, 200 ms apart)
//   BASE_URL=https://… node scripts/cpu-run.mjs sustained 1000 5    (5 at a time, no pause)
import { writeFileSync } from "node:fs";
import { stagingFetch } from "./lib/staging-auth.mjs";

const base = (process.env.BASE_URL ?? "http://localhost:8787").replace(/\/$/, "");
const [mode = "paced", countArg = "1000", param = mode === "paced" ? "200" : "5"] = process.argv.slice(2);
const count = Number(countArg);
const routes = (process.env.ROUTES ?? "/,/checkout,/bag,/products/sample-dome-jhumka,/categories/jewellery,/no-such-page").split(",");
const expected = (route) => (route === "/no-such-page" ? 404 : 200);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

async function one(route) {
  const started = performance.now();
  try {
    const r = await stagingFetch(base + route, { redirect: "manual" });
    await r.arrayBuffer();
    return { status: r.status, ms: performance.now() - started };
  } catch (error) {
    return { status: `error:${error.cause?.code ?? error.name}`, ms: performance.now() - started };
  }
}

const summary = { base, mode, count, param: Number(param), startedAt: new Date().toISOString(), routes: {} };
for (const route of routes) {
  const results = [];
  const routeStart = Date.now();
  if (mode === "paced") {
    for (let i = 0; i < count; i++) {
      results.push(await one(route));
      await sleep(Number(param));
    }
  } else {
    let next = 0;
    await Promise.all(Array.from({ length: Number(param) }, async () => {
      while (next < count) { next++; results.push(await one(route)); }
    }));
  }
  const statuses = {};
  for (const r of results) statuses[r.status] = (statuses[r.status] ?? 0) + 1;
  const ms = results.map((r) => r.ms).sort((a, b) => a - b);
  const unexpected = results.filter((r) => r.status !== expected(route)).length;
  summary.routes[route] = {
    requests: results.length, statuses, unexpected, seconds: Math.round((Date.now() - routeStart) / 1000),
    latencyMs: { p50: Math.round(pct(ms, 0.5)), p95: Math.round(pct(ms, 0.95)), max: Math.round(ms.at(-1)) },
  };
  console.log(`${mode} ${route}: ${results.length} requests, statuses ${JSON.stringify(statuses)}, unexpected ${unexpected}, latency p50 ${summary.routes[route].latencyMs.p50} ms`);
}
summary.finishedAt = new Date().toISOString();
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(summary, null, 2));
const bad = Object.values(summary.routes).reduce((n, r) => n + r.unexpected, 0);
console.log(bad ? `\n${bad} unexpected responses` : "\nAll responses as expected");
process.exit(bad ? 1 : 0);
