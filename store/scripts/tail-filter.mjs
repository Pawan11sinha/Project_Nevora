// Reads `wrangler tail --format json` from stdin and writes one small JSON line per Worker invocation, keeping only
// the time, method, path, outcome, CPU and wall time, exception count and the CPU test's probe ID (scripts/lib/
// tail-events.mjs). Raw events hold visitor IP addresses and request headers, so they're never written anywhere.
//   npx wrangler tail nevora-store-staging --format json | node scripts/tail-filter.mjs > tail.jsonl
import { createWriteStream } from "node:fs";
import { createTailParser } from "./lib/tail-events.mjs";

const out = process.argv[2] ? createWriteStream(process.argv[2], { flags: "a" }) : process.stdout;
const feed = createTailParser((slim) => out.write(`${JSON.stringify(slim)}\n`));
process.stdin.setEncoding("utf8");
process.stdin.on("data", feed);
