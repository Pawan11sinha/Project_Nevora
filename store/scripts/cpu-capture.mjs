// CPU measurement with complete capture, for the CPU decision rule (zero exceededCpu across at least 1,000 fully
// captured requests per route, paced and sustained). Replaces "send everything, then tail" with verified batches:
//
//  - Every request carries a unique ID in the x-nevora-probe header. `wrangler tail --header x-nevora-probe` follows
//    only those requests, filtered to one Worker version, and scripts/lib/tail-events.mjs keeps only an allow-list of
//    fields (no IP addresses, no other headers).
//  - Requests go in batches of 100. After each batch, the 100 IDs sent are compared with the IDs the tail captured.
//    A batch is complete only if all 100 were captured, all 100 got the expected status, and the tail didn't drop or
//    warn during it. Incomplete batches are repeated (up to a cap) and reported, never silently discarded.
//  - Each request has a 30-second timeout; every timeout is recorded with its ID, route and time.
//  - CPU percentiles come only from complete batches. exceededCpu and 5xx are counted from everything captured, so a
//    repeated batch can never hide one. A route passes only with 10 complete batches (1,000 requests) per mode and
//    zero exceededCpu and zero unexpected responses anywhere.
//
//   BASE_URL=https://nevora-store-staging.<account>.workers.dev VERSION_ID=<worker version> OUT_DIR=<dir> \
//     node scripts/cpu-capture.mjs pilot     (10 probes to /: checks the tail captures IDs and writes only allowed fields)
//   ... node scripts/cpu-capture.mjs run       (the full plan below)
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isStaging, stagingFetch } from "./lib/staging-auth.mjs";
import { PROBE_HEADER, SLIM_FIELDS, createTailParser } from "./lib/tail-events.mjs";

const BATCH_SIZE = 100;
const TARGET_COMPLETE = 10; // 10 × 100 = 1,000 fully captured requests per route and mode
const MAX_BATCHES = 15; // per route and mode; after that the segment is reported as inconclusive
const TIMEOUT_MS = 30_000;
const PACE_MS = 200; // paced: one at a time, 200 ms apart
const CONCURRENCY = 5; // sustained: 5 at a time, no pause
const CAPTURE_GRACE_MS = 20_000; // how long to wait for a batch's tail events after its last response
const READY_TIMEOUT_MS = 90_000; // how long to wait for the tail to capture a warm-up probe

const ROUTES = [
  { route: "/", expect: 200 },
  { route: "/collections/coquette-edit", expect: 200 },
  { route: "/categories/jewellery", expect: 200 },
  { route: "/collections", expect: 200 },
  { route: "/products/sample-pearl-chandbali", expect: 200 },
  { route: "/collections/mix-and-match", expect: 307 },
];
const PLAN = [
  ...ROUTES.flatMap((r) => [{ ...r, mode: "paced" }, { ...r, mode: "sustained" }]),
  { route: "/", expect: 200, mode: "sustained", extra: true }, // the additional sustained homepage test
];

const command = process.argv[2];
const base = (process.env.BASE_URL ?? "").replace(/\/$/, "");
const versionId = process.env.VERSION_ID ?? "";
const outDir = process.env.OUT_DIR ?? "";
if (!["pilot", "run"].includes(command)) throw new Error("Usage: node scripts/cpu-capture.mjs pilot|run");
if (!isStaging(base)) throw new Error("BASE_URL must be the staging Worker (https://nevora-store-staging.<account>.workers.dev)");
if (!/^[0-9a-f-]{36}$/.test(versionId)) throw new Error("VERSION_ID must be the deployed Worker version ID");
if (!outDir) throw new Error("OUT_DIR is required");
mkdirSync(outDir, { recursive: true });

const runId = `r${Date.now().toString(36)}`;
const eventsFile = join(outDir, `${runId}-events.jsonl`);
const timeoutsFile = join(outDir, `${runId}-timeouts.jsonl`);
const notesFile = join(outDir, `${runId}-tail-notes.txt`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : null);
const slug = (route) => (route === "/" ? "home" : route.replace(/^\//, "").replace(/[^a-z0-9]+/g, "-"));
const log = (line) => console.log(`${new Date().toISOString().slice(11, 19)} ${line}`);

/** Starts a tail on this Worker version, filtered to probe requests. Captured events go into `captured` by probe ID. */
function startTail(captured, trouble) {
  const child = spawn("npx", ["wrangler", "tail", "nevora-store-staging", "--format", "json", "--header", PROBE_HEADER, "--version-id", versionId], {
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true, // its own process group, so stopping it also stops wrangler under npx
  });
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", createTailParser((e) => {
    appendFileSync(eventsFile, `${JSON.stringify(e)}\n`);
    if (e.probe) captured.set(e.probe, e);
  }));
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (text) => {
    for (const line of text.replace(/\x1b\[[0-9;]*m/g, "").split("\n").map((l) => l.trim()).filter(Boolean)) {
      if (/connection lost|reconnect|sampl|error|too much traffic/i.test(line)) {
        trouble.push(Date.now());
        appendFileSync(notesFile, `${new Date().toISOString()} ${line.slice(0, 200)}\n`);
      }
    }
  });
  // Stops the tail: SIGINT first, then SIGTERM to the whole process group (npx doesn't always pass SIGINT on).
  return async () => {
    for (const signal of ["SIGINT", "SIGTERM"]) {
      try { process.kill(-child.pid, signal); } catch { return; }
      await sleep(1500);
      if (child.exitCode !== null || child.signalCode !== null) return;
    }
  };
}

