// Bag rules: variants, quantities, removal, stored-data safety and catalogue pricing.
import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_LINES, MAX_QUANTITY, addLine, itemCount, lineKey, parseBag, removeLine, resolveLines, serializeBag, setQuantity, subtotalPaise } from "../src/lib/cart.ts";
import {
  ACCOUNT_IDENTITY_TRANSITION_TTL_MS,
  bagStorageKey,
  beginAccountIdentityTransition,
  endAccountIdentityTransition,
  hasPendingAccountIdentityTransitions,
  readBagForAccount,
  writeBagForAccount,
} from "../src/lib/account-storage.ts";
import { PRODUCTS, findProduct } from "../src/lib/sample-catalogue.ts";

const multiFinish = PRODUCTS.find((p) => p.finishes.length > 1 && !p.soldOut);
const [first, second] = multiFinish.finishes;
const soldOut = PRODUCTS.find((p) => p.soldOut);
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

const localLocks = { request: async (_name, callback) => callback() };
const readBag = (storage, accountId, locks = localLocks) => readBagForAccount(storage, accountId, locks);

function serialLocks() {
  const tails = new Map();
  return {
    request(name, callback) {
      const previous = tails.get(name) ?? Promise.resolve();
      const result = previous.then(callback);
      tails.set(name, result.then(() => undefined, () => undefined));
      return result;
    },
  };
}

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

test("guest cart persists separately and merges into the signed-in account", async () => {
  const storage = memoryStorage();
  const guest = addLine([], multiFinish.slug, first).lines;
  writeBagForAccount(storage, null, guest);
  assert.deepEqual(await readBag(storage, null), guest, "guest cart restores after reload");
  assert.deepEqual(await readBag(storage, accountA), guest, "guest cart merges into the new account");
  assert.deepEqual(await readBag(storage, null), [], "guest namespace is cleared after merge");
});

test("more than 30 combined lines remain pending instead of being discarded", async () => {
  const storage = memoryStorage();
  const accountLines = Array.from({ length: MAX_LINES }, (_, i) => ({ slug: `account-${i}`, finish: "Gold tone", quantity: 1 }));
  const guestLines = [
    { slug: "guest-one", finish: "Gold tone", quantity: 2 },
    { slug: "guest-two", finish: "Silver tone", quantity: 3 },
  ];
  writeBagForAccount(storage, accountA, accountLines);
  writeBagForAccount(storage, null, guestLines);

  assert.deepEqual(await readBag(storage, accountA), accountLines);
  const accountState = JSON.parse(storage.getItem(bagStorageKey(accountA)));
  assert.deepEqual(accountState.pendingGuestLines, guestLines);
  assert.equal(accountState.lines.length, MAX_LINES);
  assert.equal(storage.getItem(bagStorageKey(null)), null);
});

test("combined quantity above 10 is kept pending and can merge after space is freed", async () => {
  const storage = memoryStorage();
  const accountLine = { slug: "sample-everyday-hoop", finish: "Gold tone", quantity: 8 };
  const guestLine = { ...accountLine, quantity: 7 };
  writeBagForAccount(storage, accountA, [accountLine]);
  writeBagForAccount(storage, null, [guestLine]);

  assert.deepEqual(await readBag(storage, accountA), [{ ...accountLine, quantity: MAX_QUANTITY }]);
  assert.deepEqual(JSON.parse(storage.getItem(bagStorageKey(accountA))).pendingGuestLines, [{ ...guestLine, quantity: 5 }]);

  const recovered = writeBagForAccount(storage, accountA, [{ ...accountLine, quantity: 5 }]);
  assert.deepEqual(recovered, [{ ...accountLine, quantity: 10 }]);
  assert.deepEqual(JSON.parse(storage.getItem(bagStorageKey(accountA))).pendingGuestLines, []);
});

test("a full account cart retains overflow and retries it after a line is removed", async () => {
  const storage = memoryStorage();
  const accountLines = Array.from({ length: MAX_LINES }, (_, i) => ({ slug: `account-${i}`, finish: "Gold tone", quantity: 1 }));
  const guestLine = { slug: "guest-overflow", finish: "Ivory", quantity: 4 };
  writeBagForAccount(storage, accountA, accountLines);
  writeBagForAccount(storage, null, [guestLine]);

  assert.deepEqual(await readBag(storage, accountA), accountLines);
  assert.deepEqual(JSON.parse(storage.getItem(bagStorageKey(accountA))).pendingGuestLines, [guestLine]);

  const afterRemoval = writeBagForAccount(storage, accountA, accountLines.slice(1));
  assert.equal(afterRemoval.length, MAX_LINES);
  assert.ok(afterRemoval.some((line) => line.slug === guestLine.slug && line.quantity === guestLine.quantity));
  assert.deepEqual(JSON.parse(storage.getItem(bagStorageKey(accountA))).pendingGuestLines, []);
});

