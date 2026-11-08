// Feature availability, promotional cards and FAQs: planned and disabled features never reach customers, their URLs
// fall back to the homepage, end dates are static text, and only confirmed FAQ answers are published.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { FEATURES, featureLink, formatEndsAt, isAvailable, safeHref, unavailableCollectionSlugs, unavailablePaths } from "../src/lib/features.ts";
import { FAQS, publishedFaqs } from "../src/lib/faqs.ts";
import { SAMPLE_PROMO_CARDS, isCardVisible, visiblePromoCards } from "../src/lib/sample-promo-cards.ts";

const app = join(import.meta.dirname, "..", "src", "app");

test("every feature has a known state", () => {
  for (const f of Object.values(FEATURES)) assert.ok(["draft", "planned", "active", "disabled"].includes(f.state), f.id);
});

test("planned and disabled features are never available, and have no customer link", () => {
  for (const [id, f] of Object.entries(FEATURES)) {
    if (f.state === "active") continue;
    assert.equal(isAvailable(id), false, id);
    assert.equal(featureLink(id), null, id);
  }
});

test("an active feature with no real content isn't available either", () => {
  // Festive Edit and Gift Box are switched on but have no sample products.
  assert.equal(FEATURES.festiveEdit.state, "active");
  assert.equal(isAvailable("festiveEdit"), false);
  assert.equal(isAvailable("giftBox"), false);
});

test("active features with real destinations are available", () => {
  assert.equal(isAvailable("faq"), true);
  assert.deepEqual(featureLink("faq"), { href: "/info/faq", label: "FAQs" });
  assert.equal(isAvailable("collectionsIndex"), true);
});

test("unavailable feature URLs resolve to the homepage; other links pass through", () => {
  for (const path of unavailablePaths()) assert.equal(safeHref(path), "/", path);
  assert.ok(unavailablePaths().includes("/collections/mix-and-match"));
  assert.equal(safeHref("/collections/korean-edit"), "/collections/korean-edit");
  assert.equal(safeHref("/info/faq"), "/info/faq");
});

test("unavailable collection slugs never overlap a real collection page", () => {
  const slugs = unavailableCollectionSlugs();
  assert.ok(slugs.includes("jewellery-box") && slugs.includes("gift-combos"));
  assert.ok(!slugs.includes("korean-edit") && !slugs.includes("trending"));
});

test("end dates are static text in Indian time, never a countdown", () => {
  assert.equal(formatEndsAt("2027-02-14T23:59:00+05:30"), "Ends 14 Feb 2027, 11:59 pm IST");
  assert.equal(formatEndsAt("2027-02-14T18:29:00Z"), "Ends 14 Feb 2027, 11:59 pm IST");
});

test("sample promotional cards are all planned, so customers see none of them", () => {
  assert.equal(SAMPLE_PROMO_CARDS.length, 4);
  for (const c of SAMPLE_PROMO_CARDS) assert.equal(c.status, "planned", c.id);
  assert.deepEqual(visiblePromoCards(), []);
});

test("a card is visible only when it is active, its destination is live and its end date hasn't passed", () => {
  const card = { id: "t", title: "T", description: "", image: { art: "bow", alt: "" }, order: 1 };
  const now = new Date("2027-01-10T12:00:00+05:30");
  assert.equal(isCardVisible({ ...card, status: "active", destination: "faq" }, now), true);
  assert.equal(isCardVisible({ ...card, status: "planned", destination: "faq" }, now), false);
  assert.equal(isCardVisible({ ...card, status: "draft", destination: "faq" }, now), false);
  assert.equal(isCardVisible({ ...card, status: "disabled", destination: "faq" }, now), false);
  assert.equal(isCardVisible({ ...card, status: "active", destination: "mixAndMatch" }, now), false, "planned destination");
  assert.equal(isCardVisible({ ...card, status: "active", destination: "festiveEdit" }, now), false, "empty destination");
  assert.equal(isCardVisible({ ...card, status: "active", destination: "faq", endsAt: "2027-01-10T11:00:00+05:30" }, now), false, "ended");
  // A future start date doesn't hide an active card, and never publishes a planned one.
  assert.equal(isCardVisible({ ...card, status: "active", destination: "faq", startsAt: "2027-03-01T00:00:00+05:30" }, now), true);
  assert.equal(isCardVisible({ ...card, status: "planned", destination: "faq", startsAt: "2027-01-01T00:00:00+05:30" }, now), false);
});

