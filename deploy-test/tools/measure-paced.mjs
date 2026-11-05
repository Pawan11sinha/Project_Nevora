// One request at a time across all paths, so CPU isn't inflated by concurrency.
// Records client-side latency here. CPU comes from `wrangler tail`, summarised by report-live.mjs.
// Usage: node measure-paced.mjs <base-url> <rounds> <output.json>
import { writeFileSync } from "node:fs";

const base = process.argv[2].replace(/\/$/, "");
const rounds = Number(process.argv[3] ?? 40);
const output = process.argv[4];
const paths = [
  ["/api/health", 200], ["/", 200], ["/c/earrings", 200], ["/p/sample-1", 200], ["/p/sample-40", 200],
  ["/ssr", 200], ["/login", 200], ["/account", 307], ["/no-such", 404],
];

const results = [];
for (let round = 0; round < rounds; round++) {
  for (const [path, expected] of paths) {
    const started = performance.now();
    let status = 0, ttfb = 0, total = 0;
    try {
      const response = await fetch(base + path, { redirect: "manual", headers: { "cache-control": "no-cache" } });
      ttfb = performance.now() - started;
      const body = await response.text();
      total = performance.now() - started;
      status = response.status;
      if (/error code: 1102|error code: 1027|exceeded resource limits/i.test(body)) status = -1;
    } catch {
      status = 0;
    }
    results.push({ path, status, expected, ttfb, total });
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
writeFileSync(output, JSON.stringify(results));
console.log(`sent ${results.length} requests`);
