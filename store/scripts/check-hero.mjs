// Homepage hero carousel in a real browser: rotation timing, fades, controls, pausing, reduced motion, swipe, links,
// no-JavaScript fallback, responsive images and layout.
//   BASE_URL=http://localhost:8787 node scripts/check-hero.mjs
import { launchBrowser, stagingFetch } from "./lib/staging-auth.mjs";
const base = (process.env.BASE_URL ?? "http://localhost:3100").replace(/\/$/, "");
let failed = 0;
const check = (name, pass, detail = "") => { console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!pass) failed++; };
const errors = [];
const browser = await launchBrowser();
const EXPECTED = [
  ["Fresh pieces for every day", "/collections/new-arrivals"],
  ["Made for evenings that glow", "/categories/jewellery/jhumkas-chandbalis"],
  ["Quiet pieces, worn on repeat", "/collections/minimal-edit"],
];

async function open(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  return { context, page };
}
const active = (page) => page.evaluate(() => [...document.querySelectorAll('#hero-slides > [role="group"]')].findIndex((s) => s.getAttribute("aria-hidden") !== "true"));
const away = (page) => page.mouse.move(5, page.viewportSize().height - 5);
// Waits until the active slide changes, returning the time taken, or null if it didn't change within `limit` ms.
async function timeToChange(page, limit) {
  const start = await active(page);
  const t0 = Date.now();
  while (Date.now() - t0 < limit) {
    if ((await active(page)) !== start) return Date.now() - t0;
    await page.waitForTimeout(100);
  }
  return null;
}

// ---- Server HTML and no JavaScript ----
{
  const html = await (await stagingFetch(`${base}/`)).text();
  check("the hero is server-rendered as a carousel with 3 slides", html.includes('aria-roledescription="carousel"') && (html.match(/aria-roledescription="slide"/g) ?? []).length === 3);
  check("every slide is labelled Sample campaign in the HTML", (html.match(/Sample campaign/g) ?? []).length >= 3);
  check("the original static hero isn't shown while campaigns are live", !html.includes("Your everyday"));
  check("sections below the hero are unchanged", ["Shop by category", "New arrivals", "Shop by aesthetic", "Trending now"].every((t) => html.toLowerCase().includes(t.toLowerCase())));
  const { context, page } = await open({ javaScriptEnabled: false });
  const row = await page.evaluate(() => { const t = document.getElementById("hero-slides"); const s = getComputedStyle(t); return { overflow: s.overflowX, slides: t.children.length, visible: t.children[0].getBoundingClientRect().width > 0, controls: !!document.querySelector('[aria-label="Next slide"]') }; });
  check("without JavaScript the slides are a swipeable row, nothing hidden", row.overflow === "auto" && row.slides === 3 && row.visible, JSON.stringify(row));
  check("without JavaScript no controls are shown (they need it)", !row.controls);
  await context.close();
}

