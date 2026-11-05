// Tests real Supabase rules directly: logins, roles, RLS, price tampering and last-unit stock.
// Reads opennext/.dev.vars and .env.test, and never prints values from them. Uses test users created in the dashboard, and creates no others unless TEST_SIGNUP_EMAIL is set.
// Usage: node tools/supabase-test.mjs <expected-project-ref>
import { readFileSync } from "node:fs";
import { attemptPurchase, RACE_TIMEOUT_MS, runRace } from "./race.lib.mjs";

const readEnv = (relative) =>
  Object.fromEntries(
    readFileSync(new URL(relative, import.meta.url), "utf8")
      .split("\n")
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()]),
  );
// The Supabase values live in one place, .dev.vars. Test logins live in .env.test.
const env = { ...readEnv("../.env.test"), ...readEnv("../opennext/.dev.vars") };
const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key, TEST_PASSWORD: password, TEST_SIGNUP_EMAIL: signupEmail, TEST_SIGNUP_PASSWORD: signupPassword } = env;
for (const [name, value] of Object.entries({ SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key, TEST_PASSWORD: password })) {
  if (!value) throw new Error(`Fill in ${name}: see deploy-test/README.md`);
}
const expectedRef = process.argv[2];
if (!expectedRef || new URL(url).hostname !== `${expectedRef}.supabase.co`) throw new Error("Pass the expected project ref, and it must match SUPABASE_URL");
for (const [name, value] of Object.entries({ TEST_SIGNUP_EMAIL: signupEmail, TEST_SIGNUP_PASSWORD: signupPassword })) {
  if (!value) throw new Error(`${name} is blank. This script uses the four existing accounts and creates none.`);
}
if (!key.startsWith("sb_publishable_")) throw new Error("Use the publishable key only");

