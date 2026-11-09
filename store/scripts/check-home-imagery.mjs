// The homepage's Shop by category and Shop by aesthetic photo cards, in a real browser at desktop, tablet and phone
// sizes: each card has its own photo that loads as WebP from static files, cards in a section share one shape, text
// isn't clipped, nothing overflows sideways, nothing shifts as photos load, hover is subtle, and every card opens its
// existing route. Screenshots of both sections go to SHOTS_DIR (default: screenshots/imagery, which Git ignores).
//   BASE_URL=http://localhost:8787 SHOTS_DIR=/tmp/shots node scripts/check-home-imagery.mjs
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { launchBrowser } from "./lib/staging-auth.mjs";

const base = (process.env.BASE_URL ?? "http://localhost:3100").replace(/\/$/, "");
const shots = process.env.SHOTS_DIR ?? new URL("../screenshots/imagery/", import.meta.url).pathname;
mkdirSync(shots, { recursive: true });
let failed = 0;
const check = (name, pass, detail = "") => { console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!pass) failed++; };
const errors = [];
const browser = await launchBrowser();

const CATEGORIES = [["Jewellery", "/categories/jewellery"], ["Hair Accessories", "/categories/hair-accessories"]];
const AESTHETICS = [["Korean Edit", "/collections/korean-edit"], ["Coquette Edit", "/collections/coquette-edit"], ["Minimal Edit", "/collections/minimal-edit"]];

// The cards of one section: the link, its photo and the photo's frame.
const cards = (page, sectionTitle) => page.locator("section").filter({ has: page.getByRole("heading", { name: sectionTitle, exact: true }) }).locator("li a").evaluateAll((links) => links.map((a) => {
  const img = a.querySelector("img");
  const frame = img?.parentElement === a ? a : img?.parentElement;
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: Math.round(r.width), h: Math.round(r.height), bottom: r.bottom, right: r.right }; };
  const h3 = a.querySelector("h3");
  return {
    name: h3?.textContent, href: a.getAttribute("href"), alt: img?.alt, loading: img?.loading, src: img?.currentSrc,
    loaded: !!img && img.complete && img.naturalWidth > 0, hasSize: !!img?.getAttribute("width") && !!img?.getAttribute("height"),
    frame: frame && box(frame), link: box(a), heading: h3 && box(h3),
  };
}));

