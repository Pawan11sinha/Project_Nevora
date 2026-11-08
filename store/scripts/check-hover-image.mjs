// The second product image on hover, in a real browser: it fades in on desktop hover and back out on leave, products
// with one image keep it, phones never show or download it, reduced motion swaps instantly, the card keeps its size,
// and the heart, Add to bag and links still work. Also checks the card and product-page buttons hover alike.
//   BASE_URL=http://localhost:8787 node scripts/check-hover-image.mjs
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
  const detailRequests = [];
  page.on("request", (r) => { if (r.url().includes("/sample/detail/")) detailRequests.push(r.url()); });
  await page.goto(base + path, { waitUntil: "networkidle" });
  return { context, page, detailRequests };
}
const card = (page, name) => page.locator("main article").filter({ has: page.getByRole("heading", { name, exact: true }) }).first();
const images = (c) => c.evaluate((a) => [...a.querySelectorAll("img")].map((i) => { const s = getComputedStyle(i); return { src: i.getAttribute("src"), display: s.display, opacity: Number(s.opacity), loaded: i.complete && i.naturalWidth > 0 }; }));
const away = (page) => page.mouse.move(5, 5);
// Waits for the second image's fade to actually reach `opacity` (not a fixed delay); gives up after 3 seconds, and the
// check that follows then reports what it saw.
const fadeTo = (c, opacity) => c.locator("img").nth(1).evaluate((i, target) => new Promise((done) => {
  const end = Date.now() + 3000;
  (function poll() { if (getComputedStyle(i).opacity === target || Date.now() > end) done(); else requestAnimationFrame(poll); })();
}), opacity);

{
  const { context, page, detailRequests } = await open();
  const chandbali = card(page, "Pearl Chandbali");
  let imgs = await images(chandbali);
  check("a product with two images has its main image and a hidden second one", imgs.length === 2 && imgs[0].src === "/sample/chandbali.svg" && imgs[1].src === "/sample/detail/chandbali.svg" && imgs[1].opacity === 0, JSON.stringify(imgs));
  const before = await chandbali.boundingBox();
  await chandbali.locator("img").first().hover();
  await fadeTo(chandbali, "1");
  imgs = await images(chandbali);
  check("hovering on desktop shows the second image", imgs[1].display === "block" && imgs[1].opacity === 1 && imgs[1].loaded, JSON.stringify(imgs[1]));
  const during = await chandbali.boundingBox();
  check("the card doesn't change size", Math.abs(before.height - during.height) < 1 && Math.abs(before.width - during.width) < 1);
  await away(page);
  await fadeTo(chandbali, "0");
  check("moving away restores the main image", (await images(chandbali))[1].opacity === 0);
  check("the second images were fetched only on desktop", detailRequests.length > 0);

  const clip = card(page, "Pearl Bar Clip");
  await clip.locator("img").first().hover();
  await page.waitForTimeout(700);
  const clipImgs = await images(clip);
  check("a product with one image keeps it on hover", clipImgs.length === 1 && clipImgs[0].src === "/sample/clip.svg" && clipImgs[0].opacity === 1, JSON.stringify(clipImgs));

  // Card controls still work while hovered
  await chandbali.locator("img").first().hover();
  await chandbali.getByRole("button", { name: /Pearl Chandbali (to|from) favourites$/ }).click();
  check("the heart still works on a hovered card, without navigating", (await page.evaluate(() => JSON.parse(localStorage.getItem("nevora-favourites") ?? '{"slugs":[]}').slugs)).includes("sample-pearl-chandbali") && new URL(page.url()).pathname === LIST);
  await chandbali.getByRole("button", { name: "Add Pearl Chandbali to bag" }).click();
  check("Add to bag still works on a hovered card", (await page.evaluate(() => JSON.parse(localStorage.getItem("nevora-bag")).lines)).some((l) => l.slug === "sample-pearl-chandbali"));
  await chandbali.locator("img").first().click();
  await page.waitForURL("**/products/sample-pearl-chandbali");
  check("clicking the image still opens the product", new URL(page.url()).pathname === "/products/sample-pearl-chandbali");

  // Card and product-page buttons darken to the same colour on hover
  const pdpButton = page.getByRole("button", { name: "Add to bag", exact: true });
  const idlePdp = await pdpButton.evaluate((b) => getComputedStyle(b).backgroundColor);
  await pdpButton.hover();
  await page.waitForTimeout(400);
  const hoverPdp = await pdpButton.evaluate((b) => getComputedStyle(b).backgroundColor);
  await page.goto(base + LIST, { waitUntil: "networkidle" });
  const cardButton = card(page, "Pearl Stud").getByRole("button", { name: "Add Pearl Stud to bag" });
  const idleCard = await cardButton.evaluate((b) => getComputedStyle(b).backgroundColor);
  await cardButton.hover();
  await page.waitForTimeout(400);
  const hoverCard = await cardButton.evaluate((b) => getComputedStyle(b).backgroundColor);
  check("card and product-page Add to bag share the same espresso colour", idleCard === idlePdp && idleCard === "rgb(52, 37, 31)", `${idleCard} / ${idlePdp}`);
  check("and darken to the same espresso shade on hover", hoverCard === hoverPdp && hoverCard === "rgb(36, 26, 21)", `${hoverCard} / ${hoverPdp}`);
  await context.close();
}

