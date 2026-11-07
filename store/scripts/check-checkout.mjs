// Checkout in a real browser: empty and filled bags, summary prices, validation, privacy, layout.
import { launchBrowser } from "./lib/staging-auth.mjs";
const base = process.env.BASE_URL ?? "http://localhost:3100";
let failed = 0;
const check = (name, pass, detail = "") => { console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!pass) failed++; };
const rupees = (text) => Number(text.replace(/[^\d]/g, ""));
const bag = (lines) => JSON.stringify({ v: 1, lines });

const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });
const page = await context.newPage();
const errors = []; page.on("pageerror", (e) => errors.push(String(e))); page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const field = (label) => page.getByLabel(label, { exact: false });
const errorOf = async (id) => (await page.locator(`#checkout-${id}-error`).count()) ? (await page.locator(`#checkout-${id}-error`).textContent()) : "";

// Prices for the expected totals come from the product pages, not from this test.
await page.goto(`${base}/products/sample-dome-jhumka`, { waitUntil: "networkidle" });
const jhumka = rupees(await page.locator("main h1 + p").textContent());
await page.goto(`${base}/products/sample-matte-claw`, { waitUntil: "networkidle" });
const claw = rupees(await page.locator("main h1 + p").textContent());

// Empty bag.
await page.evaluate(() => localStorage.removeItem("nevora-bag"));
await page.goto(`${base}/checkout`, { waitUntil: "networkidle" });
check("empty bag shows a clear message", (await page.locator("main").textContent()).includes("Your bag is empty"));
check("empty bag offers a shopping link", await page.getByRole("link", { name: "Continue shopping" }).isVisible());
check("empty bag shows no form", await page.locator("form").count() === 0);

// Only unavailable pieces.
await page.evaluate((b) => localStorage.setItem("nevora-bag", b), bag([{ slug: "sample-charm-bracelet", finish: "Gold tone", quantity: 1 }]));
await page.reload({ waitUntil: "networkidle" });
check("a bag with nothing available can't check out", (await page.locator("main").textContent()).includes("Nothing in your bag is available") && await page.locator("form").count() === 0);

// Filled bag, reached from the bag page. One stored price is tampered with, and one piece is sold out.
await page.evaluate((b) => localStorage.setItem("nevora-bag", b), bag([
  { slug: "sample-dome-jhumka", finish: "Gold tone", quantity: 2, pricePaise: 100 },
  { slug: "sample-matte-claw", finish: "Taupe", quantity: 1 },
  { slug: "sample-charm-bracelet", finish: "Gold tone", quantity: 1 },
]));
await page.goto(`${base}/bag`, { waitUntil: "networkidle" });
await page.getByRole("link", { name: "Proceed to checkout" }).click();
await page.waitForURL("**/checkout");
await page.waitForSelector("form");
check("proceed to checkout opens the checkout page", page.url().endsWith("/checkout"));
const summary = page.locator("main aside");
const summaryText = await summary.textContent();
check("summary lists each available line with finish and quantity", (await summary.locator("li").count()) === 2 && summaryText.includes("Finish: Gold tone") && summaryText.includes("Finish: Taupe") && summaryText.includes("2 ×"));
check("subtotal uses catalogue prices, ignoring a stored price", rupees(await summary.locator("dl > div").first().locator("dd").textContent()) === jhumka * 2 + claw);
check("total matches the subtotal before shipping", rupees(await summary.locator("dl > div").last().locator("dd").textContent()) === jhumka * 2 + claw);
check("unavailable piece is explained and left out", summaryText.includes("isn't available") && !summaryText.includes("Charm Bracelet"));
check("edit bag link goes to the bag", (await summary.getByRole("link", { name: "Edit bag" }).first().getAttribute("href")) === "/bag");

// Validation.
for (const label of ["Full name", "Mobile number", "Email address", "House or flat number", "Landmark", "City or town", "State or union territory", "PIN code"]) {
  check(`field "${label}" has a label`, await field(label).count() === 1);
}
check("required fields are marked", await page.locator("form [required]").count() === 6 && await page.locator("form label:has-text('(optional)')").count() === 2);
check("place order is disabled and explained", await page.getByRole("button", { name: "Place order" }).isDisabled() && (await page.locator("#place-order-note").textContent()).includes("coming soon"));

