// Runs axe-core on local pages, on desktop and phone sizes. Usage: node scripts/a11y.mjs <route> [route...]
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { launchBrowser } from "./lib/staging-auth.mjs";

const routes = process.argv.slice(2);
// Without routes nothing would be checked, and "No violations" would be meaningless.
if (routes.length === 0) { console.error("Usage: node scripts/a11y.mjs <route> [route...]  (no routes given, nothing checked)"); process.exit(2); }
const base = process.env.BASE_URL ?? "http://localhost:3100";
const axe = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const browser = await launchBrowser();
let total = 0;
for (const [label, width, height] of [["desktop", 1440, 900], ["mobile", 360, 740]]) {
  const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
  for (const route of routes) {
    await page.goto(base + route, { waitUntil: "networkidle" });
    await page.evaluate(axe);
    const { violations, passes } = await page.evaluate(() => window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"] }));
    total += violations.length;
    console.log(`${route} ${label}: ${violations.length} violations, ${passes.length} rules passed`);
    for (const v of violations) console.log(`  ${v.impact} ${v.id}: ${v.nodes.length} x ${v.nodes[0].target.join(" ")} | ${v.help}`);
  }
}
await browser.close();
console.log(total ? `\n${total} violation types` : "\nNo violations");
process.exit(total ? 1 : 0);
