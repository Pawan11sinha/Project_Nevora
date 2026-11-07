// Bag rules: variants, quantities, removal, stored-data safety and catalogue pricing.
import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_LINES, MAX_QUANTITY, addLine, itemCount, lineKey, parseBag, removeLine, resolveLines, serializeBag, setQuantity, subtotalPaise } from "../src/lib/cart.ts";
import { PRODUCTS, findProduct } from "../src/lib/sample-catalogue.ts";

const multiFinish = PRODUCTS.find((p) => p.finishes.length > 1 && !p.soldOut);
const [first, second] = multiFinish.finishes;
const soldOut = PRODUCTS.find((p) => p.soldOut);

test("the same product in different finishes stays on separate lines", () => {
  let lines = addLine([], multiFinish.slug, first).lines;
  lines = addLine(lines, multiFinish.slug, second).lines;
  lines = addLine(lines, multiFinish.slug, first).lines;
  assert.equal(lines.length, 2);
  assert.equal(lines.find((l) => l.finish === first).quantity, 2);
  assert.equal(lines.find((l) => l.finish === second).quantity, 1);
  assert.equal(itemCount(lines), 3);
});

test("quantities stay between 1 and the bag limit", () => {
  const key = lineKey(multiFinish.slug, first);
  let lines = addLine([], multiFinish.slug, first).lines;
  lines = setQuantity(lines, key, 0);
  assert.equal(lines[0].quantity, 1);
  lines = setQuantity(lines, key, MAX_QUANTITY + 5);
  assert.equal(lines[0].quantity, MAX_QUANTITY);
  assert.equal(addLine(lines, multiFinish.slug, first).result, "limit");
  assert.equal(setQuantity(lines, key, 2.5), lines);
});

test("removing a line removes only that finish", () => {
  let lines = addLine([], multiFinish.slug, first).lines;
  lines = addLine(lines, multiFinish.slug, second).lines;
  lines = removeLine(lines, lineKey(multiFinish.slug, first));
  assert.deepEqual(lines.map((l) => l.finish), [second]);
});

test("the bag refuses new lines once it's full", () => {
  let lines = [];
  for (let i = 0; i < MAX_LINES; i++) lines = addLine(lines, `item-${i}`, "Gold tone").lines;
  assert.equal(addLine(lines, "one-more", "Gold tone").result, "full");
});

test("stored data round-trips, and malformed data is dropped", () => {
  const lines = addLine(addLine([], multiFinish.slug, first).lines, multiFinish.slug, second).lines;
  assert.deepEqual(parseBag(serializeBag(lines)), lines);
  for (const bad of [null, "", "not json", "[]", "{}", '{"v":2,"lines":[]}', '{"v":1,"lines":"x"}']) assert.deepEqual(parseBag(bad), [], String(bad));
  const mixed = JSON.stringify({ v: 1, lines: [
    { slug: "Bad Slug!", finish: "Gold tone", quantity: 1 },
    { slug: "ok-one", finish: "", quantity: 1 },
    { slug: "ok-one", finish: "Gold tone", quantity: 0 },
    { slug: "ok-one", finish: "Gold tone", quantity: 1.5 },
    { slug: "ok-one", finish: "Gold tone", quantity: "2" },
    { slug: "ok-one", finish: "Gold tone", quantity: 999, pricePaise: 1 },
    { slug: "ok-one", finish: "Gold tone", quantity: 1 },
  ] });
  assert.deepEqual(parseBag(mixed), [{ slug: "ok-one", finish: "Gold tone", quantity: MAX_QUANTITY }]);
});

test("prices come from the catalogue, never from stored data", () => {
  const stored = JSON.stringify({ v: 1, lines: [{ slug: multiFinish.slug, finish: first, quantity: 2, pricePaise: 1 }] });
  const resolved = resolveLines(parseBag(stored), findProduct);
  assert.equal(resolved[0].unitPaise, multiFinish.pricePaise);
  assert.equal(subtotalPaise(resolved), multiFinish.pricePaise * 2);
  assert.ok(!("pricePaise" in parseBag(stored)[0]));
});

test("unavailable lines are shown but left out of the subtotal", () => {
  const lines = [
    { slug: multiFinish.slug, finish: first, quantity: 1 },
    { slug: "sample-does-not-exist", finish: "Gold tone", quantity: 1 },
    { slug: soldOut.slug, finish: soldOut.finishes[0], quantity: 1 },
    { slug: multiFinish.slug, finish: "Not a real finish", quantity: 1 },
  ];
  const resolved = resolveLines(lines, findProduct);
  assert.deepEqual(resolved.map((l) => l.problem), [undefined, "missing", "sold-out", "finish"]);
  assert.equal(subtotalPaise(resolved), multiFinish.pricePaise);
});
