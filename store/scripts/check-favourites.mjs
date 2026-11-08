// Favourites and the product-card design in a real browser: the heart's state, saving and removing, persistence,
// no duplicates, no navigation, keyboard use, cards and product pages in step, other tabs in step, the Favourites
// page, the header count, discount badges, equal card heights, no promotional badges, and phone layout.
//   BASE_URL=http://localhost:8787 node scripts/check-favourites.mjs
import { launchBrowser } from "./lib/staging-auth.mjs";
const base = (process.env.BASE_URL ?? "http://localhost:3100").replace(/\/$/, "");
let failed = 0;
const check = (name, pass, detail = "") => { console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!pass) failed++; };
const errors = [];
const browser = await launchBrowser();
const LIST = "/collections/coquette-edit";

async function open(options = {}, path = LIST) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("nevora-favourites"));
  await page.reload({ waitUntil: "networkidle" });
  return { context, page };
}
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("nevora-favourites") ?? '{"slugs":[]}').slugs);
const headerLabel = (page) => page.locator("body > header a[href='/favourites']").getAttribute("aria-label");
const card = (page, name) => page.locator("main article").filter({ has: page.getByRole("heading", { name, exact: true }) }).first();
const heart = (scope, name) => scope.getByRole("button", { name: new RegExp(`^(Save ${name} to|Remove ${name} from) favourites$`) });

{
  const { context, page } = await open();
  const requests = [];
  page.on("request", (r) => { if (!/_next\/static|\.svg|\.json$/.test(r.url())) requests.push(r.url()); });
  const chandbali = card(page, "Pearl Chandbali");
  const h = heart(chandbali, "Pearl Chandbali");
  check("every card has a heart in the image's top-right corner", (await page.locator("main article").count()) === (await page.locator("main article").filter({ has: page.getByRole("button", { name: /favourites$/ }) }).count()) && await page.evaluate(() => { const a = document.querySelector("main article"); const img = a.querySelector("img").getBoundingClientRect(); const b = a.querySelector('button[aria-label$="favourites"]').getBoundingClientRect(); return b.right <= img.right + 1 && b.right > img.right - 60 && b.top < img.top + 60; }));
  check("the heart starts empty and not pressed", (await h.getAttribute("aria-pressed")) === "false" && (await h.getAttribute("aria-label")) === "Save Pearl Chandbali to favourites" && (await h.locator("svg").getAttribute("fill")) === "none");
  await h.click();
  check("clicking saves it: pressed, filled and labelled to remove", (await h.getAttribute("aria-pressed")) === "true" && (await h.getAttribute("aria-label")) === "Remove Pearl Chandbali from favourites" && (await h.locator("svg").getAttribute("fill")) === "currentColor");
  check("it's stored once", JSON.stringify(await saved(page)) === JSON.stringify(["sample-pearl-chandbali"]));
  check("the page didn't navigate", new URL(page.url()).pathname === LIST);
  check("the header shows the count", (await headerLabel(page)) === "Favourites, 1 piece", await headerLabel(page));
  await page.reload({ waitUntil: "networkidle" });
  check("it's still saved after a refresh", (await heart(card(page, "Pearl Chandbali"), "Pearl Chandbali").getAttribute("aria-pressed")) === "true");
  await heart(card(page, "Pearl Chandbali"), "Pearl Chandbali").click();
  check("clicking again removes it", (await saved(page)).length === 0 && (await headerLabel(page)) === "Favourites");

  // Keyboard. The request log is cleared first: the refresh check above deliberately reloaded the page.
  requests.length = 0;
  const stud = heart(card(page, "Pearl Stud"), "Pearl Stud");
  await stud.focus();
  await page.keyboard.press("Enter");
  check("Enter saves it", (await saved(page)).includes("sample-pearl-stud"));
  await page.keyboard.press("Space");
  check("Space removes it", !(await saved(page)).includes("sample-pearl-stud"));
  check("toggling favourites sent nothing to the server", requests.length === 0, requests.slice(0, 3).join(" "));

  // Product page in step with cards
  await heart(card(page, "Layered Pearl Chain"), "Layered Pearl Chain").click();
  await card(page, "Layered Pearl Chain").getByRole("heading").click();
  await page.waitForURL("**/products/sample-layered-chain");
  const pageHeart = heart(page.locator("main"), "Layered Pearl Chain").first();
  check("the product page shows the same saved state", (await pageHeart.getAttribute("aria-pressed")) === "true");
  check("the product page price line is unchanged", (await page.locator("main h1 + p").textContent()).startsWith("₹449"));
  await pageHeart.click();
  await page.goBack({ waitUntil: "networkidle" });
  check("removing it there removes it on the cards too", (await heart(card(page, "Layered Pearl Chain"), "Layered Pearl Chain").getAttribute("aria-pressed")) === "false");

  // Another open tab stays in step
  const other = await context.newPage();
  await other.goto(base + LIST, { waitUntil: "networkidle" });
  await heart(card(page, "Soft Drop Earring"), "Soft Drop Earring").click();
  await other.waitForTimeout(300);
  check("another open tab updates too", (await heart(card(other, "Soft Drop Earring"), "Soft Drop Earring").getAttribute("aria-pressed")) === "true");
  await other.close();

  // Card design
  const badges = await page.evaluate(() => [...document.querySelectorAll("main article")].map((a) => ({ name: a.querySelector("h3").textContent, badge: [...a.querySelectorAll("span")].find((s) => /^−\d+%$/.test(s.textContent.trim()))?.textContent.trim() ?? null })));
  const expected = { "Pearl Chandbali": "−30%", "Soft Drop Earring": "−20%", "Layered Pearl Chain": "−30%", "Pearl Stud": null, "Pearl Bar Clip": null };
  check("discount badges match the pricing rule, and appear only on genuine discounts", Object.entries(expected).every(([n, b]) => badges.find((x) => x.name === n)?.badge === b), JSON.stringify(badges.filter((x) => x.name in expected)));
  check("no Buy 2 Get 1 or other promotional badge appears", !/buy\s*\d\s*get\s*\d|b2g1/i.test(await page.locator("main").textContent()));
  const heights = await page.evaluate(() => { const rows = {}; for (const a of document.querySelectorAll("main article")) { const r = a.getBoundingClientRect(); (rows[Math.round(r.top)] ??= []).push(Math.round(r.height)); } return Object.values(rows); });
  check("cards in the same row are the same height", heights.every((row) => row.every((h) => h === row[0])), JSON.stringify(heights));
  check("Add to bag on cards still works", (await card(page, "Pearl Stud").getByRole("button", { name: "Add Pearl Stud to bag" }).click().then(() => true)) && (await page.evaluate(() => JSON.parse(localStorage.getItem("nevora-bag")).lines.length)) === 1);
  await context.close();
}

