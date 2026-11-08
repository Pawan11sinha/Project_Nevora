// Homepage content P0 in a real browser: the feature-availability fallback, footer groups, FAQ page, Privacy and Terms
// placeholders, the collections index and the preview-only promotional cards.
//   BASE_URL=http://localhost:8787 node scripts/check-features.mjs
import { launchBrowser, stagingFetch } from "./lib/staging-auth.mjs";
const base = (process.env.BASE_URL ?? "http://localhost:3100").replace(/\/$/, "");
let failed = 0;
const check = (name, pass, detail = "") => { console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!pass) failed++; };
const get = (path) => stagingFetch(base + path, { redirect: "manual" });

// Planned or empty feature URLs fall back to the homepage; unknown ones stay 404; real pages are 200.
for (const path of ["/collections/jewellery-box", "/collections/mix-and-match", "/collections/gift-sets", "/collections/gift-combos", "/collections/festive-edit", "/collections/gift-box"]) {
  const r = await get(path);
  const location = r.headers.get("location") ?? "";
  check(`${path} redirects to the homepage`, [301, 302, 303, 307, 308].includes(r.status) && new URL(location, base).pathname === "/", `${r.status} → ${location}`);
  check(`${path} redirect isn't cached permanently`, r.status !== 301 && r.status !== 308 && !/max-age=31536000/.test(r.headers.get("cache-control") ?? ""), `${r.status} ${r.headers.get("cache-control")}`);
}
check("an unknown collection is still a 404", (await get("/collections/no-such-thing")).status === 404);
for (const path of ["/collections", "/info/faq", "/info/privacy", "/info/terms", "/design/promotions", "/collections/korean-edit"]) {
  check(`${path} returns 200`, (await get(path)).status === 200);
}

const browser = await launchBrowser();
const errors = [];
const newPage = async (options = {}) => {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options })).newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return page;
};

{
  const page = await newPage();
  await page.goto(base + "/collections/mix-and-match", { waitUntil: "networkidle" });
  check("following a planned feature link lands on the homepage", new URL(page.url()).pathname === "/");

  // Footer
  await page.goto(base + "/", { waitUntil: "networkidle" });
  const footer = page.locator("footer");
  const groups = await footer.locator("h2").allTextContents();
  check("footer groups are Shop, Explore, Help and Company", groups.join(",").toLowerCase() === "shop,explore,help,company", groups.join(","));
  const links = await footer.locator("a").evaluateAll((as) => as.map((a) => ({ text: a.textContent.trim(), href: a.getAttribute("href") })));
  const texts = links.map((l) => l.text);
  for (const t of ["All Jewellery", "Earrings", "Necklaces", "Hair Accessories", "New Arrivals", "Trending", "All collections", "Shipping", "Returns & Refunds", "Contact", "FAQs", "About NÉVORA", "Privacy Policy", "Terms & Conditions"]) {
    check(`footer links to ${t}`, texts.includes(t));
  }
  check("footer has no Bestsellers, Gift Sets, Mix & Match or Order Help", !texts.some((t) => /bestseller|gift set|mix & match|order help/i.test(t)), texts.join(", "));
  let broken = [];
  for (const l of links) {
    const r = await get(l.href);
    if (r.status !== 200) broken.push(`${l.href} ${r.status}`);
  }
  check("every footer link opens a real page (200, no redirects)", broken.length === 0, broken.join(", "));
  check("footer links don't prefetch", (await page.evaluate(() => performance.getEntriesByType("resource").filter((e) => /_rsc=/.test(e.name)).length)) === 0);

  // Homepage: no promotional cards for customers
  check("the homepage shows no promotional cards", (await page.locator("[data-card]").count()) === 0 && !(await page.locator("main").textContent()).includes("Ways to shop"));
}

