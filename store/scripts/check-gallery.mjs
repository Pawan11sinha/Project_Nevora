// The product page gallery in a real browser: products with 1, 2, 4 and 5 images show exactly those images, arrows
// and thumbnails change the main image, the counter follows, arrow keys work, a real touch swipe moves to the next
// image on a phone, the lightbox opens, navigates and closes with Escape or its button, a missing image falls back to
// the placeholder, every image is in the server-rendered HTML, and favourites and Add to bag still work.
// Screenshots go to SHOTS_DIR (default: screenshots/imagery, which Git ignores).
//   BASE_URL=http://localhost:8787 SHOTS_DIR=/tmp/shots node scripts/check-gallery.mjs
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { launchBrowser, stagingFetch } from "./lib/staging-auth.mjs";

const base = (process.env.BASE_URL ?? "http://localhost:3100").replace(/\/$/, "");
const shots = process.env.SHOTS_DIR ?? new URL("../screenshots/imagery/", import.meta.url).pathname;
mkdirSync(shots, { recursive: true });
let failed = 0;
const check = (name, pass, detail = "") => { console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!pass) failed++; };
const errors = [];
const browser = await launchBrowser();

const HOOP = "/products/sample-everyday-hoop"; // 5 images
const SCRUNCHIE = "/products/sample-satin-scrunchie"; // 4 images
const CHANDBALI = "/products/sample-pearl-chandbali"; // 2 images
const CLIP = "/products/sample-pearl-clip"; // 1 image

async function open(path, options = {}, setup) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options });
  if (setup) await setup(context);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !m.text().startsWith("Failed to load resource") && errors.push(m.text()));
  await page.goto(base + path, { waitUntil: "networkidle" });
  return { context, page };
}
const gallery = (page) => page.getByRole("region", { name: /images$/ });
const counter = (page) => gallery(page).locator("p span[aria-hidden]").first().textContent().catch(() => null);
const thumbs = (page) => gallery(page).getByRole("list", { name: "Choose an image" }).getByRole("button");
// The slide that's currently shown in the main image (the one that isn't inert).
const current = (page) => gallery(page).locator('[aria-roledescription="slide"]:not([inert]) img').getAttribute("src");
const settle = (page) => page.waitForTimeout(700);

