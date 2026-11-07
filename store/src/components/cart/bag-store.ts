// The bag lives in the browser only, in localStorage, so browsing and bag changes make no server requests.
// Imported only by Client Components. On the server, and during hydration, the bag reads as "not loaded yet"
// (null), which avoids hydration mismatches.
import { useSyncExternalStore } from "react";
import { addLine, itemCount, parseBag, removeLine, serializeBag, setQuantity, type AddResult, type BagLine } from "@/lib/cart";

const STORAGE_KEY = "nevora-bag";
const listeners = new Set<() => void>();

let cachedRaw: string | null | undefined;
let cachedLines: BagLine[] = [];
// If the browser blocks storage, the bag still works for this visit, in memory.
let storageAvailable = true;

function read(): BagLine[] {
  if (!storageAvailable) return cachedLines;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    storageAvailable = false;
    return cachedLines;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedLines = parseBag(raw);
  }
  return cachedLines;
}

function write(lines: BagLine[]) {
  cachedLines = lines;
  if (storageAvailable) {
    try {
      const raw = serializeBag(lines);
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
  // Keeps other open tabs in step.
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

/** The bag's lines, or null until the browser has loaded it. */
export const useBagLines = (): BagLine[] | null => useSyncExternalStore<BagLine[] | null>(subscribe, read, notLoaded);

export function useBagCount(): number | null {
  const lines = useBagLines();
  return lines === null ? null : itemCount(lines);
}

export function addToBag(slug: string, finish: string): AddResult {
  const { lines, result } = addLine(read(), slug, finish);
  if (result === "added") write(lines);
  return result;
}

export const changeQuantity = (key: string, quantity: number) => write(setQuantity(read(), key, quantity));
export const removeFromBag = (key: string) => write(removeLine(read(), key));