{
  // Favourites page
  const { context, page } = await open({}, "/favourites");
  check("an empty Favourites page explains how to save pieces", (await page.locator("main").textContent()).includes("haven’t saved any favourites yet"));
  await page.evaluate(() => localStorage.setItem("nevora-favourites", JSON.stringify({ v: 1, slugs: ["sample-pearl-stud", "sample-gone-forever", "sample-dome-jhumka", "sample-pearl-stud"] })));
  await page.reload({ waitUntil: "networkidle" });
  const names = await page.locator("main article h3").allTextContents();
  check("the Favourites page lists saved pieces newest first, skipping missing and duplicate ones", JSON.stringify(names) === JSON.stringify(["Pearl Stud", "Dome Jhumka"]), JSON.stringify(names));
  await heart(card(page, "Pearl Stud"), "Pearl Stud").click();
  check("removing a piece there takes it off the page", JSON.stringify(await page.locator("main article h3").allTextContents()) === JSON.stringify(["Dome Jhumka"]));
  await page.evaluate(() => localStorage.setItem("nevora-favourites", "{not json"));
  await page.reload({ waitUntil: "networkidle" });
  check("unreadable stored favourites give an empty page, not an error", (await page.locator("main").textContent()).includes("haven’t saved any favourites yet"));
  const status = (await page.request.get(`${base}/favourites`)).headers()["cache-control"] ?? "";
  check("the Favourites page is never cached", status.includes("no-store"), status);
  await context.close();
}

{
  // Phone
  const { context, page } = await open({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  const h = heart(card(page, "Pearl Chandbali"), "Pearl Chandbali");
  const box = await h.boundingBox();
  check("phone: the heart is at least 44px", box.width >= 44 && box.height >= 44, `${box.width}×${box.height}`);
  await h.tap();
  check("phone: tapping the heart saves it without opening the product", (await saved(page)).includes("sample-pearl-chandbali") && new URL(page.url()).pathname === LIST);
  check("phone: no sideways scroll", await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  check("phone: the header favourites link is shown", await page.locator("body > header a[href='/favourites']").isVisible());
  await context.close();
}

check("no console or page errors", errors.length === 0, errors.slice(0, 3).join(" | ").slice(0, 300));
await browser.close();
process.exit(failed ? 1 : 0);
