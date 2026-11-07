// Takes screenshots of a local build. Usage: node scripts/shots.mjs <phase> <route> [route...]
import { mkdirSync } from "node:fs";
import { launchBrowser } from "./lib/staging-auth.mjs";

const [phase, ...routes] = process.argv.slice(2);
const base = process.env.BASE_URL ?? "http://localhost:3100";
const out = new URL(`../screenshots/${phase}/`, import.meta.url);
mkdirSync(out, { recursive: true });

const browser = await launchBrowser();
for (const [label, width, height] of [["desktop", 1440, 900], ["mobile", 360, 740]]) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce" }); // Full-page shots never scroll, so show the settled state.
  const page = await context.newPage();
  for (const route of routes) {
    await page.goto(base + route, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 300) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 150)); }
      window.scrollTo(0, 0);
    });
    // Wait for real lazy loading to finish, without forcing it.
    // Bounded, so an image that never loads shows up as a blank in the shot instead of hanging the run.
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 8000 }).catch(() => console.log(`${route}: some images hadn't loaded after 8 s`));
    await page.waitForTimeout(800);
    const name = route === "/" ? "home" : route.replace(/^\//, "").replace(/[/?=&]/g, "-");
    await page.screenshot({ path: new URL(`${name}-${label}.png`, out).pathname, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    console.log(`${name}-${label}: ${overflow ? "SIDEWAYS SCROLL" : "ok"}`);
  }
  await context.close();
}
await browser.close();
