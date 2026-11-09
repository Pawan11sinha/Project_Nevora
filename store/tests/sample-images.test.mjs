// Sample product images: every product's main image exists, second (detail) images exist only where declared and are
// labelled as samples, and some products deliberately have a single image.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { IMAGE_VIEW_ORDER, PRODUCTS, productImages } from "../src/lib/sample-catalogue.ts";

const sample = join(import.meta.dirname, "..", "public", "sample");

test("every product has its main sample image", () => {
  for (const p of PRODUCTS) assert.ok(existsSync(join(sample, `${p.art}.svg`)), p.slug);
});

test("products with a second image have a labelled sample detail image", () => {
  const withDetail = PRODUCTS.filter((p) => p.hasDetailImage);
  assert.ok(withDetail.length > 0);
  for (const p of withDetail) {
    const file = join(sample, "detail", `${p.art}.svg`);
    assert.ok(existsSync(file), p.slug);
    assert.match(readFileSync(file, "utf8"), /SAMPLE · DETAIL/, p.slug);
  }
});

test("some products have only one image, to exercise that case", () => {
  assert.ok(PRODUCTS.some((p) => !p.hasDetailImage));
});

test("extra gallery views exist and are labelled as samples", () => {
  const labels = { angle: /SAMPLE · SIDE VIEW/, styled: /SAMPLE · STYLED/, packaging: /SAMPLE · PACKAGING/ };
  for (const p of PRODUCTS) {
    for (const view of p.extraViews ?? []) {
      const file = join(sample, view, `${p.art}.svg`);
      assert.ok(existsSync(file), `${p.slug} ${view}`);
      assert.match(readFileSync(file, "utf8"), labels[view], `${p.slug} ${view}`);
    }
  }
});

test("gallery images follow the set order, with no repeats and only real files", () => {
  for (const p of PRODUCTS) {
    const images = productImages(p);
    assert.equal(images[0].view, "main", p.slug);
    const order = images.map((i) => IMAGE_VIEW_ORDER.indexOf(i.view));
    assert.deepEqual(order, [...order].sort((a, b) => a - b), p.slug);
    assert.equal(new Set(images.map((i) => i.src)).size, images.length, p.slug);
    for (const i of images) {
      assert.ok(existsSync(join(sample, "..", i.src)), i.src);
      assert.match(i.alt, new RegExp(`^${p.name}, sample image, `), p.slug);
    }
  }
});

test("the sample data covers galleries of 1, 2, 4 and 5 images", () => {
  const sizes = new Set(PRODUCTS.map((p) => productImages(p).length));
  for (const n of [1, 2, 4, 5]) assert.ok(sizes.has(n), `no product with ${n} images`);
  assert.deepEqual(productImages(PRODUCTS.find((p) => p.slug === "sample-everyday-hoop")).map((i) => i.view), ["main", "angle", "detail", "styled", "packaging"]);
});
