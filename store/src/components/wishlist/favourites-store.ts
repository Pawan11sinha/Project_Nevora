// Favourites live in the browser only, in localStorage, using the same pattern as the bag (cart/bag-store.ts):
// no server requests, other open tabs kept in step, and a memory fallback if the browser blocks storage.
// On the server and during hydration they read as "not loaded yet" (null), which avoids hydration mismatches.
import { useSyncExternalStore } from "react";
import { parseFavourites, serializeFavourites, toggleFavourite as toggle, type ToggleResult } from "@/lib/favourites";

const STORAGE_KEY = "nevora-favourites";
const listeners = new Set<() => void>();

let cachedRaw: string | null | undefined;
let cached: string[] = [];
let storageAvailable = true;

function read(): string[] {
  if (!storageAvailable) return cached;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    storageAvailable = false;
    return cached;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parseFavourites(raw);
  }
  return cached;
}

function write(slugs: string[]) {
  cached = slugs;
  if (storageAvailable) {
    try {
      const raw = serializeFavourites(slugs);
      window.localStorage.setItem(STORAGE_KEY, raw);
      cachedRaw = raw;
    } catch {
      storageAvailable = false;
    }
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) notify();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", onStorage);
  };
}

const notLoaded = () => null;

/** Favourite product slugs, newest first, or null until the browser has loaded them. */
export const useFavourites = (): string[] | null => useSyncExternalStore<string[] | null>(subscribe, read, notLoaded);

export function toggleFavourite(slug: string): ToggleResult {
  const { slugs, result } = toggle(read(), slug);
  if (result !== "full") write(slugs);
  return result;
}
