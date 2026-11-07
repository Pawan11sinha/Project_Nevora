// PIN code auto-fill and "Use my current location" in a real browser.
import { stagingFetch, launchBrowser } from "./lib/staging-auth.mjs";
const base = process.env.BASE_URL ?? "http://localhost:3100";
let failed = 0;
const check = (name, pass, detail = "") => { console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!pass) failed++; };
const bag = JSON.stringify({ v: 1, lines: [{ slug: "sample-dome-jhumka", finish: "Gold tone", quantity: 1 }] });

const browser = await launchBrowser();
const errors = [];
async function open(options = {}) {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, ...options });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const requests = [];
  page.on("request", (r) => requests.push({ url: r.url(), body: r.postData() }));
  await page.goto(`${base}/checkout`, { waitUntil: "networkidle" });
  await page.evaluate((b) => localStorage.setItem("nevora-bag", b), bag);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("form");
  return { context, page, requests };
}
const value = (page, label) => page.getByLabel(label, { exact: false }).inputValue();
const lookupText = (page) => page.locator("#checkout-pincode-lookup").textContent();
const typePin = async (page, pin) => {
  await page.getByLabel("PIN code").fill(pin);
  await page.waitForFunction((pin) => { const t = document.querySelector("#checkout-pincode-lookup")?.textContent ?? ""; return t.includes(pin) && !/Looking up/.test(t); }, pin);
};

// ---- PIN auto-fill ----
{
  const { page, requests } = await open();
  const pinFirst = await page.evaluate(() => {
    const top = (id) => document.getElementById(id).getBoundingClientRect().top;
    return top("checkout-pincode") < top("checkout-city") && top("checkout-pincode") < top("checkout-state");
  });
  check("PIN code comes before city and state", pinFirst);
  check("no PIN data is loaded before a PIN is typed", !requests.some((r) => r.url.includes("/data/pin/")));

  await page.getByLabel("PIN code").fill("11000");
  check("five digits don't trigger a lookup", !requests.some((r) => r.url.includes("/data/pin/")) && (await lookupText(page)) === "");
  await typePin(page, "110001");
  check("a valid PIN fills the city", (await value(page, "City or town")) === "New Delhi", await value(page, "City or town"));
  check("a valid PIN fills the state", (await value(page, "State or union territory")) === "Delhi");
  check("the customer is told what was filled", (await lookupText(page)).includes("Found PIN 110001: New Delhi, Delhi"));
  const pinRequests = requests.filter((r) => r.url.includes("/data/pin/"));
  check("only the PIN's prefix file is requested", pinRequests.length === 1 && pinRequests[0].url.endsWith("/data/pin/v1/p/110.json"), pinRequests.map((r) => r.url).join(" "));

  const response = await stagingFetch(`${base}/data/pin/v1/p/110.json`);
  check("PIN files are cached for a year", (response.headers.get("cache-control") ?? "").includes("max-age=31536000"), response.headers.get("cache-control"));

  await typePin(page, "110002");
  check("a second PIN with the same prefix reuses the downloaded file", requests.filter((r) => r.url.includes("/data/pin/")).length === 1);
  check("an auto-filled city updates for a new PIN", (await value(page, "City or town")) === "Delhi");

  // Manual corrections.
  await page.getByLabel("City or town").fill("Karol Bagh");
  await page.getByLabel("State or union territory").selectOption("Haryana");
  await typePin(page, "110001");
  check("a city the customer typed isn't overwritten", (await value(page, "City or town")) === "Karol Bagh");
  check("a state the customer chose isn't overwritten", (await value(page, "State or union territory")) === "Haryana");
  check("the customer is asked to check a mismatch", (await lookupText(page)).includes("kept the city and state you typed"));
  await page.getByLabel("City or town").fill("");
  await typePin(page, "400069");
  check("an emptied city is filled again", (await value(page, "City or town")) === "Mumbai");
  await page.getByLabel("City or town").fill("Andheri East");
  check("an auto-filled city can be edited", (await value(page, "City or town")) === "Andheri East");

  // A PIN covering more than one district.
  await page.getByLabel("City or town").fill("");
  await page.getByLabel("State or union territory").selectOption("");
  await typePin(page, "110025");
  const options = page.getByRole("group", { name: "Which district is your address in?" }).getByRole("radio");
  check("a shared PIN offers each district", (await options.count()) >= 2, `${await options.count()} options`);
  check("the largest district is filled and selected first", (await value(page, "City or town")) === "Delhi" && await options.first().isChecked());
  check("each district shows example post offices", (await page.getByRole("group", { name: "Which district is your address in?" }).textContent()).includes("Jamia Nagar"));
  await options.nth(1).check();
  check("choosing another district fills its city and state", (await value(page, "City or town")) === "Budaun" && (await value(page, "State or union territory")) === "Uttar Pradesh");
  await typePin(page, "110001");
  check("the district choice disappears for a single-district PIN", (await page.getByRole("group", { name: "Which district is your address in?" }).count()) === 0);

  // Invalid and unknown PIN codes.
  await page.getByLabel("City or town").fill("Pune");
  await typePin(page, "999999");
  check("an unknown PIN is explained without an error", (await lookupText(page)).includes("couldn't find PIN 999999") && (await page.getByLabel("PIN code").getAttribute("aria-invalid")) === null);
  check("an unknown PIN leaves the city alone", (await value(page, "City or town")) === "Pune");
  await typePin(page, "222101");
  check("a listed PIN with no district is treated as unknown", (await lookupText(page)).includes("couldn't find PIN 222101"));
  await page.getByLabel("PIN code").fill("011001");
  await page.getByLabel("PIN code").blur();
  check("an invalid PIN shows the field error and no lookup", ((await page.locator("#checkout-pincode-error").textContent()) ?? "").includes("6-digit") && (await lookupText(page)) === "");
  check("no 404s for any PIN file", requests.filter((r) => r.url.includes("/data/pin/")).length > 0 && !errors.some((e) => e.includes("404")));

  // A failed download.
  await page.route("**/data/pin/v1/p/560.json", (route) => route.abort());
  await typePin(page, "560001");
  check("a failed lookup asks for city and state by hand", (await lookupText(page)).includes("couldn't look up PIN 560001"));
  await page.unroute("**/data/pin/v1/p/560.json");
  await typePin(page, "560002");
  check("a failed file is retried next time", (await lookupText(page)).includes("560002 is listed under Bengaluru, Karnataka"), await lookupText(page));

  // Quick typing: an older, slower lookup must not overwrite a newer one.
  await page.route("**/data/pin/v1/p/700.json", async (route) => { await new Promise((r) => setTimeout(r, 800)); await route.fallback(); });
  await page.getByLabel("City or town").fill("");
  await page.getByLabel("PIN code").fill("700001");
  await page.getByLabel("PIN code").fill("400001");
  await page.waitForTimeout(1200);
  check("only the latest PIN's result is used", (await value(page, "City or town")) === "Mumbai" && (await lookupText(page)).includes("400001"));

  check("no sideways scroll at 360px", await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await typePin(page, "110025");
  const small = await page.evaluate(() => [...document.querySelectorAll("main a, main button, main input, main select, main label:has(input[type=radio])")].filter((e) => e.offsetParent && e.type !== "radio" && !e.closest("nav[aria-label='Breadcrumb']")).filter((e) => { const r = e.getBoundingClientRect(); return r.height < 24 || r.width < 24; }).map((e) => (e.id || e.textContent).trim().slice(0, 30)));
  check("tap targets at least 24px, including district choices", small.length === 0, small.join(" | "));
  check("the attribution names the source and licence", (await page.locator("form").textContent()).includes("Department of Posts") && await page.getByRole("link", { name: /Government Open Data License/ }).count() === 1);
  const notice = await stagingFetch(`${base}/data/pin/v1/NOTICE.txt`);
  check("the source and changes notice is served", notice.ok && (await notice.text()).includes("Changes made by NÉVORA"));
  check("personal details still aren't stored in the browser", !/110025|Budaun|Karol/.test(await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }))));
  check("place order is still disabled", await page.getByRole("button", { name: "Place order" }).isDisabled());
  check("the bag is untouched", await page.evaluate(() => JSON.parse(localStorage.getItem("nevora-bag")).lines.length) === 1);
}

