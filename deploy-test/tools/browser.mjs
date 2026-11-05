// Checks real browser behaviour: styling, hydration, images, server actions, prefetching.
// Uses the installed Chrome, on a 360px phone-sized screen.
// Usage: node browser.mjs <base-url>
import { chromium } from "playwright-core";

const base = (process.argv[2] ?? "http://localhost:8787").replace(/\/$/, "");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 360, height: 740 } });

const results = [];
const check = (name, pass, detail = "") => results.push({ name, pass, detail });

const consoleErrors = [];
const failedRequests = [];
const pageRequests = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(String(e)));
page.on("response", (r) => {
  if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url().replace(base, "")}`);
});
page.on("request", (r) => {
  const url = r.url().replace(base, "");
  if (url.includes("_rsc") || r.headers()["rsc"]) pageRequests.push(url);
});

await page.goto(`${base}/`, { waitUntil: "networkidle" });
check("home renders", await page.getByRole("heading", { name: "Static home page" }).isVisible());

const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
check("Tailwind styling applied", bg === "rgb(248, 245, 240)", bg);

const serif = await page.evaluate(() => getComputedStyle(document.querySelector("h1")).fontFamily);
check("heading font applied", /playfair/i.test(serif), serif.slice(0, 60));

const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
);
check("no sideways scroll at 360px", !overflow);

const images = await page.evaluate(() =>
  [...document.querySelectorAll("main img")].slice(0, 4).map((i) => ({
    src: i.currentSrc.replace(location.origin, ""),
    ok: i.complete && i.naturalWidth > 0,
  })),
);
check(
  "images load through the size loader",
  images.length > 0 && images.every((i) => i.ok && /product-\d+\.svg/.test(i.src)),
  images[0] ? `${images[0].src} loaded=${images[0].ok}` : "no images",
);

const button = page.getByTestId("hydration-button").first();
await button.click();
check("client component hydrates", (await button.textContent()) === "Clicked 1");

check("no prefetch requests on listing page", pageRequests.length === 0, pageRequests.slice(0, 3).join(", "));

await page.getByRole("link", { name: "Earrings" }).first().click();
await page.waitForURL("**/c/earrings");
check("client navigation works", await page.getByRole("heading", { name: "Earrings" }).isVisible());

await page.goto(`${base}/action-test`, { waitUntil: "networkidle" });
await page.fill('input[name="name"]', "Test Customer");
await page.fill('input[name="phone"]', "9876543210");
await page.getByRole("button", { name: "Submit" }).click();
await page.getByTestId("action-result").filter({ hasText: "Valid" }).waitFor({ timeout: 8000 }).catch(() => {});
check("server action accepts valid input", (await page.getByTestId("action-result").textContent()) === "Valid");
await page.fill('input[name="phone"]', "12345");
await page.getByRole("button", { name: "Submit" }).click();
await page.getByTestId("action-result").filter({ hasText: "Invalid" }).waitFor({ timeout: 8000 }).catch(() => {});
check("server action rejects bad input", (await page.getByTestId("action-result").textContent()) === "Invalid");

await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
check("logged-out /admin goes to login", page.url().endsWith("/admin/login"), page.url());

await browser.close();

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
}
console.log(`\nConsole errors: ${consoleErrors.length}`, consoleErrors.slice(0, 3));
console.log(`Failed requests: ${failedRequests.length}`, [...new Set(failedRequests)].slice(0, 5));
process.exit(failed ? 1 : 0);
