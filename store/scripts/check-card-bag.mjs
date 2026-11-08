// Add to Bag on product cards in a real browser: single-finish adds, the finish chooser for multi-finish products,
// merging repeats, Escape and outside clicks, keyboard use, sold out, the bag limit, card navigation and phone layout.
//   BASE_URL=http://localhost:8787 node scripts/check-card-bag.mjs
import { launchBrowser } from "./lib/staging-auth.mjs";
const base = (process.env.BASE_URL ?? "http://localhost:3100").replace(/\/$/, "");
let failed = 0;
const check = (name, pass, detail = "") => { console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!pass) failed++; };
const errors = [];
const browser = await launchBrowser();
const LIST = "/categories/jewellery";

async function open(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(base + LIST, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("nevora-bag"));
  await page.reload({ waitUntil: "networkidle" });
  return { context, page };
}
const bag = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("nevora-bag") ?? '{"lines":[]}').lines);
const bagLabel = (page) => page.locator("body > header a[href='/bag']").getAttribute("aria-label");
const card = (page, name) => page.locator("main article").filter({ has: page.getByRole("heading", { name, exact: true }) });

{
  const { context, page } = await open();
  const requests = [];
  page.on("request", (r) => { if (!/_next\/static|\.svg|\.json$/.test(r.url())) requests.push(r.url()); });

  // Single finish
  const stud = card(page, "Pearl Stud");
  check("a single-finish card shows Add to bag", (await stud.getByRole("button", { name: "Add Pearl Stud to bag" }).count()) === 1);
  await stud.getByRole("button", { name: "Add Pearl Stud to bag" }).click();
  check("one tap adds its only finish", JSON.stringify(await bag(page)) === JSON.stringify([{ slug: "sample-pearl-stud", finish: "Gold tone", quantity: 1 }]), JSON.stringify(await bag(page)));
  check("the header count updates at once", (await bagLabel(page)) === "Bag, 1 item", await bagLabel(page));
  check("the card confirms the piece and finish, with a View bag link", ((await stud.getByRole("status").textContent()) ?? "").includes("Added Pearl Stud, Gold tone.") && (await stud.getByRole("link", { name: "View bag" }).count()) === 1);
  await stud.getByRole("button", { name: "Add Pearl Stud to bag" }).click();
  check("adding it again raises the quantity, with no duplicate line", JSON.stringify(await bag(page)) === JSON.stringify([{ slug: "sample-pearl-stud", finish: "Gold tone", quantity: 2 }]));
  check("the page didn't navigate", new URL(page.url()).pathname === LIST);

  // Multi finish
  const jhumka = card(page, "Dome Jhumka");
  const choose = jhumka.getByRole("button", { name: "Choose a finish for Dome Jhumka" });
  check("a multi-finish card asks for a finish instead of adding", (await choose.count()) === 1 && (await jhumka.getByRole("button", { name: /^Add .* to bag$/ }).count()) === 0);
  await choose.click();
  const dialog = page.getByRole("dialog", { name: "Choose a finish for Dome Jhumka" });
  check("the chooser opens with every finish and nothing pre-selected", (await dialog.getByRole("radio").count()) === 2 && (await dialog.getByRole("radio", { checked: true }).count()) === 0 && (await choose.getAttribute("aria-expanded")) === "true");
  check("focus moves into the chooser", await page.evaluate(() => document.activeElement?.type === "radio"));
  check("Add to bag is disabled until a finish is chosen", await dialog.getByRole("button", { name: "Choose a finish first" }).isDisabled());
  check("nothing was added just by opening it", (await bag(page)).length === 1);
  await dialog.getByText("Oxidised silver tone", { exact: true }).click();
  await dialog.getByRole("button", { name: "Add Dome Jhumka, Oxidised silver tone, to bag" }).click();
  const lines = await bag(page);
  check("the chosen finish is the one stored", lines.some((l) => l.slug === "sample-dome-jhumka" && l.finish === "Oxidised silver tone" && l.quantity === 1) && lines.length === 2, JSON.stringify(lines));
  check("the chooser closes and focus returns to its button", (await dialog.count()) === 0 && await page.evaluate(() => document.activeElement?.getAttribute("aria-label") === "Choose a finish for Dome Jhumka"));
  check("the card confirms the chosen finish", ((await jhumka.getByRole("status").textContent()) ?? "").includes("Added Dome Jhumka, Oxidised silver tone."));
  check("the header count includes every item", (await bagLabel(page)) === "Bag, 3 items", await bagLabel(page));

  // Escape, Cancel and outside clicks add nothing
  await choose.click();
  await page.keyboard.press("Escape");
  check("Escape closes the chooser without adding", (await dialog.count()) === 0 && (await bag(page)).length === 2);
  await choose.click();
  await dialog.getByText("Gold tone", { exact: true }).click();
  await page.mouse.click(5, 5);
  check("clicking outside closes it without adding, even with a finish picked", (await dialog.count()) === 0 && (await bag(page)).length === 2);
  await choose.click();
  check("reopening starts with nothing picked again", (await dialog.getByRole("radio", { checked: true }).count()) === 0);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  check("Cancel closes it without adding", (await dialog.count()) === 0 && (await bag(page)).length === 2);

  // Keyboard only
  await choose.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  const picked = await dialog.getByRole("radio", { checked: true }).getAttribute("value");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  check("keyboard: open, pick a finish and add", (await bag(page)).some((l) => l.slug === "sample-dome-jhumka" && l.finish === picked), `picked ${picked}`);

  // Sold out
  check("a sold-out card's button is disabled", await card(page, "Charm Bracelet").getByRole("button", { name: "Charm Bracelet is sold out" }).isDisabled());

  // Card navigation still works
  await stud.getByRole("heading", { name: "Pearl Stud" }).click();
  await page.waitForURL("**/products/sample-pearl-stud");
  check("clicking the card's name or image still opens the product", new URL(page.url()).pathname === "/products/sample-pearl-stud");
  check("adding from cards sent nothing to the server", requests.filter((u) => !u.includes("/products/sample-pearl-stud")).length === 0, requests.slice(0, 3).join(" "));
  await page.goto(`${base}/bag`, { waitUntil: "networkidle" });
  const bagText = await page.locator("main").textContent();
  check("the bag page lists each finish as its own line, at catalogue prices", bagText.includes("Finish: Oxidised silver tone") && bagText.includes("Finish: Gold tone") && (await page.locator("main ul > li").count()) >= 2);
  await context.close();
}

