// Summarises CPU time per path from `wrangler tail --format json` output.
// Usage: npx wrangler tail --format json > tail.log   (while traffic runs)
//        node cpu-report.mjs tail.log
import { readFileSync } from "node:fs";

const LIMIT_MS = 10;
const byPath = new Map();
const outcomes = new Map();
const lines = readFileSync(process.argv[2], "utf8");

// Tail prints pretty JSON objects one after another, so split on top-level braces.
let depth = 0, start = -1, inString = false, escaped = false;
for (let i = 0; i < lines.length; i++) {
  const ch = lines[i];
  if (inString) {
    if (escaped) escaped = false;
    else if (ch === "\\") escaped = true;
    else if (ch === '"') inString = false;
    continue;
  }
  if (ch === '"') inString = true;
  else if (ch === "{" && depth++ === 0) start = i;
  else if (ch === "}" && --depth === 0) {
    const event = JSON.parse(lines.slice(start, i + 1));
    outcomes.set(event.outcome, (outcomes.get(event.outcome) ?? 0) + 1);
    const url = event.event?.request?.url;
    if (!url || typeof event.cpuTime !== "number") continue;
    const path = new URL(url).pathname;
    if (!byPath.has(path)) byPath.set(path, []);
    byPath.get(path).push(event.cpuTime);
  }
}

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
console.log("path".padEnd(32), "count", " p50", " p95", " max", " over 10 ms");
for (const [path, values] of [...byPath].sort()) {
  values.sort((a, b) => a - b);
  const over = values.filter((v) => v > LIMIT_MS).length;
  console.log(
    path.padEnd(32),
    String(values.length).padStart(5),
    String(pct(values, 0.5)).padStart(4),
    String(pct(values, 0.95)).padStart(4),
    String(values[values.length - 1]).padStart(4),
    String(over).padStart(11),
  );
}
console.log("\nOutcomes:", Object.fromEntries(outcomes));
