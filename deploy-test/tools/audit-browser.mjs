// Browser audit with the installed Chrome, against a local Worker and the mock Supabase.
import { chromium } from "playwright-core";
const base = process.argv[2].replace(/\/$/, "");
const mock = process.argv[3];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const rec = (id, status, evidence) => console.log(`${status.padEnd(7)} ${id}  ::  ${evidence}`);
const stats = async () => (await fetch(`${mock}/__mock/stats`)).json();
const reset = () => fetch(`${mock}/__mock/reset`);
const config = (q) => fetch(`${mock}/__mock/config?${q}`);

// Journey: request counting for free-tier maths
{
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const page = await ctx.newPage();
  const reqs = []; const external = new Set(); const errors = []; let transferred = 0;
  page.on("request", (r) => { const u = new URL(r.url()); if (u.origin !== base) external.add(u.host); else reqs.push({ path: u.pathname, type: r.resourceType(), rsc: Boolean(r.headers()["rsc"]) }); });
  page.on("response", async (r) => { try { transferred += (await r.body()).length; } catch {} });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  const first = reqs.length;
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(300);
  await page.getByRole("link", { name: "Earrings" }).first().click(); await page.waitForURL("**/c/earrings"); await page.waitForLoadState("networkidle");
  await page.locator('main a[href^="/p/"]').first().click(); await page.waitForURL("**/p/**"); await page.waitForLoadState("networkidle");
  await page.goBack(); await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: "Test store" }).click(); await page.waitForLoadState("networkidle");
  const worker = reqs.filter((r) => !/^\/(_next\/static|sample|favicon)/.test(r.path));
  rec("journey: home, category, product, back, home", "PASS", `first load ${first} requests; total ${reqs.length}; Worker requests ${worker.length} [${worker.map((r) => r.path + (r.rsc ? " (rsc)" : "")).join(", ")}]`);
  rec("no third-party requests (fonts self-hosted)", external.size === 0 ? "PASS" : "WARNING", `external hosts: ${[...external].join(", ") || "none"}`);
  rec("no prefetch on listing", reqs.filter((r) => r.rsc).length <= 3 ? "PASS" : "FAIL", `rsc requests ${reqs.filter((r) => r.rsc).length}`);
  rec("no console or page errors", errors.length === 0 ? "PASS" : "WARNING", JSON.stringify(errors.slice(0, 2)));
  rec("journey bytes", "PASS", `${(transferred / 1024).toFixed(0)} KB decoded`);
  await ctx.close();
}

