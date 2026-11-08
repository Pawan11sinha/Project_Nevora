// Favourites rules: add, remove, no duplicates, a limit, and nothing trusted from storage.
import assert from "node:assert/strict";
import { test } from "node:test";
import { FAVOURITES_VERSION, MAX_FAVOURITES, parseFavourites, serializeFavourites, toggleFavourite } from "../src/lib/favourites.ts";

test("toggling adds a product, newest first, and toggling again removes it", () => {
  let { slugs, result } = toggleFavourite([], "sample-pearl-stud");
  assert.equal(result, "added");
  ({ slugs, result } = toggleFavourite(slugs, "sample-dome-jhumka"));
  assert.deepEqual(slugs, ["sample-dome-jhumka", "sample-pearl-stud"]);
  ({ slugs, result } = toggleFavourite(slugs, "sample-pearl-stud"));
  assert.equal(result, "removed");
  assert.deepEqual(slugs, ["sample-dome-jhumka"]);
});

test("a product can never appear twice", () => {
  let slugs = ["sample-pearl-stud"];
  ({ slugs } = toggleFavourite(slugs, "sample-pearl-stud"));
  ({ slugs } = toggleFavourite(slugs, "sample-pearl-stud"));
  assert.deepEqual(slugs, ["sample-pearl-stud"]);
  assert.deepEqual(parseFavourites(serializeFavourites(["a", "b", "a", "b"])), ["a", "b"]);
});

test("the list stops at the limit instead of growing without end", () => {
  const full = Array.from({ length: MAX_FAVOURITES }, (_, i) => `sample-${i}`);
  const { slugs, result } = toggleFavourite(full, "sample-new");
  assert.equal(result, "full");
  assert.equal(slugs.length, MAX_FAVOURITES);
  assert.equal(toggleFavourite(full, "sample-0").result, "removed", "removing still works when full");
});

test("stored data is checked, never trusted", () => {
  assert.deepEqual(parseFavourites(null), []);
  assert.deepEqual(parseFavourites("{not json"), []);
  assert.deepEqual(parseFavourites(JSON.stringify({ v: 99, slugs: ["sample-a"] })), []);
  assert.deepEqual(parseFavourites(JSON.stringify({ v: FAVOURITES_VERSION, slugs: "sample-a" })), []);
  assert.deepEqual(parseFavourites(JSON.stringify({ v: FAVOURITES_VERSION, slugs: ["sample-a", 42, "<script>", "../x", "", "Sample-B"] })), ["sample-a"]);
  assert.equal(parseFavourites(serializeFavourites(Array.from({ length: 200 }, (_, i) => `s-${i}`))).length, MAX_FAVOURITES);
  assert.equal(toggleFavourite([], "not a slug").result, "full", "an invalid slug is never stored");
});

test("favourites round-trip through storage", () => {
  const slugs = ["sample-dome-jhumka", "sample-pearl-stud"];
  assert.deepEqual(parseFavourites(serializeFavourites(slugs)), slugs);
});
