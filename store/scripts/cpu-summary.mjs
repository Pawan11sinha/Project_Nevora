// Summarises CPU per path from the filtered tail log written by scripts/tail-filter.mjs.
//   node scripts/cpu-summary.mjs tail.jsonl [fromISO] [toISO]
import { readFileSync } from "node:fs";

const [file, from, to] = process.argv.slice(2);
const lo = from ? Date.parse(from) : -Infinity;
const hi = to ? Date.parse(to) : Infinity;
const events = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((e) => !e.unparsed && e.t >= lo && e.t <= hi);
const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
const byPath = new Map();
for (const e of events) {
  if (!byPath.has(e.path)) byPath.set(e.path, []);
  byPath.get(e.path).push(e);
}
const outcomes = {};
for (const e of events) outcomes[e.outcome] = (outcomes[e.outcome] ?? 0) + 1;
console.log(`events ${events.length}, outcomes ${JSON.stringify(outcomes)}`);
console.log("path".padEnd(34), "events", " cpu p50", " p95", " p99", " max", " >10ms", " exceededCpu", " wall p50");
for (const [path, list] of [...byPath].sort((a, b) => b[1].length - a[1].length)) {
  const cpu = list.map((e) => e.cpu).filter((v) => typeof v === "number").sort((a, b) => a - b);
  const wall = list.map((e) => e.wall).filter((v) => typeof v === "number").sort((a, b) => a - b);
  const killed = list.filter((e) => e.outcome === "exceededCpu").length;
  console.log(String(path).padEnd(34), String(list.length).padStart(6), String(pct(cpu, 0.5) ?? "-").padStart(8), String(pct(cpu, 0.95) ?? "-").padStart(4), String(pct(cpu, 0.99) ?? "-").padStart(4), String(cpu.at(-1) ?? "-").padStart(4), String(cpu.filter((v) => v > 10).length).padStart(6), String(killed).padStart(12), String(pct(wall, 0.5) ?? "-").padStart(9));
}
