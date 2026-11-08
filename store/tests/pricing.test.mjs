// Price and discount display rules, and the sample catalogue's prices.
import assert from "node:assert/strict";
import { test } from "node:test";
import { InvalidPricingError, MIN_DISCOUNT_PERCENT, discountPercent, priceDisplay } from "../src/lib/pricing.ts";
import { PRODUCTS } from "../src/lib/sample-catalogue.ts";

const r = (rupees) => Math.round(rupees * 100);

test("a normal discount is ((MRP − price) ÷ MRP) × 100", () => {
  assert.equal(discountPercent(r(500), r(1000)), 50);
  assert.equal(discountPercent(r(750), r(1000)), 25);
  assert.equal(discountPercent(r(1), r(100)), 99);
});

test("the discount is always rounded down, never up", () => {
  assert.equal(discountPercent(r(449), r(649)), 30); // 30.8%
  assert.equal(discountPercent(r(349), r(499)), 30); // 30.06%
  assert.equal(discountPercent(r(169), r(199)), 15); // 15.07%
  assert.equal(discountPercent(r(279), r(349)), 20); // 20.05%
  assert.equal(discountPercent(r(199), r(299)), 33); // 33.44%
  assert.equal(discountPercent(r(66.67), r(100)), 33); // 33.33%
  assert.equal(discountPercent(r(199), r(200)), 0); // 0.5%
  assert.equal(discountPercent(9999, 10000), 0); // 0.01%
  assert.equal(discountPercent(9900, 10000), 1); // exactly 1%
});

test("no MRP, or MRP equal to the price, means no discount", () => {
  assert.equal(discountPercent(r(249)), 0);
  assert.equal(discountPercent(r(249), undefined), 0);
  assert.equal(discountPercent(r(249), null), 0);
  assert.equal(discountPercent(r(249), r(249)), 0);
});

test("a selling price above MRP is rejected", () => {
  assert.throws(() => discountPercent(r(500), r(499)), InvalidPricingError);
  assert.throws(() => discountPercent(10001, 10000), /can't be more than MRP/);
  assert.throws(() => priceDisplay(r(500), r(400)), InvalidPricingError);
});

test("zero, negative, fractional or non-numeric amounts are rejected", () => {
  for (const mrp of [0, -100, 99.5, Number.NaN, Number.POSITIVE_INFINITY, "1000"]) {
    assert.throws(() => discountPercent(r(100), mrp), InvalidPricingError, String(mrp));
  }
  for (const price of [0, -1, 10.5, Number.NaN, undefined, "100"]) {
    assert.throws(() => discountPercent(price, r(1000)), InvalidPricingError, String(price));
  }
});

test("the display shows MRP and the badge only for a genuine discount of at least 1%", () => {
  assert.equal(MIN_DISCOUNT_PERCENT, 1);
  assert.deepEqual(priceDisplay(r(449), r(649)), { pricePaise: r(449), discounted: true, mrpPaise: r(649), discountPercent: 30 });
  assert.deepEqual(priceDisplay(r(199), r(200)), { pricePaise: r(199), discounted: false }); // rounds down to 0%
  assert.deepEqual(priceDisplay(r(149), r(149)), { pricePaise: r(149), discounted: false });
  assert.deepEqual(priceDisplay(r(249)), { pricePaise: r(249), discounted: false });
  assert.deepEqual(priceDisplay(9900, 10000), { pricePaise: 9900, discounted: true, mrpPaise: 10000, discountPercent: 1 });
});

test("every sample product has valid pricing, and the samples cover each display rule", () => {
  const results = PRODUCTS.map((p) => ({ slug: p.slug, mrp: p.mrpPaise, shown: priceDisplay(p.pricePaise, p.mrpPaise) }));
  assert.ok(results.some((x) => x.shown.discounted), "at least one genuine discount");
  assert.ok(results.some((x) => x.mrp && !x.shown.discounted && x.mrp === PRODUCTS.find((p) => p.slug === x.slug).pricePaise), "MRP equal to price is hidden");
  assert.ok(results.some((x) => x.mrp && !x.shown.discounted && x.mrp > PRODUCTS.find((p) => p.slug === x.slug).pricePaise), "a discount under 1% is hidden");
  assert.ok(results.some((x) => !x.mrp), "products without an MRP");
});
