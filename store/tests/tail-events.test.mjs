// The CPU tools keep only an allow-list of fields from wrangler tail: never IP addresses, the staging password's
// Authorization header, cookies or any other header. Only the test's own probe ID is kept, and only when well formed.
import assert from "node:assert/strict";
import { test } from "node:test";
import { PROBE_HEADER, SLIM_FIELDS, createTailParser, slimEvent } from "../scripts/lib/tail-events.mjs";

// Shaped like a real `wrangler tail --format json` event, with every kind of sensitive value in it.
const raw = (probe) => ({
  outcome: "ok",
  scriptName: "nevora-store-staging",
  scriptVersion: { id: "b4bce78a-d937-404e-ab7d-3f6e5920a205" },
  eventTimestamp: 1794560000000,
  cpuTime: 3,
  wallTime: 9,
  exceptions: [],
  logs: [{ message: ["visitor 203.0.113.7"], level: "log", timestamp: 1794560000001 }],
  event: {
    request: {
      url: "https://nevora-store-staging.example.workers.dev/collections/coquette-edit?utm=x",
      method: "GET",
      headers: {
        authorization: "Basic bmV2b3JhOnNlY3JldA==",
        cookie: "session=abc",
        "cf-connecting-ip": "203.0.113.7",
        "x-forwarded-for": "203.0.113.7",
        "user-agent": "Mozilla/5.0",
        ...(probe === undefined ? {} : { [PROBE_HEADER]: probe }),
      },
      cf: { clientTcpRtt: 12, city: "Delhi", country: "IN", asn: 9829, latitude: "28.6", longitude: "77.2" },
    },
    response: { status: 200 },
  },
});

test("only the allow-listed fields are kept, with the probe ID", () => {
  const slim = slimEvent(raw("r1-home-paced-b1-7"));
  assert.deepEqual(Object.keys(slim), SLIM_FIELDS);
  assert.deepEqual(slim, { t: 1794560000000, method: "GET", path: "/collections/coquette-edit", outcome: "ok", cpu: 3, wall: 9, exceptions: 0, probe: "r1-home-paced-b1-7" });
});

test("nothing sensitive survives: IPs, password header, cookies, user agent, location, logs, query string", () => {
  const text = JSON.stringify(slimEvent(raw("r1-a-1")));
  for (const secret of ["203.0.113.7", "bmV2b3Jh", "Basic", "session=abc", "Mozilla", "Delhi", "28.6", "utm", "visitor", "workers.dev", "b4bce78a"]) {
    assert.ok(!text.includes(secret), `leaked ${secret}`);
  }
});

test("a missing or malformed probe ID is dropped, never copied", () => {
  assert.equal(slimEvent(raw(undefined)).probe, null);
  assert.equal(slimEvent(raw("Basic bmV2b3Jh")).probe, null);
  assert.equal(slimEvent(raw("x".repeat(81))).probe, null);
  assert.equal(slimEvent(raw("203.0.113.7")).probe, null);
});

test("the stream parser splits pretty-printed events, including across chunks, and flags unparsable ones", () => {
  const seen = [];
  const feed = createTailParser((e) => seen.push(e));
  const a = JSON.stringify(raw("r1-a-1"), null, 2);
  const b = JSON.stringify(raw("r1-a-2"), null, 2);
  feed(a.slice(0, 50));
  feed(a.slice(50) + "\n" + b.slice(0, 10));
  feed(b.slice(10) + "\n{ not json }\n");
  assert.deepEqual(seen.map((e) => e.probe ?? (e.unparsed ? "unparsed" : null)), ["r1-a-1", "r1-a-2", "unparsed"]);
});
