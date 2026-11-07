// Phone layout and reveal safety: failed or slow scripts, reduced motion, sideways scroll, tap targets.
import { launchBrowser } from "./lib/staging-auth.mjs";
const base = process.env.BASE_URL ?? "http://localhost:3100";
let failed = 0;
const check = (name, pass, detail = "") => { console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!pass) failed++; };
const browser = await launchBrowser();
// Each section must be fully visible once it's on screen, however scripts behaved.
const visibleWhenReached = (page) => page.evaluate(async () => {
  const out = [];
  for (const el of document.querySelectorAll(".reveal")) {
    el.scrollIntoView({ block: "center", behavior: "instant" });
    await new Promise((r) => setTimeout(r, 200));
    out.push(getComputedStyle(el).opacity);
  }
  return out;
});
const allOpaque = (list) => list.length >= 4 && list.every((v) => Number(v) > 0.99);
const newPage = async (options = {}) => (await browser.newContext({ viewport: { width: 360, height: 740 }, ...options })).newPage();

const normal = await newPage();
await normal.goto(`${base}/`, { waitUntil: "networkidle" });
check("hero is visible immediately, and isn't animated", await normal.evaluate(() => !document.querySelector("h1").closest(".reveal") && getComputedStyle(document.querySelector("h1")).opacity === "1"));
let list = await visibleWhenReached(normal);
check("every section is visible when reached", allOpaque(list), list.join(","));
check("reveal really animates in this browser", await normal.evaluate(() => getComputedStyle(document.querySelector(".reveal")).animationName === "reveal"));

const reduced = await newPage({ reducedMotion: "reduce" });
await reduced.goto(`${base}/`, { waitUntil: "networkidle" });
check("reduced motion: no animation", await reduced.evaluate(() => [...document.querySelectorAll(".reveal")].every((e) => getComputedStyle(e).animationName === "none" && getComputedStyle(e).opacity === "1")));

const nojs = await newPage({ javaScriptEnabled: false });
await nojs.goto(`${base}/`);
const noJsHidden = await nojs.locator(".reveal").count();
check("without JavaScript: sections are in the page", noJsHidden >= 4, `${noJsHidden} sections`);

const blockedContext = await browser.newContext({ viewport: { width: 360, height: 740 } });
await blockedContext.route("**/_next/static/**/*.js", (r) => r.abort());
const blocked = await blockedContext.newPage();
await blocked.goto(`${base}/`, { waitUntil: "load" });
list = await visibleWhenReached(blocked);
check("scripts fail to load: every section still appears", allOpaque(list), list.join(","));

const slowContext = await browser.newContext({ viewport: { width: 360, height: 740 } });
await slowContext.route("**/_next/static/**/*.js", async (r) => { await new Promise((s) => setTimeout(s, 4000)); await r.fallback().catch(() => {}); });
const slow = await slowContext.newPage();
await slow.goto(`${base}/`, { waitUntil: "commit" });
await slow.waitForSelector(".reveal", { state: "attached" });
list = await visibleWhenReached(slow);
check("scripts delayed 4 s: every section already appears", allOpaque(list), list.join(","));

for (const width of [320, 360, 768, 1024, 1440]) {
  const page = await (await browser.newContext({ viewport: { width, height: 800 } })).newPage();
  for (const route of ["/", "/categories/jewellery", "/products/sample-dome-jhumka", "/bag"]) {
    await page.goto(base + route, { waitUntil: "networkidle" });
    check(`no sideways scroll at ${width}px on ${route}`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  }
  await page.context().close();
}
const phone = await (await browser.newContext({ viewport: { width: 360, height: 740 } })).newPage();
await phone.goto(`${base}/`, { waitUntil: "networkidle" });
const logoOffset = await phone.evaluate(() => { const r = document.querySelector("body > header a[href='/']").getBoundingClientRect(); return Math.abs((r.left + r.right) / 2 - document.documentElement.clientWidth / 2); });
check("logo is centred on phones", logoOffset <= 2, `${logoOffset.toFixed(1)}px off centre`);
const headerButtons = await phone.locator("body > header button:visible").count();
const headerBag = await phone.locator("body > header a[href='/bag']:visible").count();
check("phone header shows only menu and bag", headerButtons === 1 && headerBag === 1, `${headerButtons} buttons, ${headerBag} bag link`);
const touch = await (await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true })).newPage();
for (const route of ["/", "/categories/jewellery", "/products/sample-dome-jhumka"]) {
  await touch.goto(base + route, { waitUntil: "networkidle" });
  const small = await touch.evaluate(() => [...document.querySelectorAll("main a, main button, main summary, main select, main label:has(input), header a, header button")].filter((e) => e.offsetParent && e.closest("nav[aria-label='Breadcrumb']") === null).filter((e) => { const r = e.getBoundingClientRect(); return r.height < 24 || r.width < 24; }).map((e) => (e.getAttribute("aria-label") || e.textContent).trim().slice(0, 30)));
  check(`tap targets at least 24px on ${route}`, small.length === 0, small.slice(0, 4).join(" | "));
}
await browser.close();
process.exit(failed ? 1 : 0);
