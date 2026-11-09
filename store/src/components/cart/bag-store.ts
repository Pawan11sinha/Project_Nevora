// The bag lives in the browser only, in localStorage, so browsing and bag changes make no server requests.
// Imported only by Client Components. On the server, and during hydration, the bag reads as "not loaded yet"
// (null), which avoids hydration mismatches.
import { useSyncExternalStore } from "react";
import { addLine, itemCount, removeLine, setQuantity, type AddResult, type BagLine } from "@/lib/cart";
import { ACCOUNT_IDENTITY_EVENT, ACCOUNT_IDENTITY_STORAGE_EVENT, bagStorageKey, readBagForAccount, writeBagForAccount } from "@/lib/account-storage";
import { currentAccountId, isAccountIdentityTransitionPending } from "@/lib/account-identity-client";

const listeners = new Set<() => void>();

let cachedRaw: string | null | undefined;
let cachedLines: BagLine[] = [];
let cachedScope: string | undefined;
let cachedAccountId: string | null = null;
let loaded = false;
let loadingScope: string | undefined;
// If the browser blocks storage, the bag still works for this visit, in memory.
let storageAvailable = true;
const hiddenLines: BagLine[] = [];

function selectScope(): string {
  const accountId = currentAccountId();
  const scope = bagStorageKey(accountId);
  if (scope !== cachedScope) {
    cachedScope = scope;
    cachedAccountId = accountId;
    cachedRaw = undefined;
    cachedLines = [];
    loaded = false;
    loadingScope = undefined;
  }
  return scope;
}

function load(scope: string, accountId: string | null): void {
  if (loadingScope === scope) return;
  loadingScope = scope;
  const nativeLocks = typeof navigator === "undefined" ? undefined : navigator.locks;
  const locks = nativeLocks
    ? { request: <T,>(name: string, callback: () => T) => nativeLocks.request(name, { mode: "exclusive" }, callback) }
    : null;
  void readBagForAccount(window.localStorage, accountId, locks)
    .then((lines) => {
      if (cachedScope !== scope || cachedAccountId !== accountId) return;
      if (isAccountIdentityTransitionPending()) {
        loaded = false;
        return;
      }
      cachedLines = lines;
      cachedRaw = window.localStorage.getItem(scope);
      loaded = true;
    })
    .catch(() => {
      storageAvailable = false;
      loaded = true;
    })
    .finally(() => {
      if (loadingScope === scope) loadingScope = undefined;
      listeners.forEach((notify) => notify());
    });
}

function read(): BagLine[] {
  if (isAccountIdentityTransitionPending()) return hiddenLines;
  const scope = selectScope();
  if (!storageAvailable) return cachedLines;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(scope);
  } catch {
    storageAvailable = false;
    loaded = true;
    return cachedLines;
  }
  if (!loaded || raw !== cachedRaw) load(scope, cachedAccountId);
  return cachedLines;
}

function write(lines: BagLine[]) {
  if (isAccountIdentityTransitionPending()) return;
  const scope = selectScope();
  if (!loaded) return;
  cachedLines = lines;
  loaded = true;
  if (storageAvailable) {
    try {
      cachedLines = writeBagForAccount(window.localStorage, cachedAccountId, lines);
      cachedRaw = window.localStorage.getItem(scope);
    } catch {
      storageAvailable = false;
    }
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  // Keeps other open tabs in step.
  const onStorage = (event: StorageEvent) => {
    if (event.key === cachedScope || event.key === ACCOUNT_IDENTITY_STORAGE_EVENT || event.key?.startsWith("nevora-account-identity-transition:") || event.key === null) notify();
  };
  const onIdentityChange = () => notify();
  window.addEventListener("storage", onStorage);
  window.addEventListener(ACCOUNT_IDENTITY_EVENT, onIdentityChange);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(ACCOUNT_IDENTITY_EVENT, onIdentityChange);
  };
}

const notLoaded = () => null;

/** The bag's lines, or null until the browser has loaded it. */
export const useBagLines = (): BagLine[] | null => useSyncExternalStore<BagLine[] | null>(subscribe, read, notLoaded);

export function useBagCount(): number | null {
  const lines = useBagLines();
  return lines === null ? null : itemCount(lines);
}

export function addToBag(slug: string, finish: string): AddResult {
  if (isAccountIdentityTransitionPending()) return "switching";
  if (!loaded) {
    read();
    return "switching";
  }
  const { lines, result } = addLine(read(), slug, finish);
  if (result === "added") write(lines);
  return result;
}

export const changeQuantity = (key: string, quantity: number) => {
  if (!loaded) {
    read();
    return;
  }
  write(setQuantity(read(), key, quantity));
};
export const removeFromBag = (key: string) => {
  if (!loaded) {
    read();
    return;
  }
  write(removeLine(read(), key));
};
