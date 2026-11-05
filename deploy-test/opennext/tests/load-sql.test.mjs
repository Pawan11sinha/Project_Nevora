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

test("it runs the same statements as the real purchase, then always undoes them", () => {
  const statement = (text) => text.match(/update public\.deploy_test_products\s+set stock = stock - 1[\s\S]*?into price, cost;/)[0].replace(/\s+/g, " ");
  assert.equal(statement(sql), statement(original));
  const insert = sql.indexOf("insert into public.deploy_test_orders");
  const raise = sql.indexOf("raise exception 'deploy_test_load_rollback' using errcode = 'NV001'");
  const handler = sql.indexOf("when sqlstate 'NV001' then");
  assert.ok(insert > -1 && raise > insert && handler > raise);
  assert.match(sql.slice(handler), /return true;/);
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
