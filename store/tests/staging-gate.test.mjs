// The staging Worker's password gate.
import assert from "node:assert/strict";
import { test } from "node:test";
import { MIN_PASSWORD_LENGTH, basicPassword, constantTimeEqual, gateDecision, gateResponse, isLocalPreview } from "../src/lib/staging-gate.ts";

const PASSWORD = "correct-horse-battery-staple-42";
const basic = (user, pass) => `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
const staging = new URL("https://nevora-store-staging.example.workers.dev/checkout");

test("the right password is let in, with any username", () => {
  assert.equal(gateDecision(staging, basic("nevora", PASSWORD), PASSWORD), "allow");
  assert.equal(gateDecision(staging, basic("", PASSWORD), PASSWORD), "allow");
  assert.equal(gateDecision(staging, basic("x", "pass:with:colons-and-more-chars"), "pass:with:colons-and-more-chars"), "allow");
});

test("a missing, wrong or malformed password is challenged", () => {
  for (const auth of [null, "", basic("nevora", "wrong"), basic("nevora", `${PASSWORD}x`), basic("nevora", PASSWORD.slice(0, -1)), `Bearer ${PASSWORD}`, "Basic !!!", "Basic bm9jb2xvbg==", `Basic ${PASSWORD}`]) {
    assert.equal(gateDecision(staging, auth, PASSWORD), "challenge", String(auth));
  }
});

test("a deployed Worker without a usable password refuses everyone", () => {
  assert.equal(gateDecision(staging, basic("nevora", ""), undefined), "misconfigured");
  assert.equal(gateDecision(staging, basic("nevora", "short"), "short"), "misconfigured");
  assert.equal(gateDecision(staging, basic("nevora", "x".repeat(MIN_PASSWORD_LENGTH - 1)), "x".repeat(MIN_PASSWORD_LENGTH - 1)), "misconfigured");
});

test("only the plain-HTTP local preview skips the gate", () => {
  assert.equal(isLocalPreview(new URL("http://localhost:8787/")), true);
  assert.equal(isLocalPreview(new URL("http://127.0.0.1:8787/checkout")), true);
  for (const url of ["https://localhost/", "https://nevora-store-staging.example.workers.dev/", "http://localhost.evil.com/", "http://nevora-store-staging.example.workers.dev/"]) {
    assert.equal(isLocalPreview(new URL(url)), false, url);
    assert.notEqual(gateDecision(new URL(url), null, PASSWORD), "allow", url);
  }
});

test("passwords are compared exactly", () => {
  assert.equal(constantTimeEqual("abc", "abc"), true);
  assert.equal(constantTimeEqual("abc", "abd"), false);
  assert.equal(constantTimeEqual("abc", "abcd"), false);
  assert.equal(constantTimeEqual("", ""), true);
  assert.equal(constantTimeEqual("नेवोरा", "नेवोरा"), true);
  assert.equal(basicPassword(basic("u", "नेवोरा-password")), "नेवोरा-password");
});

test("gate responses ask the browser for a password and are never cached", async () => {
  const challenge = gateResponse("challenge");
  assert.equal(challenge.status, 401);
  assert.match(challenge.headers.get("WWW-Authenticate"), /^Basic realm="NEVORA staging"/);
  assert.equal(challenge.headers.get("Cache-Control"), "no-store");
  assert.ok(!(await challenge.text()).includes(PASSWORD));
  const closed = gateResponse("misconfigured");
  assert.equal(closed.status, 503);
  assert.equal(closed.headers.get("WWW-Authenticate"), null);
  assert.equal(closed.headers.get("Cache-Control"), "no-store");
});
