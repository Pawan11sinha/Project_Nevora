// Tests the race logic against a fake local server. It never contacts Supabase.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import { attemptPurchase, runRace } from "../../tools/race.lib.mjs";

let stock = 0;
let server;
let base;
let inFlight = 0;
let maxInFlight = 0;

before(async () => {
  server = createServer((req, res) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    const done = (status, body) => {
      inFlight--;
      res.writeHead(status);
      res.end(body);
    };
    if (req.url === "/hang") return; // Never answers.
    if (req.url === "/error") return done(500, '{"code":"XX000"}');
    if (req.url === "/html") return done(200, "<html>");
    setTimeout(() => {
      if (stock > 0) {
        stock--;
        done(200, "true");
      } else {
        done(200, "false");
      }
    }, 20);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.closeAllConnections();
  server.close();
});

// A port that was just free, so connecting to it is refused for real.
const closedPort = () =>
  new Promise((resolve) => {
    const probe = createServer();
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

const attempt = (path = "/buy", timeoutMs) => () => attemptPurchase({ url: base + path, headers: {}, timeoutMs });

test("100 buyers for 1 unit: passes with exactly one winner, all concurrent", async () => {
  stock = 1;
  maxInFlight = 0;
  const race = await runRace({ buyers: 100, availableStock: 1, attempt: attempt() });
  assert.equal(race.completed, 100);
  assert.equal(race.wins, 1);
  assert.equal(race.losses, 99);
  assert.equal(race.pass, true);
  assert.equal(maxInFlight, 100, "concurrency must not be reduced");
});

test("30 buyers for 3 units: exactly three win", async () => {
  stock = 3;
  const race = await runRace({ buyers: 30, availableStock: 3, attempt: attempt() });
  assert.deepEqual([race.wins, race.losses, race.pass], [3, 27, true]);
});

test("every request has finished before the race returns", async () => {
  stock = 1;
  await runRace({ buyers: 50, availableStock: 1, attempt: attempt() });
  assert.equal(inFlight, 0);
});

test("overselling fails the race", async () => {
  stock = 2;
  const race = await runRace({ buyers: 20, availableStock: 1, attempt: attempt() });
  assert.equal(race.wins, 2);
  assert.equal(race.pass, false);
});

test("one failed connection fails the race, and the others still finish", async () => {
  stock = 1;
  const port = await closedPort();
  const race = await runRace({
    buyers: 10,
    availableStock: 1,
    attempt: (i) => (i === 9 ? attemptPurchase({ url: `http://127.0.0.1:${port}/`, headers: {} }) : attempt()()),
  });
  assert.equal(race.completed, 10);
  assert.deepEqual([race.wins, race.losses, race.network, race.pass], [1, 8, 1, false]);
});

test("the underlying network cause is recorded", async () => {
  const result = await attemptPurchase({ url: `http://127.0.0.1:${await closedPort()}/`, headers: {} });
  assert.equal(result.kind, "network");
  assert.match(result.detail, /ECONNREFUSED/);
});

test("a hung request times out instead of waiting forever", async () => {
  const started = Date.now();
  const result = await attempt("/hang", 200)();
  assert.equal(result.kind, "network");
  assert.match(result.detail, /Timeout/);
  assert.ok(Date.now() - started < 3000);
  inFlight--;
});

test("server errors and non-JSON answers are invalid, and fail the race", async () => {
  assert.deepEqual(await attempt("/error")(), { kind: "invalid", detail: "status 500, code XX000" });
  assert.equal((await attempt("/html")()).kind, "invalid");
  const race = await runRace({ buyers: 2, availableStock: 0, attempt: attempt("/error") });
  assert.deepEqual([race.invalid, race.pass], [2, false]);
});

test("a rejected attempt is counted rather than lost", async () => {
  const race = await runRace({ buyers: 2, availableStock: 0, attempt: () => Promise.reject(new Error("boom")) });
  assert.deepEqual([race.completed, race.network, race.pass], [2, 2, false]);
  assert.match(Object.keys(race.errors)[0], /boom/);
});