// 5 images, desktop
{
  const { context, page } = await open(HOOP);
  const g = gallery(page);
  check("5 images: five slides and five thumbnails", (await g.locator('[aria-roledescription="slide"]').count()) === 5 && (await thumbs(page).count()) === 5);
  check("5 images: counter starts at 1 / 5", (await counter(page)) === "1 / 5");
  check("5 images: images follow the set order", JSON.stringify(await g.locator('[aria-roledescription="slide"] img').evaluateAll((i) => i.map((x) => x.getAttribute("src").split("/").slice(2, -1).join("") || "main"))) === JSON.stringify(["main", "angle", "detail", "styled", "packaging"]));
  check("5 images: the first image loads eagerly with high priority, the rest lazily", await g.locator('[aria-roledescription="slide"] img').evaluateAll((i) => i[0].loading === "eager" && i[0].getAttribute("fetchpriority") === "high" && i.slice(1).every((x) => x.loading === "lazy")));
  check("5 images: alt text names the product and the view", await g.locator('[aria-roledescription="slide"] img').evaluateAll((i) => i.every((x) => /^Everyday Hoop, sample image, .+/.test(x.alt))));

  await g.getByRole("button", { name: "Next image" }).click(); await settle(page);
  check("next arrow moves to 2 / 5", (await counter(page)) === "2 / 5" && (await current(page)) === "/sample/angle/hoop.svg");
  check("the matching thumbnail is marked current", (await thumbs(page).nth(1).getAttribute("aria-current")) === "true" && (await thumbs(page).nth(0).getAttribute("aria-current")) === null);
  await g.getByRole("button", { name: "Previous image" }).click(); await settle(page);
  check("previous arrow moves back to 1 / 5", (await counter(page)) === "1 / 5");
  await g.getByRole("button", { name: "Previous image" }).click(); await settle(page);
  check("previous from the first image wraps to 5 / 5", (await counter(page)) === "5 / 5" && (await current(page)) === "/sample/packaging/hoop.svg");
  await thumbs(page).nth(3).click(); await settle(page);
  check("clicking thumbnail 4 shows the styled image", (await counter(page)) === "4 / 5" && (await current(page)) === "/sample/styled/hoop.svg");

  await thumbs(page).nth(3).focus();
  await page.keyboard.press("ArrowRight"); await settle(page);
  check("ArrowRight moves to 5 / 5", (await counter(page)) === "5 / 5");
  await page.keyboard.press("ArrowLeft"); await page.keyboard.press("ArrowLeft"); await settle(page);
  check("ArrowLeft twice moves to 3 / 5", (await counter(page)) === "3 / 5" && (await current(page)) === "/sample/detail/hoop.svg");
  check("arrow keys don't scroll the page", (await page.evaluate(() => window.scrollX)) === 0);

  // Lightbox
  await g.locator('[aria-roledescription="slide"]:not([inert]) button').click();
  const dialog = page.getByRole("dialog");
  await page.waitForTimeout(300);
  check("clicking the main image opens the lightbox", await dialog.isVisible());
  check("the lightbox shows the same image, larger", await dialog.locator(".snap-center:not([inert]) > img").evaluate((i) => i.getAttribute("src") === "/sample/detail/hoop.svg" && i.getBoundingClientRect().height > 600));
  check("the page behind doesn't scroll while it's open", (await page.evaluate(() => document.documentElement.style.overflow)) === "hidden");
  check("focus moves into the lightbox", await page.evaluate(() => !!document.activeElement?.closest("dialog")));
  await page.screenshot({ path: join(shots, "gallery-lightbox-desktop.png") });
  await page.keyboard.press("ArrowRight"); await settle(page);
  check("ArrowRight in the lightbox moves to 4 / 5", (await dialog.locator("p span[aria-hidden]").textContent()) === "4 / 5");
  await dialog.getByRole("button", { name: "Next image" }).click(); await settle(page);
  check("the lightbox next button moves to 5 / 5", (await dialog.locator("p span[aria-hidden]").textContent()) === "5 / 5");
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  check("Escape closes the lightbox", !(await dialog.isVisible()));
  check("closing keeps the image reached in the lightbox, and the page scrolls again", (await counter(page)) === "5 / 5" && (await page.evaluate(() => document.documentElement.style.overflow)) === "");
  check("focus returns to the gallery", await page.evaluate(() => !!document.activeElement?.closest('[aria-roledescription="carousel"]')));
  await g.locator('[aria-roledescription="slide"]:not([inert]) button').click(); await page.waitForTimeout(300);
  await dialog.getByRole("button", { name: "Close larger view" }).click(); await page.waitForTimeout(300);
  check("the close button closes the lightbox", !(await dialog.isVisible()));

  // Existing product page behaviour is unchanged.
  const heart = page.getByRole("button", { name: "Save Everyday Hoop to favourites" });
  await heart.click();
  check("favourites still work beside the gallery", (await page.getByRole("button", { name: "Remove Everyday Hoop from favourites" }).getAttribute("aria-pressed")) === "true");
  await page.getByRole("button", { name: "Remove Everyday Hoop from favourites" }).click();
  await page.locator("label").filter({ hasText: "Silver tone" }).click();
  await page.getByRole("button", { name: "Add to bag", exact: true }).click();
  check("Add to bag still works with the chosen finish", (await page.getByRole("status").filter({ hasText: "Added" }).textContent())?.includes("Added Everyday Hoop, Silver tone."));
  await page.mouse.move(5, 5);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(shots, "gallery-product-desktop.png") });
  await context.close();
}

// Server-rendered HTML holds every image, so nothing waits for JavaScript.
{
  const html = await (await stagingFetch(base + HOOP)).text();
  check("all five images are in the server-rendered HTML", ["/sample/hoop.svg", "/sample/angle/hoop.svg", "/sample/detail/hoop.svg", "/sample/styled/hoop.svg", "/sample/packaging/hoop.svg"].every((s) => html.includes(`src="${s}"`)));
}

