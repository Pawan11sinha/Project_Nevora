// Static safety checks on the test SQL. They don't connect to a database, so they catch omissions
// but can't prove behaviour. tools/supabase-test.mjs tests the real rules against Supabase.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sql = readFileSync(new URL("../../supabase-test.sql", import.meta.url), "utf8");
const rollback = readFileSync(new URL("../../supabase-test-rollback.sql", import.meta.url), "utf8");
const strip = (text) => text.replace(/--.*$/gm, "");
const code = strip(sql);
const rollbackCode = strip(rollback);
const names = (pattern) => [...code.matchAll(pattern)].map((match) => match[1]);

const tables = names(/create table if not exists public\.(\w+)/g);
const functions = names(/create or replace function public\.(\w+)/g);
const views = names(/create or replace view public\.(\w+)/g);
const triggers = names(/create trigger (\w+)/g);

test("the expected objects exist", () => {
  assert.deepEqual(tables, ["deploy_test_profiles", "deploy_test_products", "deploy_test_orders"]);
  assert.equal(functions.length, 5);
  assert.deepEqual(views, ["deploy_test_products_public"]);
  assert.deepEqual(triggers, ["deploy_test_on_signup"]);
});

test("every object is test-prefixed, so nothing else can be affected", () => {
  for (const name of [...tables, ...functions, ...views, ...triggers]) {
    assert.match(name, /^deploy_test_/);
  }
});

test("every table has RLS on, and PUBLIC, anon and authenticated all lose their rights", () => {
  assert.equal(tables.length, 3);
  for (const table of tables) {
    assert.ok(code.includes(`alter table public.${table} enable row level security`), table);
    const revoke = `revoke all on public.${table} from public, anon, authenticated;`;
    assert.equal(code.split(revoke).length - 1, 1, `${table} needs exactly: ${revoke}`);
    const firstGrant = code.search(new RegExp(`grant [^;]* on public\\.${table}\\b`));
    assert.ok(firstGrant === -1 || firstGrant > code.indexOf(revoke), `${table}: revoke must come before any grant`);
  }
});

test("no table revoke leaves out PUBLIC", () => {
  for (const statement of code.match(/revoke all on public\.\w+ from [^;]*;/g)) {
    assert.match(statement, /from public, anon, authenticated;$/, statement);
  }
});

test("the public view can't write through to products", () => {
  assert.match(code, /public\.deploy_test_products_public\s+with \(security_invoker = true\)/);
  assert.ok(code.includes("revoke all on public.deploy_test_products_public from public, anon, authenticated"));
  assert.ok(code.includes("grant select on public.deploy_test_products_public to anon, authenticated"));
  assert.doesNotMatch(code, /grant (insert|update|delete|all)/i);
});

test("cost is never granted", () => {
  for (const grant of code.match(/grant select \([^)]*\)/g)) {
    assert.doesNotMatch(grant, /cost/);
  }
  assert.doesNotMatch(code.match(/create or replace view[\s\S]*?;/)[0], /cost/);
});

test("every function fixes its search_path, and uses schema-qualified names", () => {
  const bodies = code.split("create or replace function").slice(1);
  assert.equal(bodies.length, 5);
  for (const body of bodies) {
    assert.match(body, /security definer\s+set search_path = ''/);
    assert.doesNotMatch(body, /\b(from|update|into)\s+deploy_test_/);
  }
});

test("every function has access removed before it's granted", () => {
  for (const name of functions) {
    const revoke = code.search(new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public, anon, authenticated`));
    assert.notEqual(revoke, -1, name);
    const grant = code.search(new RegExp(`grant execute on function public\\.${name}\\(`));
    if (grant !== -1) assert.ok(grant > revoke, name);
  }
  assert.doesNotMatch(code, /grant execute on function public\.deploy_test_new_user/);
  assert.match(code, /grant execute on function public\.deploy_test_take_one\(\) to anon, authenticated/);
  for (const name of ["deploy_test_is_admin", "deploy_test_admin_set_stock", "deploy_test_admin_set_price"]) {
    assert.match(code, new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to authenticated;`));
  }
});

test("admin functions check the role before changing anything", () => {
  for (const name of ["deploy_test_admin_set_stock", "deploy_test_admin_set_price"]) {
    const body = code.slice(code.indexOf(`function public.${name}`));
    assert.ok(body.indexOf("deploy_test_is_admin()") < body.indexOf("update public.deploy_test_products"), name);
  }
});

test("the stock update rechecks stock in its own WHERE clause", () => {
  assert.match(code, /set stock = stock - 1\s+where id = 1 and stock > 0/);
  assert.match(code, /stock int not null check \(stock >= 0\)/);
});

test("the setup script has no destructive or privileged statements", () => {
  assert.doesNotMatch(code, /\b(drop table|drop schema|truncate|delete from|alter role|set role|service_role|bypassrls)\b/i);
  assert.doesNotMatch(code, /\bdisable row level security\b/i);
});

test("dollar quotes and brackets balance", () => {
  for (const [name, text] of [["setup", code], ["rollback", rollbackCode]]) {
    assert.equal((text.match(/\$\$/g) ?? []).length % 2, 0, name);
    assert.equal((text.match(/\(/g) ?? []).length, (text.match(/\)/g) ?? []).length, name);
  }
});

test("rollback removes every object, with the trigger first and dependants before what they need", () => {
  for (const table of tables) assert.ok(rollbackCode.includes(`drop table if exists public.${table};`), table);
  for (const name of functions) assert.match(rollbackCode, new RegExp(`drop function if exists public\\.${name}\\(`), name);
  for (const view of views) assert.ok(rollbackCode.includes(`drop view if exists public.${view};`), view);
  for (const trigger of triggers) assert.ok(rollbackCode.includes(`drop trigger if exists ${trigger} on auth.users;`), trigger);

  const at = (text) => rollbackCode.indexOf(text);
  assert.equal(at("drop trigger"), rollbackCode.search(/\bdrop\b/));
  assert.ok(at("drop view") < at("drop table if exists public.deploy_test_products;"));
  assert.ok(at("drop table if exists public.deploy_test_orders;") < at("drop table if exists public.deploy_test_products;"));
  assert.ok(at("drop table if exists public.deploy_test_orders;") < at("drop function if exists public.deploy_test_is_admin"));
  assert.ok(at("drop trigger") < at("drop function if exists public.deploy_test_new_user"));
});

test("rollback only touches test objects, and leaves user deletion commented out", () => {
  for (const statement of rollbackCode.match(/\bdrop \w+ if exists \S+/g)) {
    assert.match(statement, /deploy_test_/);
  }
  assert.doesNotMatch(rollbackCode, /delete from/i);
  assert.doesNotMatch(rollbackCode, /\bcascade\b/i);
});