// Mock login flows
const login = async (page, path, email) => {
  await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "mock-password");
  await page.getByRole("button", { name: "Log in" }).click();
};
{
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await reset(); await login(page, "/login", "customer@mock.test");
  await page.waitForURL("**/account", { timeout: 10000 }).catch(() => {});
  const ok = await page.getByTestId("session").isVisible().catch(() => false);
  rec("MOCK customer login reaches /account", ok ? "PASS" : "FAIL", page.url());
  const cookies = await ctx.cookies();
  const auth = cookies.filter((c) => c.name.includes("auth-token"));
  rec("MOCK session cookie created", auth.length ? "PASS" : "FAIL", auth.map((c) => `${c.name.slice(0, 20)}… httpOnly=${c.httpOnly} secure=${c.secure} sameSite=${c.sameSite} expires=${c.expires > 0 ? Math.round((c.expires - Date.now() / 1000) / 86400) + "d" : "session"}`).join(" | "));
  rec("MOCK session cookie HttpOnly", auth.length && auth.every((c) => c.httpOnly) ? "PASS" : "WARNING", "readable by page scripts when false");
  rec("MOCK session cookie Secure", auth.length && auth.every((c) => c.secure) ? "PASS" : "WARNING", "local http; must be re-verified on https");
  await reset(); await page.goto(`${base}/account`, { waitUntil: "networkidle" });
  rec("MOCK subrequests on /account", "PASS", JSON.stringify(await stats()));
  await reset(); await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
  const denied = await page.getByTestId("admin-denied").isVisible().catch(() => false);
  const admin = await page.getByTestId("admin-ok").isVisible().catch(() => false);
  rec("MOCK customer blocked from /admin", denied && !admin ? "PASS" : "FAIL", `denied=${denied} adminContent=${admin} ${JSON.stringify(await stats())}`);
  // Tamper
  const tampered = cookies.map((c) => (c.name.includes("auth-token") ? { ...c, value: "base64-eyJ0YW1wZXJlZCI6dHJ1ZX0" } : c));
  const t = await browser.newContext(); await t.addCookies(tampered); const tp = await t.newPage();
  await tp.goto(`${base}/account`, { waitUntil: "networkidle" });
  rec("MOCK tampered cookie sent to login", tp.url().endsWith("/login") ? "PASS" : "FAIL", tp.url());
  await t.close();
  // Logout
  await page.goto(`${base}/account`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Log out" }).click(); await page.waitForURL(`${base}/`, { timeout: 8000 }).catch(() => {});
  const after = (await ctx.cookies()).filter((c) => c.name.includes("auth-token"));
  rec("MOCK logout clears cookie", after.length === 0 ? "PASS" : "FAIL", `remaining=${after.length} url=${page.url()}`);
  await page.goto(`${base}/account`, { waitUntil: "networkidle" });
  rec("MOCK logged out cannot open account", page.url().endsWith("/login") ? "PASS" : "FAIL", page.url());
  await ctx.close();
}
{
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await login(page, "/admin/login", "admin@mock.test"); await page.waitForURL("**/admin", { timeout: 10000 }).catch(() => {});
  rec("MOCK admin role reaches admin area", (await page.getByTestId("admin-ok").isVisible().catch(() => false)) ? "PASS" : "FAIL", page.url());
  await ctx.close();
}
{
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "customer@mock.test"); await page.fill('input[name="password"]', "wrong");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByTestId("login-result").filter({ hasText: "Login failed" }).waitFor({ timeout: 8000 }).catch(() => {});
  rec("MOCK wrong password generic error", (await page.getByTestId("login-result").textContent()) === "Login failed" ? "PASS" : "FAIL", await page.getByTestId("login-result").textContent());
  await ctx.close();
}
// Token refresh. Supabase refreshes tokens within 90 seconds of expiry, so tokens start at 95 seconds
// and tests wait 6 seconds to enter that window. New tokens last an hour, so one refresh is enough.
const expiring = async () => {
  await config("ttl=95");
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await login(page, "/login", "customer@mock.test"); await page.waitForURL("**/account", { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(6000); await config("ttl=3600"); await reset();
  return { ctx, page };
};
{
  const { ctx, page } = await expiring();
  const before = (await ctx.cookies()).find((c) => c.name.includes("auth-token"))?.value;
  await page.goto(`${base}/account`, { waitUntil: "networkidle" });
  const s = await stats();
  const after = (await ctx.cookies()).find((c) => c.name.includes("auth-token"))?.value;
  rec("MOCK expiring token refreshed and saved", s.refresh >= 1 && before !== after ? "PASS" : "FAIL", `${JSON.stringify(s)} cookieChanged=${before !== after}`);
  rec("MOCK one refresh per page view", s.refresh === 1 ? "PASS" : "WARNING", `refreshCalls=${s.refresh}; more than one means the page didn't receive the token the proxy refreshed`);
  rec("MOCK still logged in after refresh", (await page.getByTestId("session").isVisible().catch(() => false)) ? "PASS" : "FAIL", page.url());
  await ctx.close();
}
{
  const { ctx } = await expiring();
  const cookie = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  const res = await Promise.all(Array.from({ length: 5 }, () => fetch(`${base}/account`, { redirect: "manual", headers: { cookie } }).then((r) => r.status)));
  const s = await stats();
  rec("MOCK five parallel requests near expiry", s.refresh <= 1 ? "PASS" : "WARNING", `statuses=${res.join(",")} refreshCalls=${s.refresh}; real Supabase rotates refresh tokens, so retest on the real service`);
  await ctx.close();
}
await browser.close();
