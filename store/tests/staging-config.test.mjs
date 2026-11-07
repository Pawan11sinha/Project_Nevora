// The staging deployment can't reach production, a domain or DNS, and the staging password goes only to staging.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { stagingHeaders, isStaging } from "../scripts/lib/staging-auth.mjs";

const root = join(import.meta.dirname, "..");
// wrangler.jsonc allows comments; strip whole-line and trailing // comments (none of the values contain "//").
const wrangler = JSON.parse(readFileSync(join(root, "wrangler.jsonc"), "utf8").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/.*$/gm, ""));

test("wrangler.jsonc targets only the staging Worker", () => {
  assert.equal(wrangler.name, "nevora-store-staging");
  assert.deepEqual(wrangler.services, [{ binding: "WORKER_SELF_REFERENCE", service: "nevora-store-staging" }]);
  for (const key of ["route", "routes", "env", "custom_domain", "zone_id", "zone_name"]) assert.equal(wrangler[key], undefined, `${key} must not be set`);
  assert.equal(wrangler.preview_urls, false);
  assert.equal(wrangler.observability.logs.invocation_logs, false);
});

test("staging has no plain-text variables or data bindings; the password is a Wrangler secret", () => {
  for (const key of ["vars", "kv_namespaces", "r2_buckets", "d1_databases", "durable_objects", "queues", "hyperdrive", "secrets_store_secrets"]) {
    assert.equal(wrangler[key], undefined, `${key} must not be set`);
  }
});

test("the staging password gate runs in the Worker, first", () => {
  const worker = readFileSync(join(root, "custom-worker.ts"), "utf8");
  const gate = worker.indexOf("gateDecision(url");
  assert.ok(gate > 0 && gate < worker.indexOf("isDecodablePath(url") && gate < worker.indexOf("handler.fetch("), "the gate must run before anything else");
  assert.match(worker, /headers\.delete\("Authorization"\)/);
  assert.equal(wrangler.main, "custom-worker.ts");
});

test("static files are served before the Worker", () => {
  assert.equal(wrangler.assets.directory, ".open-next/assets");
  assert.equal(wrangler.assets.run_worker_first, undefined);
});

test("the staging password is sent only on HTTPS requests to the staging host", () => {
  process.env.STAGING_PASSWORD = "test-password-not-real-0000";
  assert.equal(isStaging("https://nevora-store-staging.example.workers.dev/checkout"), true);
  assert.deepEqual(stagingHeaders("https://nevora-store-staging.example.workers.dev/"), { Authorization: `Basic ${Buffer.from("nevora:test-password-not-real-0000").toString("base64")}` });
  for (const url of [
    "http://localhost:8787/",
    "http://nevora-store-staging.example.workers.dev/",
    "https://nevora-store.example.workers.dev/",
    "https://nevora-deploy-test-opennext.example.workers.dev/",
    "https://nevora-store-staging.example.workers.dev.evil.com/",
    "https://evil.com/?https://nevora-store-staging.example.workers.dev/",
    "https://data.gov.in/government-open-data-license-india",
    "not a url",
  ]) {
    assert.deepEqual(stagingHeaders(url), {}, url);
  }
});