{
  // FAQ
  const page = await newPage();
  await page.goto(base + "/info/faq", { waitUntil: "networkidle" });
  const questions = await page.locator("main summary").allTextContents();
  check("FAQ shows exactly the two published questions", questions.length === 2 && /place an order/.test(questions[0]) && /Cash on Delivery/.test(questions[1]), questions.join(" | "));
  const main = await page.locator("main").textContent();
  check("draft questions never appear", !/How long does delivery|return or exchange|care for my jewellery|contact NÉVORA\?/.test(main));
  await page.locator("main summary").nth(1).click();
  check("a question opens to show its answer", await page.getByText(/^Not at the moment\. Every order is paid in advance by UPI/).isVisible());
  await page.locator("main summary").first().click();
  const orderAnswer = await page.locator("main details").first().textContent();
  check("the order answer describes manual UPI: no gateway, UPI ID and QR, UTR, WhatsApp help, manual check", /don't use an online payment gateway/.test(orderAnswer) && /UPI ID and QR code/.test(orderAnswer) && /\(UTR\)/.test(orderAnswer) && /WhatsApp/.test(orderAnswer) && /check by hand/.test(orderAnswer));
  const html = await (await get("/info/faq")).text();
  check("answers are in the server HTML, so they work without JavaScript", html.includes("paid in advance by UPI") && html.includes("<details"));
  check("draft answers aren't in the HTML either", !/courier choice|open decision|supplier care guidance/i.test(html));
  await page.setViewportSize({ width: 360, height: 740 });
  check("FAQ questions are comfortable tap targets on a phone", (await page.locator("main summary").first().boundingBox()).height >= 44);
}

{
  // Privacy and Terms: visibly unfinished placeholders, never presented as final policies
  const page = await newPage();
  for (const [path, name] of [["/info/privacy", "privacy policy"], ["/info/terms", "terms & conditions"]]) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    const main = await page.locator("main").textContent();
    check(`${path} is visibly marked as an unfinished placeholder`, await page.getByText("Placeholder · Not final").isVisible() && main.includes(`not NÉVORA’s ${name}`) && main.includes("no legal effect"), main.slice(0, 160));
    check(`${path} is kept out of search engines`, (await page.locator("meta[name='robots']").getAttribute("content"))?.includes("noindex"));
    check(`${path} title says placeholder`, (await page.title()).includes("(placeholder)"), await page.title());
  }
}

{
  // Collections index
  const page = await newPage();
  await page.goto(base + "/collections", { waitUntil: "networkidle" });
  const hrefs = await page.locator("main a[href^='/collections/']").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  check("collections index lists the real collections", ["korean-edit", "coquette-edit", "minimal-edit", "under-299", "under-499", "new-arrivals", "trending"].every((s) => hrefs.includes(`/collections/${s}`)), hrefs.join(" "));
  check("and none of the empty or planned ones", !hrefs.some((h) => /festive|gift|mix|jewellery-box/.test(h)));
}

{
  // Promotional cards preview
  const page = await newPage();
  await page.goto(base + "/design/promotions", { waitUntil: "networkidle" });
  const cards = page.locator("[data-card]");
  check("preview shows all four sample cards", (await cards.count()) === 4);
  check("each is marked hidden from customers", (await page.locator("[data-card][data-state='hidden']").count()) === 4);
  check("planned cards aren't links, so they can't be opened", (await page.locator("[data-card] a").count()) === 0);
  check("the preview is labelled as a sample preview", await page.getByText("Preview only · Sample").isVisible());
  check("the preview says it is a development preview, not an admin screen", await page.getByText(/Development preview, not an admin screen/).isVisible());
  const text = await page.locator("main").textContent();
  check("the end date is static text, not a countdown", text.includes("Ends 14 Feb 2027, 11:59 pm IST") && !/\d+\s*(h|hrs|hours|m|min|s|sec)\b\s*:?\s*\d*\s*left|\d{2}:\d{2}:\d{2}/i.test(text));
  check("preview is kept out of search engines", (await page.locator("meta[name='robots']").getAttribute("content"))?.includes("noindex"));
  const before = await page.locator("main").textContent();
  await page.waitForTimeout(1500);
  check("nothing on the preview ticks or changes over time", before === (await page.locator("main").textContent()));
  await page.setViewportSize({ width: 360, height: 740 });
  check("no sideways scrolling on a phone", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
}

check("no console or page errors", errors.length === 0, errors.slice(0, 3).join(" | ").slice(0, 300));
await browser.close();
process.exit(failed ? 1 : 0);