for (const [label, width, height] of [["desktop", 1440, 900], ["tablet", 820, 1180], ["mobile", 375, 812]]) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: label === "mobile", hasTouch: label === "mobile" });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  // Sum of layout shifts of anything inside the two photo sections, while the page loads and is scrolled through so
  // lazy photos are fetched. (The hero above has its own, separate load shift, found on 8 Nov and tracked apart.)
  await page.addInitScript(() => {
    window.__cls = 0;
    const ours = (n) => !!n?.closest?.('section[aria-labelledby="categories-title"], section[aria-labelledby="aesthetic-title"]');
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput && e.sources.some((s) => ours(s.node))) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  for (let y = 0; y < 6000; y += 500) { await page.mouse.wheel(0, 500); await page.waitForTimeout(80); }
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => [...document.querySelectorAll("main section li a img")].every((i) => i.complete), null, { timeout: 10000 }).catch(() => {});

  for (const [title, expected, folder] of [["Shop by category", CATEGORIES, "/images/categories/"], ["Shop by aesthetic", AESTHETICS, "/images/aesthetics/"]]) {
    const list = await cards(page, title);
    check(`${label}: ${title} has the expected cards and routes`, JSON.stringify(list.map((c) => [c.name, c.href])) === JSON.stringify(expected), JSON.stringify(list.map((c) => [c.name, c.href])));
    check(`${label}: ${title} photos load as WebP from ${folder}`, list.every((c) => c.loaded && new URL(c.src).pathname.startsWith(folder) && c.src.endsWith(".webp")), JSON.stringify(list.map((c) => [c.name, c.loaded, c.src && new URL(c.src).pathname])));
    const files = list.map((c) => new URL(c.src).pathname.replace(/-\d+w\.webp$/, ""));
    check(`${label}: ${title} uses a different photo on every card`, new Set(files).size === list.length, files.join(", "));
    check(`${label}: ${title} photos have alt text, reserved dimensions and lazy loading`, list.every((c) => c.alt?.length > 20 && c.hasSize && c.loading === "lazy"));
    check(`${label}: ${title} cards share one shape`, list.every((c) => Math.abs(c.frame.w - list[0].frame.w) <= 1 && Math.abs(c.frame.h - list[0].frame.h) <= 1), JSON.stringify(list.map((c) => [c.frame.w, c.frame.h])));
    check(`${label}: ${title} headings sit inside their cards`, list.every((c) => c.heading.x >= c.link.x - 1 && c.heading.right <= c.link.right + 1 && c.heading.bottom <= c.link.bottom + 1));
  }
  const cats = await cards(page, "Shop by category");
  check(`${label}: the two category photos are visually distinct files`, cats[0].src !== cats[1].src && !cats[1].src.includes("jewellery"));
  check(`${label}: no sideways scrolling`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), String(await page.evaluate(() => document.documentElement.scrollWidth)));
  const cls = await page.evaluate(() => window.__cls);
  check(`${label}: nothing in the photo sections shifts as photos load (CLS ${cls.toFixed(4)})`, cls < 0.01);

  for (const title of ["Shop by category", "Shop by aesthetic"]) {
    const section = page.locator("section").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await section.screenshot({ path: join(shots, `${title.toLowerCase().replace(/\s+/g, "-")}-${label}.png`), animations: "disabled" });
  }

  if (label === "desktop") {
    // Hover: the photo zooms gently and nothing else moves.
    const link = page.locator('section[aria-labelledby="categories-title"] li a').filter({ has: page.getByRole("heading", { name: "Jewellery", exact: true }) });
    await link.scrollIntoViewIfNeeded();
    const before = await link.boundingBox();
    await link.hover();
    await page.waitForTimeout(900);
    // Tailwind v4's scale utilities set the CSS `scale` property, not `transform`.
    const scale = await link.locator("img").evaluate((i) => Number(getComputedStyle(i).scale) || 1);
    const after = await link.boundingBox();
    check("desktop: hovering a category card zooms its photo slightly, and the card keeps its size", scale > 1 && scale < 1.06 && before.width === after.width && before.height === after.height, `scale ${scale}`);
    check("desktop: hovering underlines Shop now", await link.getByText("Shop now").evaluate((s) => getComputedStyle(s).textDecorationLine.includes("underline")));
    await page.mouse.move(5, 5);

    // Every card opens its existing route, which loads with the right heading.
    for (const [name, href] of [...CATEGORIES, ...AESTHETICS]) {
      await page.goto(`${base}/`, { waitUntil: "networkidle" });
      const card = page.locator("main li a").filter({ has: page.getByRole("heading", { name, exact: true }) }).first();
      await card.scrollIntoViewIfNeeded();
      await card.click();
      await page.waitForURL(`**${href}`);
      const h1 = await page.locator("h1").first().textContent();
      check(`${name} card opens ${href}`, new URL(page.url()).pathname === href && h1.trim().length > 0, h1);
    }
  }
  if (label === "mobile") {
    // On phones the whole card is the tap target.
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    const card = page.locator("main li a").filter({ has: page.getByRole("heading", { name: "Hair Accessories", exact: true }) }).first();
    await card.scrollIntoViewIfNeeded();
    await card.tap();
    await page.waitForURL("**/categories/hair-accessories");
    check("mobile: tapping a category card opens it", new URL(page.url()).pathname === "/categories/hair-accessories");
  }
  await context.close();
}

check("no page errors or console errors", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(`\n${failed === 0 ? "All passed" : `${failed} failed`}. Screenshots in ${shots}`);
process.exit(failed ? 1 : 0);