async function send(route, id) {
  const started = performance.now();
  try {
    const r = await stagingFetch(base + route, { redirect: "manual", headers: { [PROBE_HEADER]: id }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    await r.arrayBuffer();
    return { id, status: r.status, ms: Math.round(performance.now() - started) };
  } catch (error) {
    const timedOut = error.name === "TimeoutError" || error.cause?.code === "ETIMEDOUT" || error.cause?.name === "TimeoutError";
    const result = { id, status: timedOut ? "timeout" : `error:${error.cause?.code ?? error.name}`, ms: Math.round(performance.now() - started), at: new Date().toISOString() };
    if (timedOut) appendFileSync(timeoutsFile, `${JSON.stringify({ ...result, route })}\n`);
    return result;
  }
}

async function sendBatch(route, mode, ids) {
  const results = [];
  if (mode === "paced") {
    for (const id of ids) {
      results.push(await send(route, id));
      await sleep(PACE_MS);
    }
  } else {
    let next = 0;
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
      while (next < ids.length) results.push(await send(route, ids[next++]));
    }));
  }
  return results;
}

async function waitForCapture(ids, captured) {
  const until = Date.now() + CAPTURE_GRACE_MS;
  while (Date.now() < until && !ids.every((id) => captured.has(id))) await sleep(250);
  return ids.filter((id) => captured.has(id)).length;
}

/** Sends a warm-up probe every 3 seconds until the tail captures one, proving the tail is attached and filtering. */
async function waitForTail(route, label, captured) {
  const until = Date.now() + READY_TIMEOUT_MS;
  for (let k = 1; Date.now() < until; k++) {
    const id = `${runId}-${label}-w${k}`;
    await send(route, id);
    const stop = Date.now() + 3000;
    while (Date.now() < stop) {
      if (captured.has(id)) return true;
      await sleep(200);
    }
  }
  return false;
}

async function runSegment({ route, expect, mode, extra }, { batches = MAX_BATCHES, size = BATCH_SIZE, target = TARGET_COMPLETE } = {}) {
  const label = `${slug(route)}-${mode}${extra ? "-extra" : ""}`;
  const captured = new Map();
  const trouble = [];
  const stopTail = startTail(captured, trouble);
  const segment = { label, route, mode, expect, extra: Boolean(extra), batches: [], ready: false };
  try {
    segment.ready = await waitForTail(route, label, captured);
    if (!segment.ready) {
      log(`${label}: tail never captured a warm-up probe; segment not run`);
      return segment;
    }
    for (let n = 1; n <= batches && segment.batches.filter((b) => b.complete).length < target; n++) {
      const ids = Array.from({ length: size }, (_, i) => `${runId}-${label}-b${n}-${i + 1}`);
      const startedAt = Date.now();
      const results = await sendBatch(route, mode, ids);
      const capturedCount = await waitForCapture(ids, captured);
      const statuses = {};
      for (const r of results) statuses[r.status] = (statuses[r.status] ?? 0) + 1;
      const tailTrouble = trouble.some((t) => t >= startedAt);
      const allExpected = results.every((r) => r.status === expect);
      const batch = {
        n, ids, sent: results.length, statuses, captured: capturedCount, missing: ids.filter((id) => !captured.has(id)).length,
        timeouts: results.filter((r) => r.status === "timeout").length, tailTrouble,
        complete: capturedCount === size && allExpected && !tailTrouble,
      };
      segment.batches.push(batch);
      log(`${label} batch ${n}: ${batch.complete ? "complete" : "INCOMPLETE"}, captured ${capturedCount}/${size}, statuses ${JSON.stringify(statuses)}${tailTrouble ? ", tail trouble" : ""}`);
      trouble.length = 0;
    }
  } finally {
    await sleep(2000);
    await stopTail();
  }
  segment.events = Object.fromEntries([...captured].filter(([id]) => !/-w\d+$/.test(id)));
  return segment;
}

