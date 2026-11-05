// Finds when Cloudflare stops a request for CPU use. Steps up CPU per request one level at a
// time, then holds a high level under load. Pair with `wrangler tail` for measured CPU.
// Usage: DEPLOY_TEST_TOKEN=... node cpu-probe.mjs <base-url> <output.json>
import { writeFileSync } from "node:fs";

const base = process.argv[2].replace(/\/$/, "");
const output = process.argv[3];
const headers = { "x-test-token": process.env.DEPLOY_TEST_TOKEN };
const results = [];

async function hit(n, phase) {
  const started = performance.now();
  let status = 0, marker = "";
  try {
    const response = await fetch(`${base}/api/cpu-probe?n=${n}`, { headers });
    const body = await response.text();
    status = response.status;
    marker = body.match(/error code: \d+|exceeded resource limits/i)?.[0] ?? "";
  } catch (error) {
    marker = String(error).slice(0, 60);
  }
  const result = { n, phase, status, marker, ms: Math.round(performance.now() - started) };
  results.push(result);
  return result;
}

const levels = [1e6, 3e6, 1e7, 2e7, 5e7, 1e8, 2e8, 5e8, 1e9, 2e9];
let stopped = null;
for (const n of levels) {
  const round = [];
  for (let i = 0; i < 20; i++) {
    round.push(await hit(n, "step"));
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const failed = round.filter((r) => r.status !== 200).length;
  const times = round.map((r) => r.ms).sort((a, b) => a - b);
  console.log(`n=${n.toExponential(0)} sent=${round.length} failed=${failed} latency p50=${times[10]}ms markers=${[...new Set(round.map((r) => `${r.status}${r.marker ? ` ${r.marker}` : ""}`))].join(", ")}`);
  if (failed >= 10) { stopped = n; break; }
}
console.log(stopped ? `Stopped stepping at n=${stopped.toExponential(0)}` : "No level was stopped");

// Hold moderate levels under load, as a busy store would.
for (const n of [1e7, 5e7]) {
  const hits = [];
  let next = 0;
  await Promise.all(Array.from({ length: 5 }, async () => {
    while (next++ < 300) hits.push(await hit(n, "sustained"));
  }));
  const failed = hits.filter((r) => r.status !== 200);
  console.log(`sustained n=${n.toExponential(0)} sent=${hits.length} failed=${failed.length} statuses=${[...new Set(hits.map((r) => `${r.status}${r.marker ? ` ${r.marker}` : ""}`))].join(", ")}`);
}
writeFileSync(output, JSON.stringify(results));