{
  // The finish chooser on a hovered multi-finish card
  const { context, page } = await open({}, "/collections/minimal-edit");
  const claw = card(page, "Matte Claw Clip");
  await claw.locator("img").first().hover();
  await fadeTo(claw, "1");
  const hovered = (await images(claw))[1]?.opacity === 1;
  await claw.getByRole("button", { name: "Choose a finish for Matte Claw Clip" }).click();
  const chooser = page.getByRole("dialog", { name: "Choose a finish for Matte Claw Clip" });
  check("the finish chooser still opens on a hovered card", hovered && (await chooser.isVisible()), `hovered=${hovered}`);
  await context.close();
}

{
  // The hero banner's button darkens to the same shared espresso as every other primary button
  const { context, page } = await open({ reducedMotion: "reduce" }, "/");
  const cta = page.locator("#hero-slides a").first().locator("span.bg-espresso").first();
  const idle = await cta.evaluate((e) => getComputedStyle(e).backgroundColor);
  await page.locator("#hero-slides a").first().hover();
  const hover = await cta.evaluate((e) => new Promise((done) => {
    const end = Date.now() + 2000;
    (function poll() { const c = getComputedStyle(e).backgroundColor; if (c === "rgb(36, 26, 21)" || Date.now() > end) done(c); else requestAnimationFrame(poll); })();
  }));
  check("hero button: espresso, darkening to the shared #241A15 on hover", idle === "rgb(52, 37, 31)" && hover === "rgb(36, 26, 21)", `${idle} → ${hover}`);
  await context.close();
}

{
  // Reduced motion: still swaps on hover, without the fade
  const { context, page } = await open({ reducedMotion: "reduce" });
  const chandbali = card(page, "Pearl Chandbali");
  const duration = await chandbali.evaluate((a) => getComputedStyle(a.querySelectorAll("img")[1]).transitionDuration);
  await chandbali.locator("img").first().hover();
  await page.waitForTimeout(100);
  check("reduced motion: the image swaps instantly, without a fade", parseFloat(duration) < 0.05 && (await images(chandbali))[1].opacity === 1, duration);
  await context.close();
}

{
  // Phone: no hover image, and it's never downloaded
  const { context, page, detailRequests } = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  const chandbali = card(page, "Pearl Chandbali");
  await chandbali.scrollIntoViewIfNeeded();
  const imgs = await images(chandbali);
  check("phone: the second image isn't shown", imgs[1].display === "none", JSON.stringify(imgs[1]));
  check("phone: second images are never downloaded", detailRequests.length === 0, detailRequests.slice(0, 2).join(" "));
  await chandbali.locator("img").first().tap();
  await page.waitForURL("**/products/sample-pearl-chandbali");
  check("phone: tapping the image opens the product, with no hover step", new URL(page.url()).pathname === "/products/sample-pearl-chandbali");
  await context.close();
}

check("no console or page errors", errors.length === 0, errors.slice(0, 3).join(" | ").slice(0, 300));
await browser.close();
process.exit(failed ? 1 : 0);
