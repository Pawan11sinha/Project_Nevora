// Favourites live in the browser only, in localStorage, using the same pattern as the bag (cart/bag-store.ts):
// no server requests, other open tabs kept in step, and a memory fallback if the browser blocks storage.
// On the server and during hydration they read as "not loaded yet" (null), which avoids hydration mismatches.
import { useSyncExternalStore } from "react";
import { toggleFavourite as toggle, type ToggleResult } from "@/lib/favourites";
import { ACCOUNT_IDENTITY_EVENT, ACCOUNT_IDENTITY_STORAGE_EVENT, favouritesStorageKey, readFavouritesForAccount, writeFavouritesForAccount } from "@/lib/account-storage";
import { currentAccountId, isAccountIdentityTransitionPending } from "@/lib/account-identity-client";

const listeners = new Set<() => void>();

let cachedRaw: string | null | undefined;
let cached: string[] = [];
let cachedScope: string | undefined;
let cachedAccountId: string | null = null;
let storageAvailable = true;
const hiddenFavourites: string[] = [];

function selectScope(): string {
  const accountId = currentAccountId();
  const scope = favouritesStorageKey(accountId);
  if (scope !== cachedScope) {
    cachedScope = scope;
    cachedAccountId = accountId;
    cachedRaw = undefined;
    cached = [];
  }
  return scope;
}

function read(): string[] {
  if (isAccountIdentityTransitionPending()) return hiddenFavourites;
  const scope = selectScope();
  if (!storageAvailable) return cached;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(scope);
  } catch {
    storageAvailable = false;
    return cached;
  }
  if (raw !== cachedRaw) {
    try {
      cached = readFavouritesForAccount(window.localStorage, cachedAccountId);
      cachedRaw = window.localStorage.getItem(scope);
    } catch {
      storageAvailable = false;
    }
  }
  return cached;
}

function write(slugs: string[]) {
  if (isAccountIdentityTransitionPending()) return;
  const scope = selectScope();
  cached = slugs;
  if (storageAvailable) {
    try {
      writeFavouritesForAccount(window.localStorage, cachedAccountId, slugs);
      cachedRaw = window.localStorage.getItem(scope);
    } catch {
      storageAvailable = false;
    }
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  const onStorage = (event: StorageEvent) => {
    if (event.key === cachedScope || event.key === ACCOUNT_IDENTITY_STORAGE_EVENT || event.key === null) notify();
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

/** Favourite product slugs, newest first, or null until the browser has loaded them. */
export const useFavourites = (): string[] | null => useSyncExternalStore<string[] | null>(subscribe, read, notLoaded);

export function toggleFavourite(slug: string): ToggleResult {
  if (isAccountIdentityTransitionPending()) return "switching";
  const { slugs, result } = toggle(read(), slug);
  if (result !== "full") write(slugs);
  return result;
}
