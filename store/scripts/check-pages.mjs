// Checks real pages in a browser: routes, filters, hidden empties, honest content, images.
import { chromium } from "playwright-core";
const base = process.env.BASE_URL ?? "http://localhost:3100";
let failed = 0;
const check = (name, pass, detail = "") => { console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!pass) failed++; };
for (const [path, status] of [["/", 200], ["/categories/jewellery", 200], ["/categories/jewellery/earrings", 200], ["/categories/hair-accessories/claw-clips", 200], ["/collections/korean-edit", 200], ["/collections/coquette-edit", 200], ["/collections/minimal-edit", 200], ["/collections/under-299", 200], ["/collections/under-499", 200], ["/collections/new-arrivals", 200], ["/collections/trending", 200], ["/products/sample-dome-jhumka", 200], ["/info/shipping", 200], ["/categories/jewellery/anklets", 404], ["/collections/festive-edit", 404], ["/collections/gift-box", 404], ["/products/nope", 404], ["/categories/nope", 404]]) {
  const r = await fetch(base + path);
  check(`${path} returns ${status}`, r.status === status, `status=${r.status}`);
}
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await (await browser.newContext({ viewport: { width: 360, height: 740 } })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(String(e))); page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

const server = await (await fetch(`${base}/categories/jewellery`)).text();
check("full product list is in the server HTML, before JavaScript", (server.match(/href="\/products\//g) ?? []).length >= 9);

await page.goto(`${base}/categories/jewellery`, { waitUntil: "networkidle" });
const cards = () => page.locator("main article").count();
const all = await cards();
const requests = []; page.on("request", (r) => requests.push(r.url()));
await page.locator("#filter-price").selectOption("299");
await page.waitForTimeout(150);
const under = await cards();
check("price filter narrows the list", under > 0 && under < all, `${all} to ${under}`);
await page.getByLabel("In stock").check();
await page.waitForTimeout(100);
check("in-stock filter removes sold-out pieces", (await page.locator("main").textContent()).includes("Sold out") === false);
await page.locator("#filter-sort").selectOption("low");
await page.waitForTimeout(100);
const prices = (await page.locator("main article p").allTextContents()).map((t) => Number(t.replace(/\D/g, "")));
check("sort orders by price", prices.every((v, i) => i === 0 || v >= prices[i - 1]), prices.join(","));
check("filtering makes no server requests", requests.filter((u) => !/\.svg|_next\/static/.test(u)).length === 0, `${requests.length} requests`);

await page.goto(`${base}/products/sample-dome-jhumka`, { waitUntil: "networkidle" });
await page.getByText("Gold tone", { exact: true }).click();
check("finish picker updates the selection", (await page.locator("legend").textContent()).includes("Gold tone"));
check("ordering is disabled", await page.getByRole("button", { name: /Ordering isn't available/ }).isDisabled());
await page.goto(`${base}/products/sample-charm-bracelet`, { waitUntil: "networkidle" });
check("sold-out product can't be ordered", await page.getByRole("button", { name: "Sold out" }).isDisabled());

const routes = ["/", "/categories/jewellery", "/collections/korean-edit", "/collections/trending", "/products/sample-pearl-stud"];
const banned = /bestsell|best.?seller|viral|hurry|only \d+ left|\d+ sold|\d(\.\d)?\s*★|reviews?\b|ends in \d|limited time/i;
for (const route of routes) {
  await page.goto(base + route, { waitUntil: "networkidle" });
  const text = await page.locator("body").innerText();
  check(`no invented claims on ${route}`, !banned.test(text), text.match(banned)?.[0] ?? "");
  const broken = await page.evaluate(async () => {
    const images = [...document.images];
    images.forEach((i) => (i.loading = "eager"));
    await Promise.all(images.map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
    return images.filter((i) => !i.naturalWidth).length;
  });
  check(`all images load on ${route}`, broken === 0, `${broken} broken`);
  check(`no sideways scroll on ${route}`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
}
check("no console or page errors", errors.length === 0, errors.slice(0, 2).join(" | ").slice(0, 140));
await browser.close();
process.exit(failed ? 1 : 0);
