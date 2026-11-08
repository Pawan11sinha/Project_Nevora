// Adding from a product card: only real, in-stock products with one of their own finishes, never a duplicate line.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ADD_RESULT_MESSAGES, MAX_QUANTITY, addLine, addProblem } from "../src/lib/cart.ts";
import { PRODUCTS, findProduct } from "../src/lib/sample-catalogue.ts";

const multi = PRODUCTS.find((p) => p.finishes.length > 1 && !p.soldOut);
const single = PRODUCTS.find((p) => p.finishes.length === 1 && !p.soldOut);
const soldOut = PRODUCTS.find((p) => p.soldOut);

test("the sample catalogue has single-finish, multi-finish and sold-out products to exercise", () => {
  assert.ok(multi && single && soldOut);
});

test("a product's own finish can be added", () => {
  assert.equal(addProblem(single, single.finishes[0]), null);
  for (const f of multi.finishes) assert.equal(addProblem(multi, f), null, f);
});

test("no finish chosen, or a finish the product doesn't have, is refused", () => {
  assert.equal(addProblem(multi, null), "finish");
  assert.equal(addProblem(multi, undefined), "finish");
  assert.equal(addProblem(multi, ""), "finish");
  assert.equal(addProblem(multi, "Rose tone"), "finish");
  assert.equal(addProblem(single, multi.finishes.find((f) => !single.finishes.includes(f))), "finish");
});

test("sold-out and unknown products are refused", () => {
  assert.equal(addProblem(soldOut, soldOut.finishes[0]), "sold-out");
  assert.equal(addProblem(findProduct("sample-gone-forever"), "Gold tone"), "missing");
  assert.equal(addProblem(undefined, "Gold tone"), "missing");
});

test("adding the same product and finish again raises the quantity, never a second line", () => {
  let lines = [];
  ({ lines } = addLine(lines, multi.slug, multi.finishes[0]));
  ({ lines } = addLine(lines, multi.slug, multi.finishes[0]));
  assert.deepEqual(lines, [{ slug: multi.slug, finish: multi.finishes[0], quantity: 2 }]);
  ({ lines } = addLine(lines, multi.slug, multi.finishes[1]));
  assert.equal(lines.length, 2, "a different finish is its own line");
});

test("the card and product page share the same limit and bag-full messages", () => {
  let lines = [{ slug: single.slug, finish: single.finishes[0], quantity: MAX_QUANTITY }];
  const { result } = addLine(lines, single.slug, single.finishes[0]);
  assert.equal(result, "limit");
  assert.match(ADD_RESULT_MESSAGES.limit, /most of this piece/);
  assert.match(ADD_RESULT_MESSAGES.full, /bag is full/);
});