let failed = 0, passed = 0;
class TestFailed extends Error {}
const check = (name, pass, detail = "") => {
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (pass) { passed++; return; }
  failed++;
  throw new TestFailed(name);
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

const logIn = (email, pass = password) => call("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password: pass } });

// Confirm email stays on for this project.
const settings = await call("/auth/v1/settings");
check("Confirm email is on", settings.json?.mailer_autoconfirm === false, `autoconfirm=${settings.json?.mailer_autoconfirm}`);

// These three users are created in the dashboard with "Auto Confirm User". See README.md.
const session = async (label, email) => {
  const result = await logIn(email);
  check(`${label} can log in`, result.status === 200, `status=${result.status} ${result.json?.error_code ?? ""}`);
  return { email, token: result.json?.access_token, id: result.json?.user?.id };
};
const a = await session("customer A", "nevora-test-customer-a@example.com");
const b = await session("customer B", "nevora-test-customer-b@example.com");
const admin = await session("admin", "nevora-test-admin@example.com");
const adminToken = admin.token;
const fourth = await (async () => {
  const result = await logIn(signupEmail, signupPassword);
  check("verified signup account can log in", result.status === 200, `status=${result.status} ${result.json?.error_code ?? ""}`);
  return { token: result.json?.access_token, id: result.json?.user?.id };
})();
check("wrong password rejected", (await logIn(a.email, `${password}x`)).status === 400);


const product = async () => (await call("/rest/v1/deploy_test_products_public?id=eq.1&select=*")).json?.[0];
const denied = (result) => result.status >= 400;

let baseline = 0;
let wins = 0;
const label = (id) => ({ [a.id]: "customer A", [b.id]: "customer B", [admin.id]: "admin", [fourth.id]: "verified signup" })[id] ?? (id === null ? "guest" : "unknown");
const allOrders = async () => (await call("/rest/v1/deploy_test_orders?select=id,user_id,product_id,unit_price_paise,created_at&order=id.asc", { token: adminToken })).json;

try {
baseline = (await allOrders())?.length ?? 0;
check("existing orders match the expected baseline of 5", baseline === 5, `orders=${baseline}`);

// Start from known values, so any unwanted change is visible.
const START_PRICE = 19900;
await rpc("deploy_test_admin_set_price", adminToken, { new_price: START_PRICE });
await rpc("deploy_test_admin_set_stock", adminToken, { new_stock: 5 });

// Profiles and roles
const ownProfile = await call(`/rest/v1/deploy_test_profiles?id=eq.${a.id}&select=id,role`, { token: a.token });
check("customer can read own profile", ownProfile.status === 200 && ownProfile.json?.length === 1);
check("new user gets the customer role", ownProfile.json?.[0]?.role === "customer", `role=${ownProfile.json?.[0]?.role}`);
check("customer isn't admin", (await rpc("deploy_test_is_admin", a.token)).json === false);
check("admin is admin", (await rpc("deploy_test_is_admin", adminToken)).json === true);
check("guest can't call the admin check", denied(await rpc("deploy_test_is_admin")));
const raise = await call(`/rest/v1/deploy_test_profiles?id=eq.${a.id}`, { token: a.token, method: "PATCH", body: { role: "admin" } });
check("customer can't raise own role", denied(raise) && (await rpc("deploy_test_is_admin", a.token)).json === false, `status=${raise.status}`);
check("customer can't create a profile", denied(await call("/rest/v1/deploy_test_profiles", { token: a.token, method: "POST", body: { id: a.id, role: "admin" } })));
check("customer can't delete a profile", denied(await call(`/rest/v1/deploy_test_profiles?id=eq.${a.id}`, { token: a.token, method: "DELETE" })));
const otherProfile = await call(`/rest/v1/deploy_test_profiles?id=eq.${b.id}&select=id`, { token: a.token });
check("customer can't read another profile", Array.isArray(otherProfile.json) && otherProfile.json.length === 0, `rows=${otherProfile.json?.length}`);
const allProfiles = await call("/rest/v1/deploy_test_profiles?select=id", { token: a.token });
check("customer listing profiles sees only their own", allProfiles.json?.length === 1 && allProfiles.json[0].id === a.id, `rows=${allProfiles.json?.length}`);
const guestProfiles = await call("/rest/v1/deploy_test_profiles?select=id");
check("guest can't read profiles", denied(guestProfiles), `status=${guestProfiles.status}`);
check("guest can't change a role", denied(await call(`/rest/v1/deploy_test_profiles?id=eq.${a.id}`, { method: "PATCH", body: { role: "admin" } })));

// Products: reading
const publicView = await call("/rest/v1/deploy_test_products_public?select=*");
check("guest can read the public view", publicView.status === 200 && publicView.json?.length >= 1);
check("public view hides cost", publicView.json?.[0] && !("cost_paise" in publicView.json[0]));

// Products: price and stock protection, through both the view and the table
const before = await product();
for (const [who, token] of [["guest", undefined], ["customer", a.token]]) {
  for (const [kind, path] of [["public view", "deploy_test_products_public"], ["table", "deploy_test_products"]]) {
    const update = await call(`/rest/v1/${path}?id=eq.1`, { token, method: "PATCH", body: { price_paise: 100, stock: 999 } });
    check(`${who} can't update through the ${kind}`, denied(update), `status=${update.status}`);
    const insert = await call(`/rest/v1/${path}`, { token, method: "POST", body: { id: 2, name: "forged", price_paise: 100, stock: 1 } });
    check(`${who} can't insert through the ${kind}`, denied(insert), `status=${insert.status}`);
    const remove = await call(`/rest/v1/${path}?id=eq.1`, { token, method: "DELETE" });
    check(`${who} can't delete through the ${kind}`, denied(remove), `status=${remove.status}`);
  }
  const cost = await call("/rest/v1/deploy_test_products?select=cost_paise", { token });
  check(`${who} can't read cost from the table`, denied(cost), `status=${cost.status}`);
  const everything = await call("/rest/v1/deploy_test_products?select=*", { token });
  check(`${who} can't select all table columns`, denied(everything), `status=${everything.status}`);
  check(`${who} can't use the admin price function`, denied(await rpc("deploy_test_admin_set_price", token, { new_price: 100 })));
  check(`${who} can't use the admin stock function`, denied(await rpc("deploy_test_admin_set_stock", token, { new_stock: 999 })));
}
const after = await product();
check("price unchanged after all attempts", after?.price_paise === before?.price_paise, `${before?.price_paise} -> ${after?.price_paise}`);
check("stock unchanged after all attempts", after?.stock === before?.stock, `${before?.stock} -> ${after?.stock}`);
check("product still exists, and no forged product added", (await call("/rest/v1/deploy_test_products_public?select=id")).json?.length === 1);

// Admin product management
check("admin can change a price", (await rpc("deploy_test_admin_set_price", adminToken, { new_price: 20900 })).status < 300);
check("price change is visible", (await product())?.price_paise === 20900);
check("admin can change stock", (await rpc("deploy_test_admin_set_stock", adminToken, { new_stock: 7 })).status < 300 && (await product())?.stock === 7);
check("zero price rejected, even for admin", denied(await rpc("deploy_test_admin_set_price", adminToken, { new_price: 0 })));
check("negative stock rejected, even for admin", denied(await rpc("deploy_test_admin_set_stock", adminToken, { new_stock: -1 })));
check("admin can't bypass functions to edit the table", denied(await call("/rest/v1/deploy_test_products?id=eq.1", { token: adminToken, method: "PATCH", body: { price_paise: 100 } })));

// Orders: price comes from the database
await rpc("deploy_test_admin_set_price", adminToken, { new_price: START_PRICE });
await rpc("deploy_test_admin_set_stock", adminToken, { new_stock: 4 });
check("purchase can't send a price", denied(await rpc("deploy_test_take_one", a.token, { price: 1 })));
check("customer A buys", (await rpc("deploy_test_take_one", a.token)).json === true);
wins++;
check("customer B buys", (await rpc("deploy_test_take_one", b.token)).json === true);
wins++;
check("guest buys", (await rpc("deploy_test_take_one")).json === true);
wins++;
check("stock after 3 purchases is 1", (await product())?.stock === 1, `stock=${(await product())?.stock}`);

// Orders: who can see what
const ordersA = await call("/rest/v1/deploy_test_orders?select=user_id,unit_price_paise", { token: a.token });
check("customer A sees own order", ordersA.status === 200 && ordersA.json.length >= 1, `rows=${ordersA.json?.length}`);
check("customer A sees only own orders", ordersA.json?.every((o) => o.user_id === a.id));
check("order price came from the database", ordersA.json?.at(-1)?.unit_price_paise === START_PRICE, `price=${ordersA.json?.at(-1)?.unit_price_paise}`);
const aAsksForB = await call(`/rest/v1/deploy_test_orders?user_id=eq.${b.id}&select=id`, { token: a.token });
check("customer A can't read customer B's orders", aAsksForB.status === 200 && aAsksForB.json.length === 0, `rows=${aAsksForB.json?.length}`);
const ordersB = await call("/rest/v1/deploy_test_orders?select=user_id", { token: b.token });
check("customer B sees only own orders", ordersB.json?.length >= 1 && ordersB.json.every((o) => o.user_id === b.id));
const guestOrders = await call("/rest/v1/deploy_test_orders?user_id=is.null&select=id", { token: a.token });
check("customer can't read guest orders", guestOrders.json?.length === 0, `rows=${guestOrders.json?.length}`);
check("guest can't read orders", denied(await call("/rest/v1/deploy_test_orders?select=id")));
const adminOrders = await call("/rest/v1/deploy_test_orders?select=user_id&order=id.asc", { token: adminToken });
const seen = new Set(adminOrders.json?.map((o) => o.user_id));
check("admin can read all orders", adminOrders.status === 200 && seen.has(a.id) && seen.has(b.id) && seen.has(null), `rows=${adminOrders.json?.length}`);
for (const [who, token] of [["customer", a.token], ["admin", adminToken]]) {
  check(`${who} can't read order cost`, denied(await call("/rest/v1/deploy_test_orders?select=unit_cost_paise", { token })));
  check(`${who} can't select all order columns`, denied(await call("/rest/v1/deploy_test_orders?select=*", { token })));
  check(`${who} can't insert an order directly`, denied(await call("/rest/v1/deploy_test_orders", { token, method: "POST", body: { user_id: a.id, product_id: 1, unit_price_paise: 1, unit_cost_paise: 0 } })));
  check(`${who} can't change an order`, denied(await call(`/rest/v1/deploy_test_orders?user_id=eq.${a.id}`, { token, method: "PATCH", body: { unit_price_paise: 1 } })));
  check(`${who} can't delete an order`, denied(await call(`/rest/v1/deploy_test_orders?user_id=eq.${a.id}`, { token, method: "DELETE" })));
}
check("forged token rejected", denied(await rpc("deploy_test_is_admin", "not.a.token")));

// Stock races. Every request completes and none is retried, and the product isn't restored until
// all have finished. Buyer counts are fixed.
const raceAttempt = (token) =>
  attemptPurchase({
    url: `${url}/rest/v1/rpc/deploy_test_take_one`,
    headers: { apikey: key, "content-type": "application/json", authorization: `Bearer ${token}` },
  });
const race = async (title, buyers, availableStock, tokenFor) => {
  await rpc("deploy_test_admin_set_stock", adminToken, { new_stock: availableStock });
  const started = performance.now();
  const result = await runRace({ buyers, availableStock, attempt: (i) => raceAttempt(tokenFor(i)) });
  wins += result.wins;
  const stock = (await product())?.stock;
  console.log(`NOTE  ${title}: ${Math.round(performance.now() - started)} ms, timeout ${RACE_TIMEOUT_MS} ms per request`);
  for (const [detail, times] of Object.entries(result.errors)) console.log(`ERROR ${title}: ${times} x ${detail}`);
  check(
    `${title}: every request valid, exactly ${availableStock} sold, stock 0`,
    result.pass && stock === 0,
    `completed=${result.completed} wins=${result.wins} losses=${result.losses} invalid=${result.invalid} network=${result.network} stock=${stock}`,
  );
};
await race("20 buyers, 1 unit", 20, 1, (i) => (i % 2 ? a.token : b.token));
await race("100 buyers, 1 unit", 100, 1, (i) => (i % 2 ? a.token : b.token));
await race("30 buyers, 3 units", 30, 3, () => a.token);
check("sold-out purchase returns false", (await rpc("deploy_test_take_one", b.token)).json === false);

// The fourth account, verified by real email
const fourthOrders = await call("/rest/v1/deploy_test_orders?select=id", { token: fourth.token });
check("verified signup account sees no other orders", fourthOrders.status === 200 && fourthOrders.json.length === 0, `rows=${fourthOrders.json?.length}`);
const fourthRole = await call(`/rest/v1/deploy_test_profiles?id=eq.${fourth.id}&select=role`, { token: fourth.token });
check("verified signup account is still a customer", fourthRole.json?.[0]?.role === "customer", `role=${fourthRole.json?.[0]?.role}`);
check("verified signup account can't use admin functions", denied(await rpc("deploy_test_admin_set_price", fourth.token, { new_price: 100 })));

// Every sale matches an order, at the database's price
const orders = await allOrders();
check("orders created equal purchases won", orders.length - baseline === wins, `orders=${orders.length - baseline} wins=${wins}`);
check("exactly 8 new orders: 3 single purchases plus race wins of 1, 1 and 3", orders.length - baseline === 8, `new=${orders.length - baseline}`);
check("every order has the database's price", orders.every((o) => o.unit_price_paise === START_PRICE));
check("Confirm email is still on", (await call("/auth/v1/settings")).json?.mailer_autoconfirm === false);
} catch (error) {
  if (!(error instanceof TestFailed)) {
    failed++;
    console.log(`FAIL  Unexpected script error: ${error.message}`);
  }
  console.log("\nSTOPPED at the first failure. No later tests ran.");
} finally {
  // Restore the test product whatever happened, then report the final state.
  const price = await rpc("deploy_test_admin_set_price", adminToken, { new_price: 19900 });
  const stock = await rpc("deploy_test_admin_set_stock", adminToken, { new_stock: 1 });
  const final = await product();
  console.log(`\nRestore: price call ${price.status}, stock call ${stock.status}`);
  console.log(`Final product: ${JSON.stringify(final)}`);
  const restored = final?.price_paise === 19900 && final?.stock === 1;
  console.log(`${restored ? "PASS" : "FAIL"}  product restored to 19900 paise and 1 unit`);
  if (restored) passed++; else failed++;

  const orders = (await allOrders()) ?? [];
  const byBuyer = orders.reduce((m, o) => { const k = label(o.user_id); m[k] = (m[k] ?? 0) + 1; return m; }, {});
  console.log(`Orders in total: ${orders.length} (baseline ${baseline}, new ${orders.length - baseline}), by buyer: ${JSON.stringify(byBuyer)}`);
  for (const o of orders) console.log(`  order ${o.id}: ${label(o.user_id)}, product ${o.product_id}, ${o.unit_price_paise} paise, ${o.created_at}`);
  console.log(`\nPassed ${passed}, failed ${failed}`);
}
process.exit(failed ? 1 : 0);
