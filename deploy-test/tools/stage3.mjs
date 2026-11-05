// Stage 3: real login, sessions, permissions and purchases through the app, on a local Worker.
// Uses the four existing accounts. Has no signup path for valid details. Stops at the first failure.
// Always restores the product. Prints no passwords, tokens, keys or cookie values.
// Usage: node tools/stage3.mjs <expected-project-ref> <base-url>
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { RACE_TIMEOUT_MS, runRace } from "./race.lib.mjs";

const [expectedRef, baseArg] = process.argv.slice(2);
const base = baseArg?.replace(/\/$/, "");
const readEnv = (relative) =>
  Object.fromEntries(
    readFileSync(new URL(relative, import.meta.url), "utf8")
      .split("\n")
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()]),
  );
const env = { ...readEnv("../.env.test"), ...readEnv("../opennext/.dev.vars") };
const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key, TEST_PASSWORD: password, DEPLOY_TEST_TOKEN: testToken } = env;
if (!expectedRef || !base) throw new Error("Usage: stage3.mjs <expected-project-ref> <base-url>");
if (new URL(url).hostname !== `${expectedRef}.supabase.co`) throw new Error("Project ref doesn't match");
if (!key?.startsWith("sb_publishable_")) throw new Error("Use the publishable key only");
if (!password || !testToken) throw new Error("A required value is blank");
if (!/^http:\/\/localhost:\d+$/.test(base)) throw new Error("Stage 3 only runs against a local Worker");

const EMAILS = {
  a: "nevora-test-customer-a@example.com",
  b: "nevora-test-customer-b@example.com",
  admin: "nevora-test-admin@example.com",
};
const COOKIE = `sb-${expectedRef}-auth-token`;
const hash = (text) => createHash("sha256").update(text ?? "").digest("hex").slice(0, 12);

let passed = 0, failed = 0;
class TestFailed extends Error {}
const check = (name, pass, detail = "") => {
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (pass) { passed++; return; }
  failed++;
  throw new TestFailed(name);
};
const section = (title) => console.log(`\n--- ${title}`);

