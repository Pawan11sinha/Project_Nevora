// Static checks on the load test SQL. They read the text, and can't prove behaviour.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const strip = (text) => text.replace(/--.*$/gm, "");
const sql = strip(readFileSync(new URL("../../supabase-load-test.sql", import.meta.url), "utf8"));
const rollback = strip(readFileSync(new URL("../../supabase-load-test-rollback.sql", import.meta.url), "utf8"));
const original = strip(readFileSync(new URL("../../supabase-test.sql", import.meta.url), "utf8"));

test("it adds exactly one function, and no tables, views, triggers or policies", () => {
  assert.equal(sql.match(/create or replace function/g).length, 1);
  assert.doesNotMatch(sql, /create (table|view|trigger|policy|index)|alter table|drop /i);
});

test("the function is locked down and callable only when logged in", () => {
  assert.match(sql, /security definer\s+set search_path = ''/);
  assert.match(sql, /revoke all on function public\.deploy_test_load_purchase\(\) from public, anon, authenticated;/);
  assert.match(sql, /grant execute on function public\.deploy_test_load_purchase\(\) to authenticated;/);
  assert.equal(sql.match(/grant /g).length, 1);
  assert.ok(sql.indexOf("revoke all") < sql.indexOf("grant execute"));
});

test("it takes no inputs, so no price can be sent", () => {
  assert.match(sql, /deploy_test_load_purchase\(\)\s+returns boolean/);
});

test("it calls the real purchase function once, then always undoes it", () => {
  assert.equal(sql.match(/public\.deploy_test_take_one\(\)/g).length, 1);
  const call = sql.indexOf("won := public.deploy_test_take_one();");
  const raise = sql.indexOf("raise exception 'deploy_test_load_rollback' using errcode = 'NV001'");
  const handler = sql.indexOf("when sqlstate 'NV001' then");
  assert.ok(call > -1 && raise > call && handler > raise);
  assert.match(sql.slice(handler), /return won;/);
});

// A static check of the handler's structure. Proving this at runtime needs a real database.
test("an unrelated error with the same code is raised again, not swallowed", () => {
  const handler = sql.slice(sql.indexOf("when sqlstate 'NV001' then")).replace(/\s+/g, " ");
  assert.match(
    handler,
    /^when sqlstate 'NV001' then if sqlerrm = 'deploy_test_load_rollback' then return won; end if; raise; end;/,
    "only the exact rollback message may return, and everything else must reach a bare raise",
  );
  assert.equal(sql.match(/return won;/g).length, 1);
  const message = sql.match(/raise exception '([^']+)' using errcode = 'NV001'/)[1];
  assert.equal(message, sql.match(/sqlerrm = '([^']+)'/)[1], "the raised and checked messages must match exactly");
});

test("the call and the undo are in the same inner block, so both are rolled back together", () => {
  const inner = sql.slice(sql.indexOf("begin\n  begin") + "begin\n  begin".length);
  assert.ok(inner.indexOf("won :=") < inner.indexOf("raise exception"));
  assert.ok(inner.indexOf("raise exception") < inner.indexOf("exception\n    when"));
});

test("it has no purchase statements of its own, so it can't drift from the real function", () => {
  assert.doesNotMatch(sql, /\b(update|insert into)\b/i);
});

test("the real purchase function exists and is still granted separately", () => {
  assert.match(original, /create or replace function public\.deploy_test_take_one\(\)/);
  assert.match(original, /grant execute on function public\.deploy_test_take_one\(\) to anon, authenticated;/);
  assert.doesNotMatch(sql, /on function public\.deploy_test_take_one/);
  assert.doesNotMatch(sql, /create or replace function public\.deploy_test_take_one/);
});

test("ownership isn't changed, so it stays with the role that runs the file", () => {
  assert.doesNotMatch(sql, /owner to|set role|security invoker/i);
});

test("guests and PUBLIC can't call it, only logged-in users", () => {
  assert.doesNotMatch(sql, /grant execute[^;]*\b(anon|public)\s*[,;]/i);
  assert.match(sql, /grant execute on function public\.deploy_test_load_purchase\(\) to authenticated;/);
});

test("sequence gaps are documented", () => {
  const raw = readFileSync(new URL("../../supabase-load-test.sql", import.meta.url), "utf8");
  assert.match(raw, /Sequence gaps:/);
  assert.match(raw, /doesn't reclaim sequence values/);
});

test("only its own rollback error is caught, so real errors stay visible", () => {
  assert.equal(sql.match(/exception\s+when/g).length, 1);
  assert.doesNotMatch(sql, /when others/i);
});

test("it has no destructive statements, and no way to keep an order", () => {
  assert.doesNotMatch(sql, /\b(delete from|truncate|commit;)\b/i);
});

test("the rollback removes only this function, and deletes no data", () => {
  assert.equal(rollback.trim(), "drop function if exists public.deploy_test_load_purchase();");
});