test("sample cards can never become live offers, whatever their state or dates", () => {
  for (const c of SAMPLE_PROMO_CARDS) {
    assert.equal(c.sample, true, c.id);
    for (const destination of ["faq", "collectionsIndex"]) {
      // Even if someone flipped a sample card to active and pointed it at a live page...
      const forced = { ...c, status: "active", destination };
      for (const now of [new Date("2026-11-08"), new Date("2027-02-07T12:00:00+05:30"), new Date("2030-01-01")]) {
        assert.equal(isCardVisible(forced, now), false, `${c.id} ${destination} ${now.toISOString()}`);
      }
    }
  }
  // Inside the sample Gift Combos date window, nothing appears either.
  assert.deepEqual(visiblePromoCards(SAMPLE_PROMO_CARDS, new Date("2027-02-07T12:00:00+05:30")), []);
});

test("no storefront page renders promotional cards; only the development preview uses the samples", () => {
  const files = [];
  const walk = (dir) => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f)) files.push(p); } };
  walk(app);
  const users = files.filter((f) => /sample-promo-cards|PromoCards/.test(readFileSync(f, "utf8"))).map((f) => f.slice(app.length));
  assert.deepEqual(users, [join("/(prototype)", "design", "promotions", "page.tsx")]);
  const preview = readFileSync(join(app, "(prototype)", "design", "promotions", "page.tsx"), "utf8");
  assert.match(preview, /DEVELOPMENT PREVIEW ONLY/);
  assert.match(preview, /not an admin screen/);
  assert.match(preview, /index: false/);
});

test("visible cards keep the admin's display order", () => {
  const base = { title: "T", description: "", image: { art: "bow", alt: "" }, status: "active", destination: "faq" };
  const cards = [{ ...base, id: "b", order: 2 }, { ...base, id: "a", order: 1 }];
  assert.deepEqual(visiblePromoCards(cards).map((c) => c.id), ["a", "b"]);
});

test("sample cards make no discount, sale or urgency claims", () => {
  const text = SAMPLE_PROMO_CARDS.map((c) => `${c.title} ${c.description} ${c.label ?? ""}`).join(" ");
  assert.doesNotMatch(text, /%|₹|off\b|sale|deal|free|hurry|only \d|left|bestseller|limited/i);
});

test("FAQs: only the two confirmed answers are published, in order; the other four are drafts without answers", () => {
  assert.deepEqual(publishedFaqs().map((f) => f.id), ["place-order", "cod"]);
  const drafts = FAQS.filter((f) => f.status === "draft");
  assert.deepEqual(drafts.map((f) => f.id).sort(), ["care", "contact", "delivery", "returns"]);
  for (const f of drafts) assert.equal(f.answer, undefined, f.id);
  for (const f of FAQS) assert.ok(f.source.length > 10, `${f.id} records its source`);
  assert.equal(new Set(FAQS.map((f) => f.order)).size, FAQS.length, "unique display order");
});

test("FAQ answers stay true to the recorded decisions", () => {
  const text = publishedFaqs().map((f) => f.answer).join(" ");
  assert.doesNotMatch(text, /cash on delivery is available|waterproof|hypoallergenic|anti-tarnish|days? delivery|free shipping/i);
});

test("the order answer follows the owner's process: WhatsApp first, then manual UPI instructions, no gateway", () => {
  const answer = FAQS.find((f) => f.id === "place-order").answer;
  for (const must of [/contact us on WhatsApp/, /manual UPI payment instructions/, /don't use an online payment gateway/, /checked by hand/]) assert.match(answer, must);
  assert.ok(answer.indexOf("WhatsApp") < answer.indexOf("UPI payment instructions"), "WhatsApp comes before the payment instructions");
  // The order-page and UTR steps aren't approved for customer-facing text (open decision 44).
  assert.doesNotMatch(answer, /UTR|transaction reference|order page|QR|pay (online|securely|instantly)|net ?banking|wallet|Razorpay|automatic|instant(ly)? confirm|confirmed (immediately|instantly)/i);
  assert.match(FAQS.find((f) => f.id === "cod").answer, /paid in advance by UPI, which we check by hand/);
});

test("the FAQ and collections index pages exist, and info pages include Privacy and Terms", () => {
  assert.ok(existsSync(join(app, "info", "faq", "page.tsx")));
  assert.ok(existsSync(join(app, "collections", "page.tsx")));
  const info = readFileSync(join(app, "info", "[slug]", "page.tsx"), "utf8");
  assert.match(info, /privacy: \{ title: "Privacy Policy", legal: true \}/);
  assert.match(info, /terms: \{ title: "Terms & Conditions", legal: true \}/);
  assert.match(info, /Placeholder · Not final/);
  assert.match(info, /It has no legal effect/);
  assert.match(info, /index: false/);
});
