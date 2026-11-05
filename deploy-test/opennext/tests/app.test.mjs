// Fast checks that need no running server. Uses Node's built-in test runner, so it
// adds no dependency. tools/smoke.mjs and tools/browser.mjs test a running Worker.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { authCookieOptions } from "../src/lib/auth-cookies.ts";
import { isDecodablePath } from "../src/lib/url-guard.ts";
import { loginDestination, loginSchema } from "../src/lib/validation.ts";

test("login accepts valid credentials", () => {
  assert.equal(loginSchema.safeParse({ email: "a@example.com", password: "x" }).success, true);
});

test("login rejects bad input", () => {
  for (const input of [
    { email: "not-an-email", password: "x" },
    { email: "a@example.com", password: "" },
    { email: null, password: null },
    { email: "a@example.com", password: "x".repeat(257) },
  ]) {
    assert.equal(loginSchema.safeParse(input).success, false);
  }
});

test("login can only redirect to known pages", () => {
  assert.equal(loginDestination("/admin"), "/admin");
  assert.equal(loginDestination("/account"), "/account");
  assert.equal(loginDestination("https://evil.example"), "/account");
  assert.equal(loginDestination("//evil.example"), "/account");
  assert.equal(loginDestination(null), "/account");
});

test("malformed paths are caught and valid encoded paths pass", () => {
  for (const bad of ["/c/%E0%A4%A", "/p/%FF", "/c/%ZZ", "/%"]) {
    assert.equal(isDecodablePath(bad), false, bad);
  }
  for (const good of ["/", "/c/earrings", "/c/ear%72ings", "/p/sample%2D1", "/a%20b", "/%E0%A4%A4"]) {
    assert.equal(isDecodablePath(good), true, good);
  }
});

test("pages don't ask for ISR refresh while KV is off", () => {
  for (const page of ["../src/app/c/[slug]/page.tsx", "../src/app/p/[slug]/page.tsx"]) {
    const source = readFileSync(new URL(page, import.meta.url), "utf8");
    assert.doesNotMatch(source, /export const revalidate/);
  }
});

test("session cookies are protected, with no short lifetime", () => {
  assert.equal(authCookieOptions.httpOnly, true);
  assert.equal(authCookieOptions.sameSite, "lax");
  assert.equal("maxAge" in authCookieOptions, false);
});

test("assets get long-term caching", () => {
  const headers = readFileSync(new URL("../public/_headers", import.meta.url), "utf8");
  assert.match(headers, /\/_next\/static\/\*\n\s+Cache-Control: public, max-age=31536000, immutable/);
});

test("KV stays off until real CPU has been measured", () => {
  const config = readFileSync(new URL("../open-next.config.ts", import.meta.url), "utf8");
  assert.doesNotMatch(config, /^import .*kv-/m);
});

test("no secrets or public env values in source config", () => {
  const wrangler = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  assert.doesNotMatch(wrangler, /SUPABASE|TOKEN|SECRET/);
});
