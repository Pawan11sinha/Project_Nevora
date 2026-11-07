// Reads `wrangler tail --format json` from stdin and writes one small JSON line per Worker invocation, keeping only
// the time, method, path, outcome, CPU and wall time, and exception count. Raw events hold visitor IP addresses and
// request headers, so they're never written anywhere.
//   npx wrangler tail nevora-store-staging --format json | node scripts/tail-filter.mjs > tail.jsonl
import { createWriteStream } from "node:fs";

const out = process.argv[2] ? createWriteStream(process.argv[2], { flags: "a" }) : process.stdout;
let buffer = "";
let depth = 0, start = -1, inString = false, escaped = false, scanned = 0;

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  // Tail prints pretty-printed JSON objects one after another, so split on top-level braces.
  for (let i = scanned; i < buffer.length; i++) {
    const ch = buffer[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" && depth++ === 0) start = i;
    else if (ch === "}" && --depth === 0) {
      try {
        const e = JSON.parse(buffer.slice(start, i + 1));
        const url = e.event?.request?.url;
        out.write(`${JSON.stringify({
          t: e.eventTimestamp,
          method: e.event?.request?.method,
          path: url ? new URL(url).pathname : null,
          outcome: e.outcome,
          cpu: e.cpuTime ?? null,
          wall: e.wallTime ?? null,
          exceptions: e.exceptions?.length ?? 0,
        })}\n`);
      } catch {
        out.write(`${JSON.stringify({ unparsed: true })}\n`);
      }
      buffer = buffer.slice(i + 1);
      i = -1;
      start = -1;
    }
  }
  scanned = buffer.length;
});