// ---- Current location ----
const CONNAUGHT_PLACE = { latitude: 28.6315, longitude: 77.2167 };
{
  const { context, page, requests } = await open({ permissions: [], geolocation: CONNAUGHT_PLACE });
  let asked = false;
  await page.exposeFunction("__asked", () => { asked = true; });
  await page.evaluate(() => { const original = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation); navigator.geolocation.getCurrentPosition = (...a) => { window.__asked(); return original(...a); }; });
  await page.waitForTimeout(300);
  check("location isn't requested before the button is pressed", !asked && !requests.some((r) => r.url.includes("geo.bin")));
  await context.grantPermissions(["geolocation"]);
  await page.getByLabel("City or town").fill("Somewhere");
  await page.getByRole("button", { name: "Use my current location" }).click();
  await page.waitForFunction(() => /Suggested|couldn/.test(document.querySelector("[role=status] p")?.textContent ?? ""));
  check("pressing the button asks for location", asked);
  const pin = await value(page, "PIN code");
  check("the nearest PIN is filled", /^110\d{3}$/.test(pin), pin);
  check("city and state are filled", /Delhi/.test(await value(page, "City or town")) && (await value(page, "State or union territory")) === "Delhi", await value(page, "City or town"));
  check("the result is shown as a suggestion to check", (await page.getByRole("status").filter({ hasText: "Suggested" }).textContent()).includes("Please check it"));
  const geoRequests = requests.filter((r) => r.url.includes("/data/pin/"));
  check("only the whole post office file is downloaded, once", geoRequests.length === 1 && geoRequests[0].url.endsWith("/data/pin/v1/geo.bin.gz"), geoRequests.map((r) => r.url).join(" "));
  const leaked = requests.filter((r) => /28\.6|77\.2|lat|lon/i.test(r.url + (r.body ?? "")));
  check("coordinates aren't sent in any request", leaked.length === 0 && requests.every((r) => !r.body), leaked.map((r) => r.url).join(" "));
  check("the house and street are left for the customer", (await value(page, "House or flat number")) === "");
  await page.getByLabel("PIN code").fill("400069");
  await page.waitForFunction(() => /Found PIN 400069/.test(document.querySelector("#checkout-pincode-lookup")?.textContent ?? ""));
  check("a suggested PIN can be corrected and is looked up again", (await value(page, "City or town")) === "Mumbai");
  check("the old location suggestion is hidden once the PIN is changed", (await page.getByText("Suggested from the post office").count()) === 0);
  await page.getByRole("button", { name: "Use my current location" }).click();
  await page.waitForFunction(() => /^110/.test(document.getElementById("checkout-pincode").value));
  check("a second use doesn't download the file again", requests.filter((r) => r.url.includes("geo.bin")).length === 1);

}
// Each of these starts a fresh browser session, because browsers may reuse a location fix for up to a minute.
async function locate(geolocation, expected) {
  const { page, context } = await open({ permissions: ["geolocation"], geolocation });
  await page.getByRole("button", { name: "Use my current location" }).click();
  await page.waitForFunction((text) => (document.querySelector("[role=status] p")?.textContent ?? "").includes(text), expected);
  return { page, context };
}
{
  const { context } = await locate({ latitude: 15, longitude: 65 }, "couldn't find a post office");
  check("far from any post office, the customer is asked to type the PIN", true);
  await context.close();
}
{
  const { page, context } = await locate({ ...CONNAUGHT_PLACE, accuracy: 50_000 }, "precise enough");
  check("a very rough location isn't used", (await value(page, "PIN code")) === "");
  await context.close();
}
{
  const { page, context } = await locate({ ...CONNAUGHT_PLACE, accuracy: 4_000 }, "rough location");
  check("a rough location comes with a warning and still fills the PIN", /^110\d{3}$/.test(await value(page, "PIN code")));
  check("no sideways scroll at 360px after a location result", await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await context.close();
}
{
  // Gangtok: hill state, tests a second region and a PIN outside the first prefix file.
  const { page, context } = await locate({ latitude: 27.3314, longitude: 88.6138 }, "Suggested");
  check("Gangtok finds a Sikkim PIN", /^737\d{3}$/.test(await value(page, "PIN code")) && (await value(page, "State or union territory")) === "Sikkim", await value(page, "PIN code"));
  await context.close();
}
{
  const { page } = await open({ permissions: [] });
  await page.getByRole("button", { name: "Use my current location" }).click();
  await page.waitForFunction(() => /Location access is off/.test(document.querySelector("[role=status] p")?.textContent ?? ""), null, { timeout: 20_000 });
  check("a refused permission explains how to continue", true);
  await page.getByLabel("PIN code").fill("110001");
  await page.waitForFunction(() => /Found PIN 110001/.test(document.querySelector("#checkout-pincode-lookup")?.textContent ?? ""));
  check("manual PIN entry still works after a refusal", (await value(page, "City or town")) === "New Delhi");
}
{
  const { page } = await open();
  await page.evaluate(() => { Object.defineProperty(navigator, "geolocation", { value: undefined, configurable: true }); });
  await page.getByRole("button", { name: "Use my current location" }).click();
  check("a browser without location support is told to type the PIN", ((await page.locator("[role=status] p").textContent()) ?? "").includes("can't share your location"));
}
{
  const { context, page } = await open({ permissions: ["geolocation"], geolocation: CONNAUGHT_PLACE });
  await page.route("**/geo.bin.gz", (route) => route.abort());
  await page.getByRole("button", { name: "Use my current location" }).click();
  await page.waitForFunction(() => /couldn't load post office/.test(document.querySelector("[role=status] p")?.textContent ?? ""));
  check("a failed download explains how to continue", true);
  await context.close();
}
{
  const desktop = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await desktop.goto(`${base}/checkout`, { waitUntil: "networkidle" });
  await desktop.evaluate((b) => localStorage.setItem("nevora-bag", b), bag);
  await desktop.reload({ waitUntil: "networkidle" });
  const layout = await desktop.evaluate(() => {
    const r = (id) => document.getElementById(id).getBoundingClientRect();
    return { side: Math.abs(r("checkout-city").top - r("checkout-state").top) < 2, scroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth };
  });
  check("desktop shows city and state side by side", layout.side && layout.scroll);
}

const real = errors.filter((e) => !/net::ERR_FAILED/.test(e)); // the deliberately failed downloads above
check("no console or page errors", real.length === 0, real.slice(0, 3).join(" | ").slice(0, 300));
await browser.close();
process.exit(failed ? 1 : 0);
