// Sample product images: every product's main image exists, second (detail) images exist only where declared and are
// labelled as samples, and some products deliberately have a single image.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { PRODUCTS } from "../src/lib/sample-catalogue.ts";

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
