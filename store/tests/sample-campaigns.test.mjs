// The sample hero campaigns: clearly labelled, at most 3, linking to real pages, with their artwork present and no
// claims or offers.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { MAX_LIVE_SLIDES, ROTATION_MS, SAMPLE_CAMPAIGNS } from "../src/lib/sample-campaigns.ts";
import { CATEGORIES, COLLECTIONS, productsInCollection } from "../src/lib/sample-catalogue.ts";

const publicDir = join(import.meta.dirname, "..", "public");

test("there are 3 sample slides, within the live limit, rotating every 5 seconds", () => {
  assert.equal(SAMPLE_CAMPAIGNS.length, 3);
  assert.ok(SAMPLE_CAMPAIGNS.length <= MAX_LIVE_SLIDES);
  assert.equal(MAX_LIVE_SLIDES, 3);
  assert.equal(ROTATION_MS, 5000);
  assert.equal(new Set(SAMPLE_CAMPAIGNS.map((c) => c.id)).size, 3);
});

test("every slide is visibly labelled as a sample", () => {
  for (const c of SAMPLE_CAMPAIGNS) assert.match(c.sampleLabel, /^Sample campaign$/i, c.id);
});

test("every slide links to a real page with products", () => {
  for (const c of SAMPLE_CAMPAIGNS) {
    const collection = c.href.match(/^\/collections\/([a-z0-9-]+)$/);
    const category = c.href.match(/^\/categories\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?$/);
    if (collection) {
      const found = COLLECTIONS.find((x) => x.slug === collection[1]);
      assert.ok(found && productsInCollection(found).length > 0, `${c.id}: ${c.href} has no products`);
    } else if (category) {
      const found = CATEGORIES.find((x) => x.slug === category[1]);
      assert.ok(found, `${c.id}: unknown category ${category[1]}`);
      if (category[2]) assert.ok(found.subcategories.some((s) => s.slug === category[2]), `${c.id}: unknown subcategory ${category[2]}`);
    } else {
      assert.fail(`${c.id}: ${c.href} isn't a collection or category route`);
    }
  }
});

test("every slide has desktop and mobile artwork, labelled as sample artwork, and alt text", () => {
  for (const c of SAMPLE_CAMPAIGNS) {
    for (const src of [c.image.desktop, c.image.mobile]) {
      const file = join(publicDir, src);
      assert.ok(existsSync(file), src);
      assert.match(readFileSync(file, "utf8"), /SAMPLE CAMPAIGN ARTWORK/, src);
    }
    assert.notEqual(c.image.desktop, c.image.mobile);
    assert.match(c.image.alt, /^Sample artwork: /, c.id);
  }
});

test("no slide makes product claims, offers or urgency", () => {
  const banned = /waterproof|hypoallergenic|nickel[- ]free|anti[- ]tarnish|real (gold|silver)|\bsale\b|% ?off|discount|offer|free|limited|hurry|only \d|last chance|ends|today only|buy \d/i;
  for (const c of SAMPLE_CAMPAIGNS) {
    for (const text of [c.eyebrow, c.heading, c.description, c.cta, c.image.alt]) assert.doesNotMatch(text, banned, `${c.id}: "${text}"`);
  }
});

test("heading, description and button text stay short enough for the phone layout", () => {
  for (const c of SAMPLE_CAMPAIGNS) {
    assert.ok(c.heading.length <= 32, c.heading);
    assert.ok(c.description.length <= 90, c.description);
    assert.ok(c.cta.length <= 26, c.cta);
  }
});
