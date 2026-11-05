// Tests real Supabase rules directly: signup, roles, RLS, price tampering and last-unit stock.
// Reads deploy-test/.env.test and never prints values from it. Creates only throwaway test users.
// Usage: node tools/supabase-test.mjs
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.test", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()]),
);
const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key, TEST_ADMIN_EMAIL: adminEmail, TEST_ADMIN_PASSWORD: adminPassword } = env;
for (const [name, value] of Object.entries({ SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key, TEST_ADMIN_EMAIL: adminEmail, TEST_ADMIN_PASSWORD: adminPassword })) {
  if (!value) throw new Error(`Fill in ${name} in deploy-test/.env.test`);
}

let failed = 0;
const check = (name, pass, detail = "") => {
  if (!pass) failed++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const call = async (path, { token, method = "GET", body, headers = {} } = {}) => {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: { apikey: key, "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: response.status, json };
};
const rpc = (name, token, body = {}) => call(`/rest/v1/rpc/${name}`, { token, method: "POST", body });

async function signUp(label) {
  const email = `nevora-test-${label}-${randomBytes(4).toString("hex")}@example.com`;
  const password = randomBytes(18).toString("base64url");
  const result = await call("/auth/v1/signup", { method: "POST", body: { email, password, data: { role: "admin" } } });
  return { email, password, result, token: result.json?.access_token, id: result.json?.user?.id ?? result.json?.id };
}
const logIn = (email, password) => call("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });

// Signup and login
const a = await signUp("a");
const b = await signUp("b");
check("real signup works", a.result.status === 200 && Boolean(a.id), `status=${a.result.status} ${a.result.json?.error_code ?? a.result.json?.code ?? ""}`);
check("signup gives a session (Confirm email off)", Boolean(a.token) && Boolean(b.token), a.token ? "" : "turn off Confirm email for this test project");
const admin = await logIn(adminEmail, adminPassword);
check("admin login works", admin.status === 200, `status=${admin.status}`);
const adminToken = admin.json?.access_token;
check("wrong password rejected", (await logIn(adminEmail, `${adminPassword}x`)).status === 400);

if (!a.token || !b.token || !adminToken) {
  console.log("\nStopping: the remaining tests need working logins.");
  process.exit(1);
}

// Roles
const profileA = await call(`/rest/v1/deploy_test_profiles?id=eq.${a.id}&select=role`, { token: a.token });
check("signup metadata can't grant admin", profileA.json?.[0]?.role === "customer", `role=${profileA.json?.[0]?.role}`);
check("customer isn't admin", (await rpc("deploy_test_is_admin", a.token)).json === false);
check("admin is admin", (await rpc("deploy_test_is_admin", adminToken)).json === true);
const raise = await call(`/rest/v1/deploy_test_profiles?id=eq.${a.id}`, { token: a.token, method: "PATCH", body: { role: "admin" }, headers: { prefer: "return=representation" } });
check("customer can't raise own role", raise.status >= 400 && (await rpc("deploy_test_is_admin", a.token)).json === false, `status=${raise.status}`);
const otherProfile = await call(`/rest/v1/deploy_test_profiles?id=eq.${b.id}&select=id`, { token: a.token });
check("customer can't read another profile", Array.isArray(otherProfile.json) && otherProfile.json.length === 0, `rows=${otherProfile.json?.length}`);
const anonProfiles = await call("/rest/v1/deploy_test_profiles?select=id");
check("guest can't read profiles", anonProfiles.status >= 400 || anonProfiles.json?.length === 0, `status=${anonProfiles.status}`);

// Products
const publicView = await call("/rest/v1/deploy_test_products_public?select=*");
check("guest can read public product view", publicView.status === 200 && publicView.json?.length >= 1);
check("public view hides cost", publicView.json?.[0] && !("cost_paise" in publicView.json[0]));
for (const [who, token] of [["guest", undefined], ["customer", a.token]]) {
  const table = await call("/rest/v1/deploy_test_products?select=cost_paise", { token });
  check(`${who} can't read cost from the table`, table.status >= 400, `status=${table.status}`);
  const write = await call("/rest/v1/deploy_test_products?id=eq.1", { token, method: "PATCH", body: { price_paise: 100 } });
  check(`${who} can't change a price directly`, write.status >= 400, `status=${write.status}`);
}
check("guest can't use admin price function", (await rpc("deploy_test_admin_set_price", undefined, { new_price: 100 })).status >= 400);
check("customer can't use admin price function", (await rpc("deploy_test_admin_set_price", a.token, { new_price: 100 })).status >= 400);
check("admin can change a price", (await rpc("deploy_test_admin_set_price", adminToken, { new_price: 20900 })).status < 300);
const newPrice = await call("/rest/v1/deploy_test_products_public?id=eq.1&select=price_paise");
check("price change is visible", newPrice.json?.[0]?.price_paise === 20900, `price=${newPrice.json?.[0]?.price_paise}`);

// Last unit, directly against the database
for (const [label, count] of [["20 competing buyers", 20], ["100 competing buyers", 100]]) {
  await rpc("deploy_test_admin_set_stock", adminToken, { new_stock: 1 });
  const results = await Promise.all(Array.from({ length: count }, (_, i) => rpc("deploy_test_take_one", i % 2 ? a.token : b.token)));
  const wins = results.filter((r) => r.json === true).length;
  const losses = results.filter((r) => r.json === false).length;
  const stock = (await call("/rest/v1/deploy_test_products_public?id=eq.1&select=stock")).json?.[0]?.stock;
  check(`${label}: exactly one wins`, wins === 1 && losses === count - 1 && stock === 0, `wins=${wins} losses=${losses} stock=${stock}`);
}
await rpc("deploy_test_admin_set_stock", adminToken, { new_stock: 3 });
const multi = await Promise.all(Array.from({ length: 30 }, () => rpc("deploy_test_take_one", a.token)));
check("3 units, 30 buyers: exactly three win", multi.filter((r) => r.json === true).length === 3);

// Orders
const ordersA = await call("/rest/v1/deploy_test_orders?select=user_id", { token: a.token });
check("customer sees only own orders", ordersA.status === 200 && ordersA.json.every((o) => o.user_id === a.id), `rows=${ordersA.json?.length}`);
const costA = await call("/rest/v1/deploy_test_orders?select=unit_cost_paise", { token: a.token });
check("customer can't read order cost", costA.status >= 400, `status=${costA.status}`);
check("guest can't read orders", (await call("/rest/v1/deploy_test_orders?select=id")).status >= 400);
const forged = await call("/rest/v1/deploy_test_orders", { token: a.token, method: "POST", body: { user_id: a.id, product_id: 1, unit_price_paise: 1, unit_cost_paise: 0 } });
check("customer can't insert an order directly", forged.status >= 400, `status=${forged.status}`);
check("forged token rejected", (await rpc("deploy_test_is_admin", "not.a.token")).status >= 400);

await rpc("deploy_test_admin_set_price", adminToken, { new_price: 19900 });
await rpc("deploy_test_admin_set_stock", adminToken, { new_stock: 1 });
console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
