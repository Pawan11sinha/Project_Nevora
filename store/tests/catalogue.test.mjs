// Sample catalogue and navigation rules.
import assert from "node:assert/strict";
import { test } from "node:test";
import { CATEGORIES, COLLECTIONS, PRODUCTS, formatPrice, productsInCollection, visibleCategories, visibleCollections } from "../src/lib/sample-catalogue.ts";

test("every product belongs to a real subcategory and is labelled as a sample", () => {
  const known = CATEGORIES.flatMap((c) => c.subcategories.map((s) => s.slug));
  for (const p of PRODUCTS) {
    assert.ok(known.includes(p.subcategory), p.slug);
    assert.match(p.slug, /^sample-/);
    assert.match(p.description, /sample/i);
  }
});

test("empty categories and collections are hidden from navigation", () => {
  const subs = visibleCategories().flatMap((c) => c.subcategories.map((s) => s.slug));
  assert.ok(!subs.includes("anklets"));
  assert.ok(!visibleCollections("merchandising").some((c) => c.slug === "festive-edit" || c.slug === "gift-box"));
});

test("price collections contain only products at or under their price", () => {
  const limits = { "under-299": 29900, "under-499": 49900 };
  for (const [slug, limit] of Object.entries(limits)) {
    const list = productsInCollection(COLLECTIONS.find((c) => c.slug === slug));
    assert.ok(list.length > 0);
    assert.ok(list.every((p) => p.pricePaise <= limit));
  }
});

test("the launch aesthetics have real products", () => {
  for (const slug of ["korean-edit", "coquette-edit", "minimal-edit"]) {
    assert.ok(productsInCollection(COLLECTIONS.find((c) => c.slug === slug)).length >= 3, slug);
  }
});

test("manual picks use honest labels, and no sales or rating claims exist", () => {
  const banned = /bestsell|viral|best.?seller|\d+\s*(sold|left)|rating|review|hurry|only \d/i;
  for (const p of PRODUCTS) {
    assert.doesNotMatch(`${p.name} ${p.description} ${p.pickLabel ?? ""}`, banned, p.slug);
  }
  for (const c of COLLECTIONS) assert.doesNotMatch(`${c.name} ${c.intro}`, /viral|bestsell/i);
});

test("prices are stored as whole paise and shown in rupees", () => {
  assert.ok(PRODUCTS.every((p) => Number.isInteger(p.pricePaise) && p.pricePaise > 0));
  assert.equal(formatPrice(24900), "₹249");
  assert.equal(formatPrice(129900), "₹1,299");
});

test("section reveal is CSS only, with reduced motion and browser support guards", async () => {
  const { readFileSync, readdirSync, statSync } = await import("node:fs");
  const walk = (dir) => readdirSync(dir).flatMap((name) => {
    const path = `${dir}/${name}`;
    return statSync(path).isDirectory() ? walk(path) : /\.tsx?$/.test(path) ? [path] : [];
  });
  const root = new URL("../src", import.meta.url).pathname;
  assert.deepEqual(walk(root).filter((f) => /from "motion/.test(readFileSync(f, "utf8"))), []);
  const css = readFileSync(`${root}/app/globals.css`, "utf8");
  const guard = css.indexOf("@media (prefers-reduced-motion: no-preference)");
  assert.ok(guard !== -1 && css.indexOf("@supports (animation-timeline: view())") > guard);
  assert.ok(css.indexOf(".reveal {") > guard, "reveal must only exist inside the guards");
});