{
  // The bag limit
  const { context, page } = await open();
  await page.evaluate(() => localStorage.setItem("nevora-bag", JSON.stringify({ v: 1, lines: [{ slug: "sample-pearl-stud", finish: "Gold tone", quantity: 10 }] })));
  await page.reload({ waitUntil: "networkidle" });
  await card(page, "Pearl Stud").getByRole("button", { name: "Add Pearl Stud to bag" }).click();
  check("at the limit, the card shows the same message as the product page", ((await card(page, "Pearl Stud").getByRole("status").textContent()) ?? "").includes("That's the most of this piece one bag can hold.") && (await bag(page))[0].quantity === 10);
  await context.close();
}

{
  // Phone
  const { context, page } = await open({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  const jhumka = card(page, "Dome Jhumka");
  await jhumka.scrollIntoViewIfNeeded();
  await jhumka.getByRole("button", { name: "Choose a finish for Dome Jhumka" }).tap();
  const dialog = page.getByRole("dialog", { name: "Choose a finish for Dome Jhumka" });
  const box = await dialog.boundingBox();
  check("phone: the chooser fits on screen", box && box.x >= 0 && box.x + box.width <= 360, JSON.stringify(box));
  await dialog.getByText("Gold tone", { exact: true }).tap();
  await dialog.getByRole("button", { name: "Add Dome Jhumka, Gold tone, to bag" }).tap();
  check("phone: tapping adds the chosen finish", (await bag(page)).some((l) => l.slug === "sample-dome-jhumka" && l.finish === "Gold tone"));
  check("phone: no sideways scroll", await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  const small = await page.evaluate(() => [...document.querySelectorAll("main article button")].filter((b) => { const r = b.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).map((b) => b.getAttribute("aria-label") || b.textContent));
  check("phone: card buttons are at least 44px", small.length === 0, small.slice(0, 3).join(" | "));
  await context.close();
}

check("no console or page errors", errors.length === 0, errors.slice(0, 3).join(" | ").slice(0, 300));
await browser.close();
process.exit(failed ? 1 : 0);