test("account lines survive guest merging unchanged when there is no matching variant", async () => {
  const storage = memoryStorage();
  const accountLines = [{ slug: "account-kept", finish: "Gold tone", quantity: 6 }];
  const guestLines = [{ slug: "guest-added", finish: "Silver tone", quantity: 2 }];
  writeBagForAccount(storage, accountA, accountLines);
  writeBagForAccount(storage, null, guestLines);

  assert.deepEqual(await readBag(storage, accountA), [...accountLines, ...guestLines]);
});

test("simultaneous account claims transfer a guest cart to exactly one account", async () => {
  const storage = memoryStorage();
  const guestLine = { slug: "guest-only-line", finish: "Gold tone", quantity: 4 };
  writeBagForAccount(storage, null, [guestLine]);

  const locks = serialLocks();
  const [linesA, linesB] = await Promise.all([
    readBag(storage, accountA, locks),
    readBag(storage, accountB, locks),
  ]);
  const total = [...linesA, ...linesB].reduce((sum, line) => sum + line.quantity, 0);

  assert.equal(total, guestLine.quantity);
  assert.equal(Number(linesA.length === 1) + Number(linesB.length === 1), 1);
  assert.deepEqual(linesA.length ? linesA : linesB, [guestLine]);
  assert.equal(storage.getItem(bagStorageKey(null)), null);
});

test("a missing browser lock leaves guest data untouched and does not merge it", async () => {
  const storage = memoryStorage();
  const guestLine = { slug: "safe-unmerged-line", finish: "Ivory", quantity: 2 };
  writeBagForAccount(storage, null, [guestLine]);

  assert.deepEqual(await readBagForAccount(storage, accountA), []);
  assert.deepEqual(parseBag(storage.getItem(bagStorageKey(null))), [guestLine]);
});

test("repeated reads and a failed guest-key cleanup never duplicate merged quantities", async () => {
  const base = memoryStorage();
  const guestKey = bagStorageKey(null);
  const guestLine = { slug: "same-hoop", finish: "Gold tone", quantity: 3 };
  const accountLine = { ...guestLine, quantity: 2 };
  writeBagForAccount(base, accountA, [accountLine]);
  writeBagForAccount(base, null, [guestLine]);
  const storage = {
    ...base,
    getItem: base.getItem,
    setItem: base.setItem,
    removeItem: (key) => {
      if (key === guestKey) throw new Error("storage removal failed");
      base.removeItem(key);
    },
  };

  assert.deepEqual(await readBag(storage, accountA), [{ ...accountLine, quantity: 5 }]);
  assert.deepEqual(await readBag(storage, accountA), [{ ...accountLine, quantity: 5 }]);
  assert.deepEqual(parseBag(base.getItem(guestKey)), [guestLine], "failed cleanup leaves the claimed guest snapshot intact");
});

test("a failed guest claim write leaves the guest cart available for retry", async () => {
  const storage = memoryStorage();
  const guestLine = { slug: "guest-retry-line", finish: "Gold tone", quantity: 2 };
  writeBagForAccount(storage, null, [guestLine]);
  let failClaim = true;
  const failingStorage = {
    getItem: storage.getItem,
    setItem: (key, value) => {
      if (key === bagStorageKey(null) && failClaim) {
        failClaim = false;
        throw new Error("storage write failed");
      }
      storage.setItem(key, value);
    },
    removeItem: storage.removeItem,
    get length() { return storage.length; },
    key: storage.key,
  };

  await assert.rejects(() => readBag(failingStorage, accountA), /storage write failed/);
  assert.deepEqual(await readBag(storage, null), [guestLine]);
  assert.deepEqual(await readBag(storage, accountA), [guestLine]);
  assert.deepEqual(await readBag(storage, accountA), [guestLine]);
});

test("failed account persistence leaves the guest snapshot recoverable and account cart unchanged", async () => {
  const base = memoryStorage();
  const accountLine = { slug: "existing-account-line", finish: "Gold tone", quantity: 4 };
  const guestLine = { slug: "guest-line", finish: "Silver tone", quantity: 2 };
  writeBagForAccount(base, accountA, [accountLine]);
  writeBagForAccount(base, null, [guestLine]);
  const originalAccount = base.getItem(bagStorageKey(accountA));
  const storage = {
    getItem: base.getItem,
    setItem: (key, value) => {
      if (key === bagStorageKey(accountA)) throw new Error("quota exceeded");
      base.setItem(key, value);
    },
    removeItem: base.removeItem,
  };

  await assert.rejects(() => readBag(storage, accountA), /quota exceeded/);
  assert.equal(base.getItem(bagStorageKey(accountA)), originalAccount);
  assert.deepEqual(parseBag(base.getItem(bagStorageKey(null))), [guestLine]);
  assert.equal(JSON.parse(base.getItem(bagStorageKey(null))).claimedBy, accountA);

  assert.deepEqual(await readBag(base, accountA), [accountLine, guestLine]);
});