// Direct Supabase calls, used only for setup, reading results and restoring.
const call = async (path, { token, method = "GET", body } = {}) => {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: { apikey: key, "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: response.status, json };
};
const logIn = async (email) => {
  const result = await call("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
  return { status: result.status, token: result.json?.access_token, id: result.json?.user?.id };
};
const product = async () => (await call("/rest/v1/deploy_test_products_public?id=eq.1&select=price_paise,stock")).json?.[0];

// The session cookie, read and rewritten only inside the test browser.
const authCookies = async (context) =>
  (await context.cookies()).filter((c) => c.name === COOKIE || c.name.startsWith(`${COOKIE}.`));
const readSession = (cookies) => {
  const joined = [...cookies]
    .sort((x, y) => Number(x.name.split(".").pop()) - Number(y.name.split(".").pop()))
    .map((c) => c.value)
    .join("");
  return JSON.parse(Buffer.from(joined.replace(/^base64-/, ""), "base64url").toString());
};
const nearExpiryCookies = (cookies) => {
  const session = readSession(cookies);
  session.expires_at = Math.floor(Date.now() / 1000) + 30;
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  const chunks = value.match(/.{1,3180}/g);
  return chunks.map((chunk, i) => ({
    name: chunks.length === 1 ? COOKIE : `${COOKIE}.${i}`,
    value: chunk,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  }));
};
const headerFrom = (cookies) => cookies.map((c) => `${c.name}=${c.value}`).join("; ");

const browser = await chromium.launch({ channel: "chrome", headless: true });
const newContext = () => browser.newContext({ viewport: { width: 360, height: 740 } });
const logInThroughForm = async (page, path, email, pass = password) => {
  await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', pass);
  await page.getByRole("button", { name: "Log in" }).click();
};
const compare = async (cookieHeader) =>
  (await fetch(`${base}/api/auth-compare`, { headers: { cookie: cookieHeader, "x-test-token": testToken } })).json();

let users, adminToken, baseline = null, seenOrders = 0;
const labelFor = (id) => ({ [users.a.id]: "customer A", [users.b.id]: "customer B", [users.admin.id]: "admin" })[id] ?? (id === null ? "guest" : "other");
const allOrders = async () =>
  (await call("/rest/v1/deploy_test_orders?select=id,user_id,unit_price_paise,created_at&order=id.asc", { token: adminToken })).json ?? [];
const recordOrders = async (step) => {
  const orders = await allOrders();
  const fresh = orders.slice(seenOrders);
  seenOrders = orders.length;
  console.log(`ORDERS ${step}: ${fresh.length} new${fresh.length ? ` -> ${fresh.map((o) => `order ${o.id} (${labelFor(o.user_id)}, ${o.unit_price_paise} paise)`).join("; ")}` : ""}`);
  return fresh;
};

try {
  section("Before testing");
  const settings = await call("/auth/v1/settings");
  check("Confirm email is on", settings.json?.mailer_autoconfirm === false);
  users = { a: await logIn(EMAILS.a), b: await logIn(EMAILS.b), admin: await logIn(EMAILS.admin) };
  check("three test accounts log in directly", users.a.token && users.b.token && users.admin.token ? true : false);
  adminToken = users.admin.token;
  const start = await allOrders();
  baseline = start.length;
  seenOrders = baseline;
  console.log(`RECORD orders before testing: ${baseline}`);
  console.log("RECORD users before testing: 4, from the owner's last dashboard query. This script can't read the user count.");
  const startProduct = await product();
  console.log(`RECORD product before testing: ${JSON.stringify(startProduct)}`);
  check("product starts at 19900 paise and 1 unit", startProduct?.price_paise === 19900 && startProduct?.stock === 1);

  section("Phase B: real login and sessions");
  const contextA = await newContext();
  const pageA = await contextA.newPage();
  await logInThroughForm(pageA, "/login", EMAILS.a);
  await pageA.waitForURL("**/account", { timeout: 15000 }).catch(() => {});
  check("customer logs in through the form", await pageA.getByTestId("session").isVisible().catch(() => false), new URL(pageA.url()).pathname);
  const cookiesA = await authCookies(contextA);
  check("session cookie exists", cookiesA.length > 0, `parts=${cookiesA.length}`);
  check("session cookie is HttpOnly", cookiesA.every((c) => c.httpOnly));
  check("session cookie is Secure", cookiesA.every((c) => c.secure));
  check("session cookie is SameSite=Lax", cookiesA.every((c) => c.sameSite === "Lax"));
  check("page scripts can't read the session", !(await pageA.evaluate(() => document.cookie)).includes("auth-token"));

  const wrong = await (await newContext()).newPage();
  await logInThroughForm(wrong, "/login", EMAILS.a, `${password}x`);
  await wrong.getByTestId("login-result").filter({ hasText: "Login failed" }).waitFor({ timeout: 10000 }).catch(() => {});
  check("wrong password shows a generic error", (await wrong.getByTestId("login-result").textContent()) === "Login failed");
  check("wrong password creates no session", (await authCookies(wrong.context())).length === 0);

  for (const [name, email, pass] of [["bad email", "not-an-email", "longenough1"], ["short password", "nevora-test-invalid@example.com", "short"]]) {
    const page = await (await newContext()).newPage();
    await page.goto(`${base}/signup`, { waitUntil: "networkidle" });
    await page.evaluate(() => { document.querySelector("form").noValidate = true; });
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', pass);
    await page.getByRole("button", { name: "Sign up" }).click();
    await page.getByTestId("signup-result").filter({ hasText: "Check your email and password" }).waitFor({ timeout: 10000 }).catch(() => {});
    check(`signup rejects ${name} before calling Supabase`, (await page.getByTestId("signup-result").textContent()) === "Check your email and password");
  }

  const forged = await newContext();
  await forged.addCookies([{ name: COOKIE, value: "base64-eyJ0YW1wZXJlZCI6dHJ1ZX0", domain: "localhost", path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
  const forgedPage = await forged.newPage();
  await forgedPage.goto(`${base}/account`, { waitUntil: "networkidle" });
  check("forged cookie is sent to login", new URL(forgedPage.url()).pathname === "/login", new URL(forgedPage.url()).pathname);
  const forgedAdmin = await forged.newPage();
  await forgedAdmin.goto(`${base}/admin`, { waitUntil: "networkidle" });
  check("forged cookie can't open admin", new URL(forgedAdmin.url()).pathname === "/admin/login", new URL(forgedAdmin.url()).pathname);

  section("Phase C: token refresh");
  const contextR = await newContext();
  const pageR = await contextR.newPage();
  await logInThroughForm(pageR, "/login", EMAILS.a);
  await pageR.waitForURL("**/account", { timeout: 15000 }).catch(() => {});
  const beforeRefresh = await authCookies(contextR);
  const tokenBefore = hash(readSession(beforeRefresh).access_token);
  await contextR.clearCookies();
  await contextR.addCookies(nearExpiryCookies(beforeRefresh));
  await pageR.goto(`${base}/account`, { waitUntil: "networkidle" });
  check("near-expiry session stays logged in", await pageR.getByTestId("session").isVisible().catch(() => false), new URL(pageR.url()).pathname);
  const afterRefresh = readSession(await authCookies(contextR));
  check("token was refreshed and saved", hash(afterRefresh.access_token) !== tokenBefore);
  check("new expiry is well in the future", afterRefresh.expires_at - Date.now() / 1000 > 600, `seconds=${Math.round(afterRefresh.expires_at - Date.now() / 1000)}`);
  await pageR.goto(`${base}/account`, { waitUntil: "networkidle" });
  check("next page view works with the new token", await pageR.getByTestId("session").isVisible().catch(() => false));
  check("refreshed cookie is still HttpOnly and Secure", (await authCookies(contextR)).every((c) => c.httpOnly && c.secure));

  const contextP = await newContext();
  const pageP = await contextP.newPage();
  await logInThroughForm(pageP, "/login", EMAILS.a);
  await pageP.waitForURL("**/account", { timeout: 15000 }).catch(() => {});
  const nearCookie = headerFrom(nearExpiryCookies(await authCookies(contextP)));
  const parallel = await Promise.all(
    Array.from({ length: 5 }, () => fetch(`${base}/account`, { redirect: "manual", headers: { cookie: nearCookie } })),
  );
  const statuses = parallel.map((r) => r.status);
  await Promise.all(parallel.map((r) => r.arrayBuffer()));
  check("5 parallel requests near expiry all succeed", statuses.every((s) => s === 200), `statuses=${statuses.join(",")}`);
  const refreshed = parallel.map((r) => r.headers.getSetCookie().filter((c) => c.startsWith(COOKIE) && !/max-age=0/i.test(c)));
  console.log(`NOTE  parallel responses that saved a new session: ${refreshed.filter((c) => c.length).length} of 5`);
  for (const [i, setCookies] of refreshed.entries()) {
    if (!setCookies.length) continue;
    const header = setCookies.map((c) => c.split(";")[0]).join("; ");
    const follow = await fetch(`${base}/account`, { redirect: "manual", headers: { cookie: header } });
    await follow.arrayBuffer();
    check(`session from parallel response ${i + 1} still works`, follow.status === 200, `status=${follow.status}`);
  }

  section("Phase D: permissions through the app");
  const customerAdmin = await contextA.newPage();
  await customerAdmin.goto(`${base}/admin`, { waitUntil: "networkidle" });
  check("customer is denied at /admin", await customerAdmin.getByTestId("admin-denied").isVisible().catch(() => false));
  check("customer sees no admin data", !(await customerAdmin.getByTestId("admin-ok").isVisible().catch(() => false)) && !(await customerAdmin.content()).includes("in stock"));

  const contextAdmin = await newContext();
  const pageAdmin = await contextAdmin.newPage();
  await logInThroughForm(pageAdmin, "/admin/login", EMAILS.admin);
  await pageAdmin.waitForURL("**/admin", { timeout: 15000 }).catch(() => {});
  check("admin reaches the admin area", await pageAdmin.getByTestId("admin-ok").isVisible().catch(() => false));
  const shownCount = await pageAdmin.getByTestId("admin-order-count").textContent();
  check("admin sees all orders", shownCount === `${baseline} orders`, shownCount);
  check("admin sees the product", (await pageAdmin.getByTestId("admin-product").textContent()).includes("19900 paise, 1 in stock"));
  check("admin page shows no cost", !(await pageAdmin.content()).includes("6500"));

  const ordersNow = await allOrders();
  const ownOrder = ordersNow.find((o) => o.user_id === users.a.id);
  const otherOrder = ordersNow.find((o) => o.user_id === users.b.id);
  const guestOrder = ordersNow.find((o) => o.user_id === null);
  const ownPage = await contextA.newPage();
  await ownPage.goto(`${base}/account/orders/${ownOrder.id}`, { waitUntil: "networkidle" });
  check("customer A can open their own order", await ownPage.getByTestId("order").isVisible().catch(() => false));
  check("order page shows no cost", !(await ownPage.content()).includes("6500"));
  for (const [who, order] of [["customer B's", otherOrder], ["a guest's", guestOrder]]) {
    const page = await contextA.newPage();
    const response = await page.goto(`${base}/account/orders/${order.id}`, { waitUntil: "networkidle" });
    check(`customer A gets 404 for ${who} order`, response.status() === 404 && !(await page.getByTestId("order").isVisible().catch(() => false)), `status=${response.status()}`);
  }
  const listed = await contextA.newPage();
  await listed.goto(`${base}/account`, { waitUntil: "networkidle" });
  const listedText = await listed.getByTestId("orders").textContent();
  const expectedOwn = ordersNow.filter((o) => o.user_id === users.a.id).map((o) => o.id);
  check("account lists only customer A's orders", expectedOwn.every((id) => listedText.includes(`Order ${id}:`)) && !listedText.includes(`Order ${otherOrder.id}:`), `count=${expectedOwn.length}`);

  const guest = await newContext();
  for (const path of ["/account", `/account/orders/${ownOrder.id}`]) {
    const page = await guest.newPage();
    await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
    check(`guest at ${path.replace(/\d+$/, "[id]")} is sent to login`, new URL(page.url()).pathname === "/login");
  }
  const live = await guest.newPage();
  await live.goto(`${base}/products-live`, { waitUntil: "networkidle" });
  const liveText = await live.getByTestId("live-products").textContent();
  check("public page shows live price and stock", liveText.includes("19900 paise") && liveText.includes("1 in stock"), liveText.trim().slice(0, 60));
  check("public page shows no cost", !(await live.content()).includes("6500"));

  const cached = await fetch(`${base}/c/earrings`, { headers: { cookie: headerFrom(await authCookies(contextA)) } });
  await cached.arrayBuffer();
  check("cached public page sets no cookie for a logged-in user", cached.status === 200 && cached.headers.getSetCookie().length === 0);

  section("Phase E: purchases through the app");
  const buy = async (page) => {
    const previous = await page.getByTestId("buy-result").textContent();
    const count = (await allOrders()).length;
    await page.getByRole("button", { name: "Buy sample product" }).click();
    await page.waitForFunction(() => !document.querySelector("form button").disabled);
    await page.waitForTimeout(800);
    return { previous, count, result: await page.getByTestId("buy-result").textContent() };
  };
  const checkout = await contextA.newPage();
  await checkout.goto(`${base}/checkout-test`, { waitUntil: "networkidle" });
  const first = await buy(checkout);
  check("customer A buys through the app", first.result === "Purchased", first.result);
  const firstOrders = await recordOrders("checkout purchase");
  check("exactly one order, for customer A, at 19900 paise", firstOrders.length === 1 && firstOrders[0].user_id === users.a.id && firstOrders[0].unit_price_paise === 19900);
  check("stock fell to 0", (await product())?.stock === 0);

  const soldOut = await buy(checkout);
  check("buying when sold out says so", soldOut.result === "Sold out", soldOut.result);
  check("sold-out attempt creates no order", (await recordOrders("sold-out attempt")).length === 0);

  const stock1 = await call("/rest/v1/rpc/deploy_test_admin_set_stock", { token: adminToken, method: "POST", body: { new_stock: 1 } });
  check("admin sets stock to 1 for the forged price test", stock1.status < 300);
  const tamper = await contextA.newPage();
  await tamper.goto(`${base}/checkout-test`, { waitUntil: "networkidle" });
  await tamper.evaluate(() => {
    for (const [name, value] of [["price", "1"], ["price_paise", "1"], ["unit_price_paise", "1"]]) {
      const input = document.createElement("input");
      input.type = "hidden"; input.name = name; input.value = value;
      document.querySelector("form").appendChild(input);
    }
  });
  const forgedBuy = await buy(tamper);
  check("purchase with forged price fields completes", forgedBuy.result === "Purchased", forgedBuy.result);
  const forgedOrders = await recordOrders("forged price purchase");
  check("forged price ignored, order recorded at 19900 paise", forgedOrders.length === 1 && forgedOrders[0].unit_price_paise === 19900, `price=${forgedOrders[0]?.unit_price_paise}`);

  const stock2 = await call("/rest/v1/rpc/deploy_test_admin_set_stock", { token: adminToken, method: "POST", body: { new_stock: 1 } });
  check("admin sets stock to 1 for the race", stock2.status < 300);
  const raceAttempt = async () => {
    try {
      const response = await fetch(`${base}/api/db-test`, { method: "POST", headers: { "x-test-token": testToken }, signal: AbortSignal.timeout(RACE_TIMEOUT_MS) });
      const body = await response.json().catch(() => null);
      if (response.status === 200 && body?.taken === true) return { kind: "win" };
      if (response.status === 200 && body?.taken === false) return { kind: "loss" };
      return { kind: "invalid", detail: `status ${response.status}, ${JSON.stringify(body)}` };
    } catch (error) {
      return { kind: "network", detail: [error.name, error.message, error.cause?.code, error.cause?.message].filter(Boolean).join(" | ") };
    }
  };
  const started = performance.now();
  const race = await runRace({ buyers: 20, availableStock: 1, attempt: raceAttempt });
  const stockAfter = (await product())?.stock;
  console.log(`NOTE  race through the local Worker took ${Math.round(performance.now() - started)} ms`);
  for (const [detail, times] of Object.entries(race.errors)) console.log(`ERROR race: ${times} x ${detail}`);
  check("20 requests through the app: every one valid, exactly 1 sold, stock 0", race.pass && stockAfter === 0, `completed=${race.completed} wins=${race.wins} losses=${race.losses} invalid=${race.invalid} network=${race.network} stock=${stockAfter}`);
  const raceOrders = await recordOrders("race");
  check("race created exactly one guest order at 19900 paise", raceOrders.length === 1 && raceOrders[0].user_id === null && raceOrders[0].unit_price_paise === 19900);

  section("Phase F: getClaims compared with getUser (evidence only)");
  const contextC = await newContext();
  const pageC = await contextC.newPage();
  await logInThroughForm(pageC, "/login", EMAILS.a);
  await pageC.waitForURL("**/account", { timeout: 15000 }).catch(() => {});
  const liveCookie = headerFrom(await authCookies(contextC));
  console.log(`NOTE  valid session: ${JSON.stringify(await compare(liveCookie))}`);
  const forgedResult = await compare(`${COOKIE}=base64-eyJ0YW1wZXJlZCI6dHJ1ZX0`);
  console.log(`NOTE  forged cookie: ${JSON.stringify(forgedResult)}`);
  check("both reject a forged cookie", forgedResult.getClaims?.accepted === false && forgedResult.getUser?.accepted === false);

  section("Logout (this session only)");
  const stillLoggedIn = await contextA.newPage();
  await pageC.getByRole("button", { name: "Log out" }).click();
  await pageC.waitForURL(`${base}/`, { timeout: 15000 }).catch(() => {});
  check("logout removes the session cookie", (await authCookies(contextC)).length === 0);
  await pageC.goto(`${base}/account`, { waitUntil: "networkidle" });
  check("account is blocked after logout", new URL(pageC.url()).pathname === "/login");
  console.log(`NOTE  old token just after logout: ${JSON.stringify(await compare(liveCookie))}`);
  await stillLoggedIn.goto(`${base}/account`, { waitUntil: "networkidle" });
  check("customer A's other session stays logged in", await stillLoggedIn.getByTestId("session").isVisible().catch(() => false));
  check("customer B's session is unaffected", (await call("/rest/v1/rpc/deploy_test_is_admin", { token: users.b.token, method: "POST", body: {} })).json === false);
  check("Confirm email is still on", (await call("/auth/v1/settings")).json?.mailer_autoconfirm === false);
} catch (error) {
  if (!(error instanceof TestFailed)) {
    failed++;
    console.log(`FAIL  Unexpected script error: ${error.message}`);
  }
  console.log("\nSTOPPED at the first failure. No later tests ran.");
} finally {
  section("Phase G: restore and report");
  await browser.close();
  if (adminToken) {
    const price = await call("/rest/v1/rpc/deploy_test_admin_set_price", { token: adminToken, method: "POST", body: { new_price: 19900 } });
    const stock = await call("/rest/v1/rpc/deploy_test_admin_set_stock", { token: adminToken, method: "POST", body: { new_stock: 1 } });
    const final = await product();
    console.log(`Restore: price call ${price.status}, stock call ${stock.status}`);
    console.log(`Final product: ${JSON.stringify(final)}`);
    const restored = final?.price_paise === 19900 && final?.stock === 1;
    console.log(`${restored ? "PASS" : "FAIL"}  product restored to 19900 paise and 1 unit`);
    if (restored) passed++; else failed++;
    const orders = await allOrders();
    console.log(`Orders: before ${baseline}, after ${orders.length}, new ${baseline === null ? "?" : orders.length - baseline}`);
    for (const o of orders.slice(baseline ?? 0)) console.log(`  order ${o.id}: ${labelFor(o.user_id)}, ${o.unit_price_paise} paise, ${o.created_at}`);
  } else {
    failed++;
    console.log("FAIL  couldn't restore: no admin session");
  }
  console.log(`\nPassed ${passed}, failed ${failed}`);
}
process.exit(failed ? 1 : 0);
