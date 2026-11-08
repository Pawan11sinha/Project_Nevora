// The announcement ticker in a real browser: slim, labelled as sample, scrolling right to left with several messages
// visible, pausing on hover, focus and the pause button, working links, reduced motion, no-JavaScript row, phone layout.
//   BASE_URL=http://localhost:8787 node scripts/check-announcements.mjs
import { launchBrowser, stagingFetch } from "./lib/staging-auth.mjs";
const base = (process.env.BASE_URL ?? "http://localhost:3100").replace(/\/$/, "");
let failed = 0;
const check = (name, pass, detail = "") => { console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!pass) failed++; };
const errors = [];
const browser = await launchBrowser();
const BAR = 'aside[aria-label="Announcements"]';

async function open(options = {}, path = "/") {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(base + path, { waitUntil: "networkidle" });
  return { context, page };
}
// The track's horizontal offset in pixels (0 at the start, more negative as it moves left).
const offset = (page) => page.evaluate(() => new DOMMatrix(getComputedStyle(document.getElementById("announcement-messages")).transform).m41);
const away = (page) => page.mouse.move(5, page.viewportSize().height - 5);
const moved = async (page, ms = 1500) => { const a = await offset(page); await page.waitForTimeout(ms); return (await offset(page)) - a; };

{
  const html = await (await stagingFetch(`${base}/`)).text();
  check("the bar is in the server HTML, before the navigation", html.indexOf('aria-label="Announcements"') > -1 && html.indexOf('aria-label="Announcements"') < html.indexOf("<header"));
  check("a Sample label is always shown", /Sample<span class="sr-only"> announcements<\/span>/.test(html));
  check("the prototype notice is the first message", html.includes("Prototype only: nothing is for sale yet"));
  const { context, page } = await open({ javaScriptEnabled: false });
  const row = await page.evaluate(() => { const m = document.getElementById("announcement-messages"); return { overflow: getComputedStyle(m).overflowX, lists: m.children.length, items: m.querySelectorAll("li").length, animation: getComputedStyle(m).animationName }; });
  check("without JavaScript the messages are a still row you can scroll", row.overflow === "auto" && row.lists === 1 && row.items === 5 && row.animation === "none", JSON.stringify(row));
  await context.close();
}

{
  const { context, page } = await open();
  await away(page);
  const bar = await page.locator(BAR).boundingBox();
  check("the bar is slim (40px or less) and full width", bar.height <= 40 && bar.width >= 1439, `${bar.height}px`);
  const visible = await page.evaluate(() => { const box = document.getElementById("announcement-messages").parentElement.getBoundingClientRect(); return [...document.querySelectorAll("#announcement-messages li")].filter((li) => { const r = li.getBoundingClientRect(); return r.right > box.left && r.left < box.right; }).length; });
  check("several messages are visible at once on desktop", visible >= 3, `${visible} visible`);
  const d = await moved(page);
  check("the ticker scrolls from right to left", d < -20, `${Math.round(d)}px in 1.5s`);
  check("at a steady, readable speed (about 40px a second)", Math.abs(d / 1.5 + 40) <= 12, `${Math.round(-d / 1.5)}px/s`);
  check("only the first copy of the messages is read or focusable", await page.evaluate(() => { const lists = [...document.querySelectorAll("#announcement-messages > ul")]; return lists.length === 4 && !lists[0].hasAttribute("aria-hidden") && lists.slice(1).every((l) => l.getAttribute("aria-hidden") === "true" && l.inert); }));
  // Playwright's hover() waits for the element to stop moving, which a ticker never does, so move the mouse directly.
  const strip = await page.locator("#announcement-messages").evaluate((el) => { const r = el.parentElement.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(strip.x, strip.y);
  check("hovering pauses it", Math.abs(await moved(page)) < 2);
  await away(page);
  check("moving away resumes it", (await moved(page)) < -20);
  await page.getByRole("button", { name: "Pause announcements" }).click();
  await away(page);
  const pausedAt = await offset(page);
  check("the pause button stops it where it is", Math.abs(await moved(page)) < 2 && pausedAt < 0 && (await page.getByRole("button", { name: "Play announcements" }).count()) === 1);
  await page.getByRole("button", { name: "Play announcements" }).click();
  await away(page);
  check("play restarts it", (await moved(page)) < -20);
  await page.locator("#announcement-messages > ul").first().locator("a").first().focus();
  check("keyboard focus on a message pauses it", Math.abs(await moved(page)) < 2);
  const links = await page.evaluate(() => [...document.querySelectorAll("#announcement-messages > ul:first-child a")].map((a) => a.getAttribute("href")));
  check("four messages link to collections or categories", links.length === 4, links.join(" "));
  for (const href of links) {
    const status = (await stagingFetch(base + href)).status;
    check(`announcement link ${href} loads`, status === 200, String(status));
  }
  await page.getByRole("button", { name: "Pause announcements" }).click();
  const link = page.locator("#announcement-messages > ul").first().locator("a").first();
  const href = await link.getAttribute("href");
  await link.click();
  await page.waitForURL(`**${href}`);
  check("clicking a message opens its page", new URL(page.url()).pathname === href, href);
  check("the bar is on other pages too", (await page.locator(BAR).count()) === 1);
  await context.close();
}

{
  const { context, page } = await open({ reducedMotion: "reduce" });
  await away(page);
  const still = await page.evaluate(() => getComputedStyle(document.getElementById("announcement-messages")).overflowX === "auto");
  check("reduced motion: the messages stay still in a scrollable row, with Play offered", still && Math.abs(await moved(page)) < 2 && (await page.getByRole("button", { name: "Play announcements" }).count()) === 1);
  await page.getByRole("button", { name: "Play announcements" }).click();
  await away(page);
  check("reduced motion: pressing Play does start the ticker", (await moved(page)) < -20);
  await context.close();
}

{
  const { context, page } = await open({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  const bar = await page.locator(BAR).boundingBox();
  check("phone: the bar stays slim", bar.height <= 40, `${bar.height}px`);
  check("phone: no sideways scroll", await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  check("phone: the ticker scrolls", (await moved(page)) < -20);
  const button = await page.getByRole("button", { name: "Pause announcements" }).boundingBox();
  check("phone: the pause control is at least 24px", button.width >= 24 && button.height >= 24);
  await context.close();
}

check("no console or page errors", errors.length === 0, errors.slice(0, 3).join(" | ").slice(0, 300));
await browser.close();
process.exit(failed ? 1 : 0);