test("pending guest contents stay scoped to the account that claimed them", async () => {
  const storage = memoryStorage();
  const accountLines = Array.from({ length: MAX_LINES }, (_, i) => ({ slug: `account-${i}`, finish: "Gold tone", quantity: 1 }));
  const guestLine = { slug: "guest-private-pending", finish: "Ivory", quantity: 3 };
  const accountBLines = [{ slug: "account-b-only", finish: "Silver tone", quantity: 2 }];
  writeBagForAccount(storage, accountA, accountLines);
  writeBagForAccount(storage, accountB, accountBLines);
  writeBagForAccount(storage, null, [guestLine]);

  await readBag(storage, accountA);
  assert.deepEqual(JSON.parse(storage.getItem(bagStorageKey(accountA))).pendingGuestLines, [guestLine]);
  assert.deepEqual(await readBag(storage, accountB), accountBLines);
  assert.deepEqual(JSON.parse(storage.getItem(bagStorageKey(accountB))).pendingGuestLines, []);
  assert.deepEqual(await readBag(storage, null), [], "claimed guest contents are not exposed after account switching");
});

test("cart keys distinguish guest data and each stable account ID", () => {
  assert.notEqual(bagStorageKey(null), bagStorageKey(accountA));
  assert.notEqual(bagStorageKey(accountA), bagStorageKey(accountB));
});

test("legacy shared carts are discarded instead of assigned to an account", async () => {
  const storage = memoryStorage();
  storage.setItem("nevora-bag", serializeBag(addLine([], multiFinish.slug, first).lines));
  assert.deepEqual(await readBag(storage, accountA), []);
  assert.equal(storage.getItem("nevora-bag"), null);
});

test("account cart and guest cart merge without replacing existing account lines", async () => {
  const storage = memoryStorage();
  const accountLines = addLine([], multiFinish.slug, first).lines;
  const guestLines = addLine([], multiFinish.slug, second).lines;
  writeBagForAccount(storage, accountA, accountLines);
  writeBagForAccount(storage, null, guestLines);
  assert.deepEqual(await readBag(storage, accountA), [...accountLines, ...guestLines]);
  assert.deepEqual(await readBag(storage, accountB), []);
});

test("overlapping transitions keep independent locks until both identity changes finish", async () => {
  const storage = memoryStorage();
  const now = Date.now();
  const linesA = [{ slug: "gold-hoops", finish: "Gold", quantity: 2 }];
  const linesB = [{ slug: "pearl-clip", finish: "Ivory", quantity: 1 }];
  const transitionA = "2f0f3d16-0ce6-4b54-9f8d-4c8a93ac42a1";
  const transitionB = "d3d8b618-2268-49fc-bc1a-1e07f46f02b5";
  writeBagForAccount(storage, accountA, linesA);
  writeBagForAccount(storage, accountB, linesB);

  beginAccountIdentityTransition(storage, transitionA, now);
  beginAccountIdentityTransition(storage, transitionB, now);
  assert.equal(hasPendingAccountIdentityTransitions(storage, now + 2), true);
  assert.deepEqual(await readBag(storage, accountA), []);
  assert.deepEqual(await readBag(storage, accountB), []);

  endAccountIdentityTransition(storage, transitionA);
  assert.equal(hasPendingAccountIdentityTransitions(storage, now + 3), true, "tab A cannot clear tab B's lock");
  assert.deepEqual(await readBag(storage, accountA), []);

  endAccountIdentityTransition(storage, transitionB);
  assert.equal(hasPendingAccountIdentityTransitions(storage, now + 4), false);
  assert.deepEqual(await readBag(storage, accountA), linesA);
  assert.deepEqual(await readBag(storage, accountB), linesB);
});

test("expired transition locks are cleaned up without masking storage indefinitely", () => {
  const storage = memoryStorage();
  beginAccountIdentityTransition(storage, "closed-transition", 10);
  assert.equal(hasPendingAccountIdentityTransitions(storage, 10 + ACCOUNT_IDENTITY_TRANSITION_TTL_MS + 1), false);
  assert.equal(storage.length, 0);
});
