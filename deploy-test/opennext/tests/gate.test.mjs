// The access gate and the signup switch. No network or database.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { GATE_HEADER, gateAllows } from "../src/lib/test-gate.ts";

const TOKEN = "a".repeat(48);
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("gate fails closed with no token or a short one", () => {
  assert.equal(gateAllows(TOKEN, undefined), false);
  assert.equal(gateAllows(TOKEN, ""), false);
  assert.equal(gateAllows("short", "short"), false);
  assert.equal(gateAllows("a".repeat(31), "a".repeat(31)), false);
});

test("gate rejects missing and wrong tokens", () => {
  for (const wrong of [null, "", "a", "a".repeat(47), "a".repeat(49), `${"a".repeat(47)}b`, `b${"a".repeat(47)}`, TOKEN.toUpperCase(), ` ${TOKEN}`]) {
    assert.equal(gateAllows(wrong, TOKEN), false, String(wrong));
  }
});

test("gate accepts the exact token", () => {
  assert.equal(gateAllows(TOKEN, TOKEN), true);
});

test("gate header name contains token, which tail logs redact", () => {
  assert.match(GATE_HEADER, /token/);
});

test("the gate runs before URL parsing and before Next.js", () => {
  const body = read("../custom-worker.ts").split("fetch(request")[1];
  const gate = body.indexOf("gateAllows(");
  assert.ok(gate > -1);
  assert.ok(gate < body.indexOf("new URL("));
  assert.ok(gate < body.indexOf("handler.fetch("));
  assert.equal(body.match(/handler\.fetch\(/g).length, 1);
});

test("the token is removed before the app sees the request", () => {
  const body = read("../custom-worker.ts");
  assert.ok(body.indexOf("headers.delete(GATE_HEADER)") < body.indexOf("handler.fetch("));
  assert.doesNotMatch(body, /console\./);
});

test("signup stays off unless explicitly enabled, and nothing enables it", () => {
  const action = read("../src/app/signup/actions.ts");
  assert.ok(action.indexOf('SIGNUP_ENABLED !== "1"') > -1);
  assert.ok(action.indexOf('SIGNUP_ENABLED !== "1"') < action.indexOf("auth.signUp"));
  assert.doesNotMatch(read("../wrangler.jsonc"), /SIGNUP_ENABLED/);
});

test("request logs for invocations stay off in the Worker's config", () => {
  assert.match(read("../wrangler.jsonc"), /"invocation_logs":\s*false/);
});