// 4, 2 and 1 images
for (const [path, n] of [[SCRUNCHIE, 4], [CHANDBALI, 2]]) {
  const { context, page } = await open(path);
  check(`${n} images: ${n} slides, ${n} thumbnails and a counter of 1 / ${n}`, (await gallery(page).locator('[aria-roledescription="slide"]').count()) === n && (await thumbs(page).count()) === n && (await counter(page)) === `1 / ${n}`);
  await gallery(page).getByRole("button", { name: "Next image" }).click(); await settle(page);
  check(`${n} images: next moves to 2 / ${n}`, (await counter(page)) === `2 / ${n}`);
  await context.close();
}
{
  const { context, page } = await open(CLIP);
  const g = gallery(page);
  check("1 image: one slide, with no arrows, counter or thumbnails", (await g.locator('[aria-roledescription="slide"]').count()) === 1 && (await g.getByRole("button", { name: /Next image|Previous image/ }).count()) === 0 && (await thumbs(page).count()) === 0 && (await counter(page)) === null);
  await g.locator('[aria-roledescription="slide"] button').click(); await page.waitForTimeout(300);
  check("1 image: the lightbox still opens", await page.getByRole("dialog").isVisible());
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  check("1 image: Escape closes it", !(await page.getByRole("dialog").isVisible()));
  await context.close();
}

// A missing image: the placeholder takes its place, in the slide and the thumbnail, and the rest still work.
{
  const { context, page } = await open(HOOP, {}, (c) => c.route("**/sample/angle/hoop.svg", (r) => r.abort()));
  await page.waitForTimeout(300);
  await gallery(page).getByRole("button", { name: "Next image" }).click(); await settle(page);
  const slide = gallery(page).locator('[aria-roledescription="slide"]:not([inert])');
  check("a missing image shows the NÉVORA placeholder instead of a broken image", (await slide.getByRole("img", { name: "Image not available" }).count()) === 1 && (await slide.locator("img").count()) === 0);
  check("its thumbnail shows the placeholder too", (await thumbs(page).nth(1).getByRole("img", { name: "Image not available" }).count()) === 1);
  await gallery(page).getByRole("button", { name: "Next image" }).click(); await settle(page);
  check("the next image still loads after a missing one", (await current(page)) === "/sample/detail/hoop.svg" && (await counter(page)) === "3 / 5");
  await context.close();
}

// Phone: a real touch swipe, tappable thumbnails, no sideways scrolling.
{
  const { context, page } = await open(HOOP, { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const box = await gallery(page).locator('[aria-roledescription="slide"]').first().boundingBox();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.synthesizeScrollGesture", { x: Math.round(box.x + box.width * 0.8), y: Math.round(box.y + box.height / 2), xDistance: -Math.round(box.width * 0.6), yDistance: 0, gestureSourceType: "touch", speed: 1200 });
  await settle(page);
  check("phone: swiping left moves to 2 / 5", (await counter(page)) === "2 / 5" && (await current(page)) === "/sample/angle/hoop.svg");
  const now = await gallery(page).locator('[aria-roledescription="slide"]').nth(1).boundingBox();
  await cdp.send("Input.synthesizeScrollGesture", { x: Math.round(now.x + now.width * 0.2), y: Math.round(now.y + now.height / 2), xDistance: Math.round(now.width * 0.6), yDistance: 0, gestureSourceType: "touch", speed: 1200 });
  await settle(page);
  check("phone: swiping right moves back to 1 / 5", (await counter(page)) === "1 / 5");
  const thumb = thumbs(page).nth(2);
  const tb = await thumb.boundingBox();
  check("phone: thumbnails are visible and at least 44px tall", (await thumb.isVisible()) && tb.height >= 44, `${tb.width} × ${tb.height}`);
  await thumb.tap(); await settle(page);
  check("phone: tapping a thumbnail shows that image", (await counter(page)) === "3 / 5");
  check("phone: no sideways scrolling", await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(shots, "gallery-product-mobile.png") });
  await gallery(page).locator('[aria-roledescription="slide"]:not([inert]) button').tap(); await page.waitForTimeout(400);
  await page.screenshot({ path: join(shots, "gallery-lightbox-mobile.png") });
  await page.getByRole("dialog").getByRole("button", { name: "Close larger view" }).tap(); await page.waitForTimeout(300);
  check("phone: the lightbox opens and closes by tap", !(await page.getByRole("dialog").isVisible()));
  await context.close();
}

// Tablet layout
{
  const { context, page } = await open(HOOP, { viewport: { width: 820, height: 1180 } });
  check("tablet: no sideways scrolling", await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await page.screenshot({ path: join(shots, "gallery-product-tablet.png") });
  await context.close();
}

check("no page errors or console errors", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(`\n${failed === 0 ? "All passed" : `${failed} failed`}. Screenshots in ${shots}`);
process.exit(failed ? 1 : 0);
