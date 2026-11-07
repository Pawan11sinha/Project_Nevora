// Measures compressed JavaScript actually downloaded per page. Usage: node scripts/measure-js.mjs <label>
import { writeFileSync } from "node:fs";
import { launchBrowser } from "./lib/staging-auth.mjs";
const label = process.argv[2] ?? "run";
const base = process.env.BASE_URL ?? "http://localhost:3100";
const browser = await launchBrowser();
const results = {};
for (const route of ["/", "/categories/jewellery", "/collections/korean-edit", "/products/sample-dome-jhumka"]) {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send("Network.enable");
  const types = new Map(); let js = 0, jsCount = 0, css = 0, html = 0, total = 0;
  client.on("Network.responseReceived", (e) => types.set(e.requestId, e.type));
  client.on("Network.loadingFinished", (e) => {
    const type = types.get(e.requestId); total += e.encodedDataLength;
    if (type === "Script") { js += e.encodedDataLength; jsCount++; }
    if (type === "Stylesheet") css += e.encodedDataLength;
    if (type === "Document") html += e.encodedDataLength;
  });
  await page.goto(base + route, { waitUntil: "networkidle" });
  await page.evaluate(() => new Promise((resolve) => {
    let cls = 0;
    new PerformanceObserver((l) => { const e = l.getEntries().at(-1); if (e) window.__lcp = Math.round(e.startTime); }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    setTimeout(() => { window.__cls = cls; resolve(); }, 600);
  }));
  results[route] = { jsKB: +(js / 1024).toFixed(1), jsFiles: jsCount, cssKB: +(css / 1024).toFixed(1), htmlKB: +(html / 1024).toFixed(1), totalKB: +(total / 1024).toFixed(1), cls: +(await page.evaluate(() => window.__cls)).toFixed(4), lcpMs: await page.evaluate(() => window.__lcp) };
  await context.close();
}
await browser.close();
console.table(results);
writeFileSync(new URL(`../screenshots/js-${label}.json`, import.meta.url), JSON.stringify(results, null, 2));
