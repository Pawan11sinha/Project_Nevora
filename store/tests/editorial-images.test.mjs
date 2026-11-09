// The homepage's editorial photos: every visible category and aesthetic edit has its own photo, every pre-made size
// exists as WebP, category and aesthetic photos are kept apart, and the alt text makes no material claims.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { AESTHETIC_IMAGES, CATEGORY_IMAGES, srcOf, srcSetOf } from "../src/lib/editorial-images.ts";
import { visibleCategories, visibleCollections } from "../src/lib/sample-catalogue.ts";

const publicDir = join(import.meta.dirname, "..", "public");
const all = [...Object.values(CATEGORY_IMAGES), ...Object.values(AESTHETIC_IMAGES)];

test("every visible category and aesthetic edit has its own photo", () => {
  for (const c of visibleCategories()) assert.ok(CATEGORY_IMAGES[c.slug], c.slug);
  for (const c of visibleCollections("aesthetic")) assert.ok(AESTHETIC_IMAGES[c.slug], c.slug);
  assert.equal(new Set(all.map((i) => i.base)).size, all.length, "a photo is used twice");
});

test("category and aesthetic photos are stored separately", () => {
  for (const i of Object.values(CATEGORY_IMAGES)) assert.match(i.base, /^\/images\/categories\//);
  for (const i of Object.values(AESTHETIC_IMAGES)) assert.match(i.base, /^\/images\/aesthetics\//);
});

test("every pre-made size exists, is WebP and is no wider than its master", () => {
  for (const image of all) {
    assert.ok(image.widths.length > 0 && image.widths.every((w, k) => k === 0 || w > image.widths[k - 1]), image.base);
    assert.ok(image.widths.at(-1) <= image.width, image.base);
    for (const w of image.widths) {
      const file = join(publicDir, srcOf(image, w));
      assert.ok(existsSync(file), file);
      const head = readFileSync(file).subarray(0, 12).toString("latin1");
      assert.ok(head.startsWith("RIFF") && head.endsWith("WEBP"), `${file} isn't WebP`);
    }
    assert.equal(srcSetOf(image).split(", ").length, image.widths.length);
  }
});

test("alt text describes the photo without material claims", () => {
  for (const image of all) {
    assert.ok(image.alt.length > 20, image.base);
    assert.doesNotMatch(image.alt, /\b(real|solid|pure) (gold|silver)|\bwaterproof|hypoallergenic|nickel-free|anti-tarnish|\b(18|22|24)k\b|freshwater|genuine pearl/i, image.base);
  }
});