// ---- Desktop, normal motion ----
{
  const { context, page } = await open();
  await away(page);
  // Role queries skip hidden slides, so count the slide elements themselves.
  const groups = await page.locator('#hero-slides > [role="group"][aria-roledescription="slide"]:has(h2)').count();
  check("3 slides with headings", groups === 3);
  for (let i = 0; i < 3; i++) {
    const href = await page.locator('#hero-slides > [role="group"]').nth(i).locator("a").getAttribute("href");
    const heading = await page.locator('#hero-slides > [role="group"]').nth(i).locator("h2").textContent();
    check(`slide ${i + 1}: "${heading}" links to ${href}`, heading === EXPECTED[i][0] && href === EXPECTED[i][1]);
    const status = (await stagingFetch(base + href)).status;
    check(`slide ${i + 1}: its destination loads`, status === 200, String(status));
  }
  check("only slide 1 is shown at first; others are hidden and not focusable", await page.evaluate(() => { const s = [...document.querySelectorAll('#hero-slides > [role="group"]')]; return s[0].getAttribute("aria-hidden") !== "true" && s.slice(1).every((x) => x.getAttribute("aria-hidden") === "true" && x.inert); }));
  check("slides fade (opacity transition)", await page.evaluate(() => { const st = getComputedStyle(document.querySelector('#hero-slides > [role="group"]')); return st.transitionProperty.includes("opacity") && parseFloat(st.transitionDuration) >= 0.5; }));
  check("the rotation announces nothing while it runs (aria-live off)", (await page.locator("#hero-slides").getAttribute("aria-live")) === "off");
  // The first change comes 5 seconds after the page became interactive, before measuring began, so it's only checked
  // to happen; the next two are timed in full.
  check("rotates automatically", (await timeToChange(page, 7000)) !== null && (await active(page)) === 1);
  const t1 = await timeToChange(page, 7000);
  const t2 = await timeToChange(page, 7000);
  check("rotates every 5 seconds", [t1, t2].every((t) => t !== null && t >= 4600 && t <= 5800) && (await active(page)) === 0, `${t1} ms, ${t2} ms, back to slide ${(await active(page)) + 1}`);
  // Controls
  await page.getByRole("button", { name: /Show slide 3 of 3/ }).click();
  await page.getByRole("button", { name: "Next slide" }).click();
  check("next wraps from the last slide to the first", (await active(page)) === 0);
  await page.getByRole("button", { name: "Previous slide" }).click();
  check("previous wraps from the first slide to the last", (await active(page)) === 2);
  await page.getByRole("button", { name: /Show slide 2 of 3/ }).click();
  check("a dot shows its slide and is marked current", (await active(page)) === 1 && (await page.getByRole("button", { name: /Show slide 2 of 3/ }).getAttribute("aria-current")) === "true");
  check("controls never open the banner link", new URL(page.url()).pathname === "/");
  // Hover pause
  await page.locator("#hero-slides").hover();
  check("hovering pauses the rotation", (await timeToChange(page, 6500)) === null);
  await away(page);
  check("moving away resumes it", (await timeToChange(page, 6500)) !== null);
  // Pause button
  await page.getByRole("button", { name: "Pause slideshow" }).click();
  await away(page);
  check("the pause button stops the rotation", (await timeToChange(page, 6500)) === null && (await page.getByRole("button", { name: "Play slideshow" }).count()) === 1);
  check("while paused, slide changes are announced (aria-live polite)", (await page.locator("#hero-slides").getAttribute("aria-live")) === "polite");
  await page.getByRole("button", { name: "Play slideshow" }).click();
  await away(page);
  check("the play button restarts it", (await timeToChange(page, 6500)) !== null);
  // Hidden tab
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
  check("a hidden tab pauses the rotation", (await timeToChange(page, 6500)) === null);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); document.dispatchEvent(new Event("visibilitychange")); });
  check("showing the tab resumes it", (await timeToChange(page, 6500)) !== null);
  // Keyboard
  await page.getByRole("button", { name: "Next slide" }).focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  check("keyboard focus pauses the rotation", (await timeToChange(page, 6500)) === null);
  const current = await active(page);
  await page.keyboard.press("Enter");
  check("Enter on the focused Next button moves on", (await active(page)) === (current + 1) % 3);
  // Mouse drag swipe
  const box = await page.locator("#hero-slides").boundingBox();
  const before = await active(page);
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.42, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  check("dragging left moves to the next slide without opening the link", (await active(page)) === (before + 1) % 3 && new URL(page.url()).pathname === "/");
  // Images and layout
  const img = await page.evaluate(() => document.querySelector('#hero-slides > [role="group"] img').currentSrc);
  check("desktop uses the desktop image", img.endsWith("-desktop.svg"), img);
  const sizes = await page.evaluate(() => { const r = document.querySelector('#hero-slides a').getBoundingClientRect(); return { w: r.width, h: r.height, vw: document.documentElement.clientWidth }; });
  check("the banner is full width", Math.abs(sizes.w - sizes.vw) <= 1, JSON.stringify(sizes));
  check("the first image loads eagerly with high priority; the others lazily", await page.evaluate(() => { const i = [...document.querySelectorAll("#hero-slides img")]; return i[0].loading === "eager" && i[0].getAttribute("fetchpriority") === "high" && i.slice(1).every((x) => x.loading === "lazy"); }));
  // Clicking the banner opens its destination
  await away(page);
  await page.getByRole("button", { name: /Show slide 3 of 3/ }).click();
  await page.locator('#hero-slides > [role="group"]').nth(2).locator("h2").click();
  await page.waitForURL(`**${EXPECTED[2][1]}`);
  check("clicking anywhere on the banner opens its collection", new URL(page.url()).pathname === EXPECTED[2][1]);
  await context.close();
}