await field("Full name").focus();
await field("Full name").press("Enter");
check("Enter checks every field and reports all required ones", (await page.locator("form [aria-invalid='true']").count()) === 6);
check("focus moves to the first problem", await page.evaluate(() => document.activeElement?.id) === "checkout-name");
check("optional fields aren't flagged when blank", !(await errorOf("email")) && !(await errorOf("landmark")));

await field("Mobile number").fill("12345");
await field("Mobile number").blur();
check("an invalid mobile number is explained", (await errorOf("phone")).includes("10-digit Indian mobile number"));
await field("Mobile number").fill("+91 98765 43210");
check("the message clears once the number is fixed", !(await errorOf("phone")) && (await field("Mobile number").getAttribute("aria-invalid")) === null);
await field("PIN code").fill("011001");
await field("PIN code").blur();
check("an invalid PIN code is explained", (await errorOf("pincode")).includes("6-digit PIN code"));
await field("Email address").fill("not-an-email");
await field("Email address").blur();
check("an invalid optional email is explained", (await errorOf("email")).includes("valid email"));
check("errors are linked to their fields for screen readers", ((await field("PIN code").getAttribute("aria-describedby")) ?? "").includes("checkout-pincode-error"));

// Fill everything correctly.
await field("Full name").fill("Ananya Sharma");
await field("Email address").fill("");
await field("House or flat number").fill("Flat 12B, Lotus Apartments, MG Road");
await field("Landmark").fill("Near the post office");
await field("City or town").fill("New Delhi");
await field("State or union territory").selectOption("Delhi");
await field("PIN code").fill("110001");
const requests = []; page.on("request", (r) => requests.push(r.url()));
await field("PIN code").press("Enter");
check("a complete form shows no errors", (await page.locator("form [aria-invalid='true']").count()) === 0);
check("place order stays disabled even when the form is complete", await page.getByRole("button", { name: "Place order" }).isDisabled());
check("checking the form sends nothing to the server", requests.filter((u) => !/_next\/static|\.svg/.test(u)).length === 0, `${requests.length} requests`);
const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
check("personal details aren't stored in the browser", !/Ananya|98765|Lotus|110001/.test(storage));
check("the bag is untouched", await page.evaluate(() => JSON.parse(localStorage.getItem("nevora-bag")).lines.length) === 3);
check("no WhatsApp link or order confirmation appears", !/wa\.me|whatsapp:\/\/|order placed|order id/i.test(await page.content()));

// Layout and safety.
check("no sideways scroll at 360px", await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
const small = await page.evaluate(() => [...document.querySelectorAll("main a, main button, main input, main select")].filter((e) => e.offsetParent && !e.closest("nav[aria-label='Breadcrumb']")).filter((e) => { const r = e.getBoundingClientRect(); return r.height < 24 || r.width < 24; }).map((e) => (e.getAttribute("aria-label") || e.id || e.textContent).trim().slice(0, 30)));
check("tap targets at least 24px", small.length === 0, small.join(" | "));
check("inputs use 16px text, so phones don't zoom in", await page.evaluate(() => [...document.querySelectorAll("form input, form select")].every((e) => parseFloat(getComputedStyle(e).fontSize) >= 16)));
check("summary comes before the form on phones", await page.evaluate(() => document.querySelector("main aside").getBoundingClientRect().top < document.querySelector("main form").getBoundingClientRect().top));
await page.reload({ waitUntil: "networkidle" });
check("refreshing clears the typed details", (await field("Full name").inputValue()) === "");

const desktop = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await desktop.goto(`${base}/checkout`, { waitUntil: "networkidle" });
await desktop.evaluate((b) => localStorage.setItem("nevora-bag", b), bag([{ slug: "sample-everyday-hoop", finish: "Silver tone", quantity: 1 }]));
await desktop.reload({ waitUntil: "networkidle" });
const layout = await desktop.evaluate(() => { const f = document.querySelector("main form").getBoundingClientRect(); const a = document.querySelector("main aside").getBoundingClientRect(); return { beside: a.left >= f.right, scroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth }; });
check("desktop shows the summary beside the form", layout.beside && layout.scroll);

const nojs = await (await browser.newContext({ javaScriptEnabled: false })).newPage();
await nojs.goto(`${base}/checkout`);
check("without JavaScript the checkout page explains itself", (await nojs.content()).includes("Checkout needs JavaScript"));

check("no console or page errors", errors.length === 0, errors.slice(0, 2).join(" | ").slice(0, 160));
await browser.close();
process.exit(failed ? 1 : 0);
