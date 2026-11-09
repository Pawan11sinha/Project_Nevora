// Favourites rules: add, remove, no duplicates, a limit, and nothing trusted from storage.
import assert from "node:assert/strict";
import { test } from "node:test";
import { FAVOURITES_VERSION, MAX_FAVOURITES, parseFavourites, serializeFavourites, toggleFavourite } from "../src/lib/favourites.ts";
import {
  beginAccountIdentityTransition,
  endAccountIdentityTransition,
  favouritesStorageKey,
  hasPendingAccountIdentityTransitions,
  readFavouritesForAccount,
  writeFavouritesForAccount,
} from "../src/lib/account-storage.ts";

const accountA = "2f0f3d16-0ce6-4b54-9f8d-4c8a93ac42a1";
const accountB = "d3d8b618-2268-49fc-bc1a-1e07f46f02b5";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
  };
}

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

test("favourites are isolated per account and restored after switching back", () => {
  const storage = memoryStorage();
  const favouritesA = ["sample-dome-jhumka"];
  const favouritesB = ["sample-pearl-stud"];
  writeFavouritesForAccount(storage, accountA, favouritesA);
  writeFavouritesForAccount(storage, accountB, favouritesB);
  assert.notEqual(favouritesStorageKey(accountA), favouritesStorageKey(accountB));
  assert.deepEqual(readFavouritesForAccount(storage, accountA), favouritesA);
  assert.deepEqual(readFavouritesForAccount(storage, accountB), favouritesB);
  assert.deepEqual(readFavouritesForAccount(storage, accountA), favouritesA);
});

test("legacy shared favourites are discarded instead of assigned to an account", () => {
  const storage = memoryStorage();
  storage.setItem("nevora-favourites", serializeFavourites(["sample-pearl-stud"]));
  assert.deepEqual(readFavouritesForAccount(storage, accountA), []);
  assert.equal(storage.getItem("nevora-favourites"), null);
});

test("one tab completing its transition cannot reveal favourites while another tab is switching", () => {
  const storage = memoryStorage();
  const favouritesA = ["sample-dome-jhumka"];
  const favouritesB = ["sample-pearl-stud"];
  writeFavouritesForAccount(storage, accountA, favouritesA);
  writeFavouritesForAccount(storage, accountB, favouritesB);
  const now = Date.now();
  beginAccountIdentityTransition(storage, "tab-a", now);
  beginAccountIdentityTransition(storage, "tab-b", now);

  endAccountIdentityTransition(storage, "tab-a");
  assert.equal(hasPendingAccountIdentityTransitions(storage, now + 2), true);
  assert.deepEqual(readFavouritesForAccount(storage, accountA), []);
  endAccountIdentityTransition(storage, "tab-b");
  assert.deepEqual(readFavouritesForAccount(storage, accountA), favouritesA);
  assert.deepEqual(readFavouritesForAccount(storage, accountB), favouritesB);
});
