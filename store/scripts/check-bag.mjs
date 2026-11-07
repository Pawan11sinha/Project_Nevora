// The bag in a real browser: variants, quantities, removal, persistence, bad stored data, phone layout.
import { launchBrowser } from "./lib/staging-auth.mjs";
const base = process.env.BASE_URL ?? "http://localhost:3100";
let failed = 0;
const check = (name, pass, detail = "") => { console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!pass) failed++; };
const rupees = (text) => Number(text.replace(/[^\d]/g, ""));

const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });
const page = await context.newPage();
const errors = []; page.on("pageerror", (e) => errors.push(String(e))); page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const bagLabel = () => page.locator("body > header a[href='/bag']").getAttribute("aria-label");
const subtotal = async () => rupees(await page.locator("aside dd").textContent());

// Product with two finishes. The expected price is read from the product page, not written into this test.
await page.goto(`${base}/products/sample-dome-jhumka`, { waitUntil: "networkidle" });
const unit = rupees(await page.locator("main h1 + p").textContent());
check("empty bag shows no count", (await bagLabel()) === "Bag");
const requests = []; page.on("request", (r) => requests.push(r.url()));
await page.getByText("Gold tone", { exact: true }).click();
await page.getByRole("button", { name: "Add to bag" }).click();
check("adding confirms the piece and finish", (await page.getByRole("status").textContent()).includes("Added Dome Jhumka, Gold tone"));
check("header count updates", (await bagLabel()) === "Bag, 1 item", await bagLabel());
await page.getByText("Oxidised silver tone", { exact: true }).click();
check("changing the finish clears the old confirmation", (await page.getByRole("status").textContent()).trim() === "");
await page.getByRole("button", { name: "Add to bag" }).click();
await page.getByText("Gold tone", { exact: true }).click();
await page.getByRole("button", { name: "Add to bag" }).click();
check("three items across two finishes", (await bagLabel()) === "Bag, 3 items", await bagLabel());
check("adding to the bag makes no server requests", requests.filter((u) => !/_next\/static|\.svg/.test(u)).length === 0, `${requests.length} requests`);

await page.goto(`${base}/bag`, { waitUntil: "networkidle" });
check("each finish is its own line", await page.locator("main ul > li").count() === 2);
check("lines show the finishes", (await page.locator("main ul").textContent()).includes("Finish: Gold tone") && (await page.locator("main ul").textContent()).includes("Finish: Oxidised silver tone"));
check("subtotal uses catalogue prices", (await subtotal()) === unit * 3, `₹${await subtotal()} vs ₹${unit * 3}`);
const silver = page.getByRole("group", { name: /Oxidised silver tone/ });
await silver.getByRole("button", { name: "Increase quantity" }).click();
check("increase raises quantity and subtotal", (await silver.textContent()).includes("2") && (await subtotal()) === unit * 4);
const gold = page.getByRole("group", { name: /, Gold tone$/ });
await gold.getByRole("button", { name: "Decrease quantity" }).click();
check("decrease lowers quantity and subtotal", (await subtotal()) === unit * 3 && (await bagLabel()) === "Bag, 3 items");
check("decrease stops at 1", await gold.getByRole("button", { name: "Decrease quantity" }).isDisabled());
await page.getByRole("button", { name: "Remove Dome Jhumka, Oxidised silver tone" }).click();
check("remove takes out only that line", await page.locator("main ul > li").count() === 1 && (await subtotal()) === unit);

await page.reload({ waitUntil: "networkidle" });
check("bag survives a refresh", await page.locator("main ul > li").count() === 1 && (await bagLabel()) === "Bag, 1 item");
check("no sideways scroll on the bag at 360px", await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
const small = await page.evaluate(() => [...document.querySelectorAll("main a, main button")].filter((e) => e.offsetParent && !e.closest("nav[aria-label='Breadcrumb']") && e.getAttribute("aria-hidden") !== "true").filter((e) => { const r = e.getBoundingClientRect(); return r.height < 24 || r.width < 24; }).map((e) => (e.getAttribute("aria-label") || e.textContent).trim().slice(0, 30)));
check("bag tap targets at least 24px", small.length === 0, small.join(" | "));
check("proceed to checkout links to the checkout page", (await page.getByRole("link", { name: "Proceed to checkout" }).getAttribute("href")) === "/checkout");

// Stored data the customer or another script could tamper with.
await page.evaluate(() => localStorage.setItem("nevora-bag", JSON.stringify({ v: 1, lines: [
  { slug: "sample-dome-jhumka", finish: "Gold tone", quantity: 2, pricePaise: 100 },
  { slug: "sample-gone-forever", finish: "Gold tone", quantity: 1 },
  { slug: "sample-charm-bracelet", finish: "Gold tone", quantity: 1 },
  { slug: "sample-dome-jhumka", finish: "Rose tone", quantity: 1 },
] })));
await page.reload({ waitUntil: "networkidle" });
const text = await page.locator("main").textContent();
check("a stored price is ignored", (await subtotal()) === unit * 2, `₹${await subtotal()}`);
check("missing, sold-out and unknown-finish lines are explained", text.includes("no longer available") && text.includes("sold out") && text.includes("This finish is no longer available"));
check("unavailable lines are left out of the subtotal count", (await page.locator("aside dt").textContent()).includes("2 items"));
await page.evaluate(() => localStorage.setItem("nevora-bag", "{not json"));
await page.reload({ waitUntil: "networkidle" });
check("unreadable stored data gives an empty bag, not an error", (await page.locator("main").textContent()).includes("Your bag is empty"));
check("empty bag offers a way back", await page.getByRole("link", { name: "Continue shopping" }).isVisible());

await page.goto(`${base}/products/sample-charm-bracelet`, { waitUntil: "networkidle" });
check("sold-out product can't be added", await page.getByRole("button", { name: "Sold out" }).isDisabled());

const desktop = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await desktop.goto(`${base}/products/sample-everyday-hoop`, { waitUntil: "networkidle" });
await desktop.getByRole("button", { name: "Add to bag" }).click();
await desktop.goto(`${base}/bag`, { waitUntil: "networkidle" });
const box = await desktop.evaluate(() => { const l = document.querySelector("main ul").getBoundingClientRect(); const a = document.querySelector("main aside").getBoundingClientRect(); return { side: a.left >= l.right, scroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth }; });
check("desktop shows the summary beside the lines", box.side && box.scroll);

const nojs = await (await browser.newContext({ javaScriptEnabled: false })).newPage();
await nojs.goto(`${base}/bag`);
check("without JavaScript the bag page explains itself", (await nojs.content()).includes("Your bag needs JavaScript"));

check("no console or page errors", errors.length === 0, errors.slice(0, 2).join(" | ").slice(0, 160));
await browser.close();
process.exit(failed ? 1 : 0);