// ---- Reduced motion ----
{
  const { context, page } = await open({ reducedMotion: "reduce" });
  await away(page);
  check("reduced motion: no automatic rotation", (await timeToChange(page, 6500)) === null);
  check("reduced motion: the control offers Play", (await page.getByRole("button", { name: "Play slideshow" }).count()) === 1);
  check("reduced motion: no fade", await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#hero-slides > [role="group"]')).transitionDuration) < 0.05));
  await page.getByRole("button", { name: "Next slide" }).click();
  check("reduced motion: next still works", (await active(page)) === 1);
  await context.close();
}

// ---- Phone ----
{
  const { context, page } = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  check("phone: no sideways scroll", await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  const img = await page.evaluate(() => document.querySelector('#hero-slides > [role="group"] img').currentSrc);
  check("phone uses the mobile image", img.endsWith("-mobile.svg"), img);
  const layout = await page.evaluate(() => {
    const slide = document.querySelector('#hero-slides > [role="group"]');
    const hero = slide.querySelector("a").getBoundingClientRect();
    const cta = [...slide.querySelectorAll("a span")].find((s) => /Shop new arrivals/.test(s.textContent)).getBoundingClientRect();
    const controls = document.querySelector('[aria-label="Next slide"]').getBoundingClientRect();
    return { heroBottom: hero.bottom, ctaBottom: cta.bottom, controlsTop: controls.top, inView: hero.bottom <= innerHeight + 1 };
  });
  check("phone: the button sits above the controls, all within the banner", layout.ctaBottom < layout.controlsTop && layout.controlsTop < layout.heroBottom, JSON.stringify(layout));
  const small = await page.evaluate(() => [...document.querySelectorAll('section[aria-roledescription="carousel"] button')].filter((b) => { const r = b.getBoundingClientRect(); return r.width < 24 || r.height < 24; }).length);
  check("phone: every control is at least 24px", small === 0);
  // Touch swipe through the DevTools protocol, as a real finger would.
  const cdp = await context.newCDPSession(page);
  const box = await page.locator("#hero-slides").boundingBox();
  const y = box.y + box.height * 0.7;
  const before = await active(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + 300, y }] });
  for (const x of [260, 200, 140, 90]) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: box.x + x, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(400);
  check("phone: swiping left moves to the next slide without opening the link", (await active(page)) === (before + 1) % 3 && new URL(page.url()).pathname === "/", `slide ${before + 1} to ${(await active(page)) + 1}`);
  await page.getByRole("button", { name: "Previous slide" }).tap();
  check("phone: tapping previous goes back", (await active(page)) === before);
  await context.close();
}

// No layout shift while the page loads and the carousel takes over from the no-JavaScript row, through the first
// automatic slide change. (Fixed 8 Nov 2026: switching the slides from a flex row to a grid scored up to 0.77.)
for (const [width, height] of [[1440, 900], [820, 1180], [375, 812]]) {
  for (const reducedMotion of ["no-preference", "reduce"]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion });
    await context.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); });
    const page = await context.newPage();
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(6500);
    const cls = await page.evaluate(() => window.__cls);
    check(`no layout shift on load at ${width}px, ${reducedMotion} (CLS ${cls.toFixed(4)})`, cls < 0.01);
    await context.close();
  }
}

check("no console or page errors", errors.length === 0, errors.slice(0, 3).join(" | ").slice(0, 300));
await browser.close();
process.exit(failed ? 1 : 0);
