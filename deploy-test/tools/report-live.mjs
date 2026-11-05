// Combines Worker CPU from `wrangler tail` with client latency from measure-paced.mjs.
// Usage: node report-live.mjs <tail.log> <client.json>
import { readFileSync } from "node:fs";

function parseEvents(text) {
  const events = [];
  let depth = 0, start = -1, inString = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" && depth++ === 0) start = i;
    else if (ch === "}" && --depth === 0) events.push(JSON.parse(text.slice(start, i + 1)));
  }
  return events;
}

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
const stats = (values) => {
  const s = [...values].sort((a, b) => a - b);
  return { n: s.length, p50: pct(s, 0.5), p95: pct(s, 0.95), max: s.at(-1) };
};
const fmt = (v) => String(Math.round(v ?? 0)).padStart(5);

const events = parseEvents(readFileSync(process.argv[2], "utf8")).filter((e) => e.event?.request?.url);
const client = JSON.parse(readFileSync(process.argv[3], "utf8"));
const paths = [...new Set(client.map((r) => r.path))];

console.log("Worker side, from wrangler tail (ms):");
console.log("path".padEnd(15), "events  cpu50 cpu95 cpuMax  wall50 wall95 wallMax  over10ms");
for (const path of paths) {
  const v = events.filter((e) => new URL(e.event.request.url).pathname === path);
  const c = stats(v.map((e) => e.cpuTime));
  const w = stats(v.map((e) => e.wallTime));
  const over = v.filter((e) => e.cpuTime > 10).length;
  console.log(path.padEnd(15), String(c.n).padStart(6), fmt(c.p50), fmt(c.p95), String(fmt(c.max)).padStart(6), "", fmt(w.p50), " ", fmt(w.p95), "  ", fmt(w.max), `  ${over} (${c.n ? Math.round((100 * over) / c.n) : 0}%)`);
}

console.log("\nBrowser side, from this machine in Delhi (ms):");
console.log("path".padEnd(15), "sent  ttfb50 ttfb95 ttfbMax  total50 total95 totalMax  errors");
for (const path of paths) {
  const v = client.filter((r) => r.path === path);
  const t = stats(v.map((r) => r.ttfb));
  const a = stats(v.map((r) => r.total));
  const errors = v.filter((r) => r.status !== r.expected).length;
  console.log(path.padEnd(15), String(v.length).padStart(4), " ", fmt(t.p50), " ", fmt(t.p95), "  ", fmt(t.max), "   ", fmt(a.p50), "  ", fmt(a.p95), "   ", fmt(a.max), "   ", errors);
}

const failed = client.filter((r) => r.status !== r.expected).length;
const outcomes = events.reduce((m, e) => ((m[e.outcome] = (m[e.outcome] ?? 0) + 1), m), {});
const all = stats(events.map((e) => e.cpuTime));
const allOver = events.filter((e) => e.cpuTime > 10).length;
console.log(`\nSent ${client.length}, unexpected responses ${failed} (${((100 * failed) / client.length).toFixed(2)}%)`);
console.log(`Tail captured ${events.length} of ${client.length} (${Math.round((100 * events.length) / client.length)}%), outcomes ${JSON.stringify(outcomes)}, exceptions ${events.filter((e) => e.exceptions?.length).length}`);
console.log(`All captured CPU: p50 ${all.p50} p95 ${all.p95} max ${all.max}, over 10 ms ${allOver} (${Math.round((100 * allOver) / events.length)}%)`);
const logs = {};
for (const e of events) for (const l of e.logs ?? []) {
  const k = `${l.level}: ${JSON.stringify(l.message).replace(/key=[^ "]*/, "key=…").slice(0, 90)}`;
  logs[k] = (logs[k] ?? 0) + 1;
}
console.log("Worker log messages:", logs);