function summarise(segment, target = TARGET_COMPLETE) {
  const all = Object.values(segment.events ?? {});
  const completeIds = new Set(segment.batches.filter((b) => b.complete).flatMap((b) => b.ids));
  const complete = all.filter((e) => completeIds.has(e.probe));
  const cpu = complete.map((e) => e.cpu).filter((v) => typeof v === "number").sort((a, b) => a - b);
  const sent = segment.batches.reduce((n, b) => n + b.sent, 0);
  const statuses = {};
  for (const b of segment.batches) for (const [s, n] of Object.entries(b.statuses)) statuses[s] = (statuses[s] ?? 0) + n;
  const outcomes = {};
  for (const e of all) outcomes[e.outcome] = (outcomes[e.outcome] ?? 0) + 1;
  const exceededCpu = all.filter((e) => e.outcome === "exceededCpu").length;
  const serverErrors = Object.entries(statuses).filter(([s]) => /^5\d\d$/.test(s)).reduce((n, [, c]) => n + c, 0);
  const unexpected = Object.entries(statuses).filter(([s]) => s !== String(segment.expect) && s !== "timeout").reduce((n, [, c]) => n + c, 0);
  const completeBatches = segment.batches.filter((b) => b.complete).length;
  let verdict = "PASS";
  if (exceededCpu > 0 || serverErrors > 0 || unexpected > 0) verdict = "FAIL";
  else if (!segment.ready || completeBatches < target) verdict = "INCONCLUSIVE";
  return {
    label: segment.label, route: segment.route, mode: segment.mode, verdict,
    batches: { attempted: segment.batches.length, complete: completeBatches },
    requests: { sent, captured: all.length, coverage: sent ? Math.round((all.length / sent) * 1000) / 10 : 0, inCompleteBatches: complete.length },
    statuses, timeouts: segment.batches.reduce((n, b) => n + b.timeouts, 0), outcomes, exceededCpu,
    cpuMs: { p50: pct(cpu, 0.5), p95: pct(cpu, 0.95), p99: pct(cpu, 0.99), max: cpu.at(-1) ?? null, over10: cpu.filter((v) => v > 10).length },
  };
}

const startedAt = new Date().toISOString();
if (command === "pilot") {
  const segment = await runSegment({ route: "/", expect: 200, mode: "paced" }, { batches: 1, size: 10, target: 1 });
  const lines = readFileSync(eventsFile, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const fieldsOk = lines.every((e) => e.unparsed || JSON.stringify(Object.keys(e)) === JSON.stringify(SLIM_FIELDS));
  const noIp = !/\b\d{1,3}(\.\d{1,3}){3}\b|authorization|cookie|user-agent/i.test(readFileSync(eventsFile, "utf8"));
  const b = segment.batches[0];
  console.log(`\npilot: tail ready ${segment.ready}; captured ${b?.captured ?? 0}/10 probe IDs; statuses ${JSON.stringify(b?.statuses ?? {})}`);
  console.log(`pilot: ${lines.length} lines written; every line has only [${SLIM_FIELDS.join(", ")}]: ${fieldsOk}; no IP, authorization, cookie or user-agent text: ${noIp}`);
  process.exit(segment.ready && b?.captured === 10 && fieldsOk && noIp ? 0 : 1);
}

const results = [];
for (const step of PLAN) {
  const segment = await runSegment(step);
  const summary = summarise(segment);
  results.push(summary);
  writeFileSync(join(outDir, `${runId}-summary.json`), JSON.stringify({ runId, base: "staging", versionId, startedAt, results }, null, 2));
  log(`${summary.label}: ${summary.verdict}, ${summary.batches.complete}/${summary.batches.attempted} batches complete, coverage ${summary.requests.coverage}%`);
}

console.log(`\nrun ${runId}, Worker version ${versionId}, ${startedAt} to ${new Date().toISOString()}`);
console.log("segment".padEnd(42), "verdict".padEnd(12), "batches", "  sent", "captured", "cover%", " p50", " p95", " p99", " max", " >10ms", " exceededCpu", " timeouts", " unexpected");
for (const r of results) {
  const unexpected = Object.entries(r.statuses).filter(([s]) => s !== String(ROUTES.find((x) => x.route === r.route).expect) && s !== "timeout").reduce((n, [, c]) => n + c, 0);
  console.log(r.label.padEnd(42), r.verdict.padEnd(12), `${r.batches.complete}/${r.batches.attempted}`.padStart(7), String(r.requests.sent).padStart(6), String(r.requests.captured).padStart(8), String(r.requests.coverage).padStart(6), String(r.cpuMs.p50 ?? "-").padStart(4), String(r.cpuMs.p95 ?? "-").padStart(4), String(r.cpuMs.p99 ?? "-").padStart(4), String(r.cpuMs.max ?? "-").padStart(4), String(r.cpuMs.over10).padStart(6), String(r.exceededCpu).padStart(12), String(r.timeouts).padStart(9), String(unexpected).padStart(11));
}
const overall = results.every((r) => r.verdict === "PASS") ? "PASS" : results.some((r) => r.verdict === "FAIL") ? "FAIL" : "INCONCLUSIVE";
console.log(`\noverall: ${overall}${overall === "PASS" ? "" : " (not a pass: see the segments above)"}`);
process.exit(overall === "PASS" ? 0 : 1);
