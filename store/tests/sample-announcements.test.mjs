// The sample announcement ticker messages: honest, readable, and linking only to real pages.
import assert from "node:assert/strict";
import { test } from "node:test";
import { SAMPLE_ANNOUNCEMENTS, TICKER_SPEED_PX_PER_SECOND } from "../src/lib/sample-announcements.ts";
import { CATEGORIES, COLLECTIONS, productsInCollection } from "../src/lib/sample-catalogue.ts";

test("the ticker moves at a readable speed, ids are unique, and the prototype notice comes first", () => {
  assert.ok(TICKER_SPEED_PX_PER_SECOND >= 25 && TICKER_SPEED_PX_PER_SECOND <= 60, String(TICKER_SPEED_PX_PER_SECOND));
  assert.equal(new Set(SAMPLE_ANNOUNCEMENTS.map((a) => a.id)).size, SAMPLE_ANNOUNCEMENTS.length);
  assert.match(SAMPLE_ANNOUNCEMENTS[0].text, /^Prototype only: nothing is for sale yet$/);
  assert.equal(SAMPLE_ANNOUNCEMENTS[0].link, undefined);
});

test("there are several messages, each short enough to read as it passes", () => {
  assert.ok(SAMPLE_ANNOUNCEMENTS.length >= 3);
  for (const a of SAMPLE_ANNOUNCEMENTS) assert.ok(a.text.length <= 60 && (a.link?.label.length ?? 0) <= 16, a.id);
});

test("linked messages point to real pages with products", () => {
  for (const { id, link } of SAMPLE_ANNOUNCEMENTS) {
    if (!link) continue;
    const collection = link.href.match(/^\/collections\/([a-z0-9-]+)$/);
    const category = link.href.match(/^\/categories\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?$/);
    if (collection) {
      const found = COLLECTIONS.find((c) => c.slug === collection[1]);
      assert.ok(found && productsInCollection(found).length > 0, `${id}: ${link.href}`);
    } else if (category) {
      const found = CATEGORIES.find((c) => c.slug === category[1]);
      assert.ok(found && (!category[2] || found.subcategories.some((s) => s.slug === category[2])), `${id}: ${link.href}`);
    } else assert.fail(`${id}: ${link.href} isn't a collection or category route`);
  }
});

test("no message makes offers, claims or urgency", () => {
  const banned = /free|shipping|\bcod\b|discount|% ?off|\bsale\b|offer|deal|limited|hurry|ends|today only|buy \d|waterproof|hypoallergenic|nickel[- ]free|anti[- ]tarnish|real (gold|silver)|secure payments/i;
  for (const a of SAMPLE_ANNOUNCEMENTS) {
    // The prototype notice is allowed to say nothing is for sale.
    const text = a.id === "prototype" ? a.text.replace("nothing is for sale yet", "") : a.text;
    assert.doesNotMatch(`${text} ${a.link?.label ?? ""}`, banned, a.id);
  }
});
