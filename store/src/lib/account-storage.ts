import { MAX_LINES, MAX_QUANTITY, parseBag, serializeBag, type BagLine } from "./cart.ts";
import { parseFavourites, serializeFavourites } from "./favourites.ts";

export const ACCOUNT_ID_COOKIE = "nevora-account-id";
export const ACCOUNT_IDENTITY_EVENT = "nevora:account-identity-change";
export const ACCOUNT_IDENTITY_STORAGE_EVENT = "nevora-account-identity-change";
export const ACCOUNT_IDENTITY_TRANSITION_PREFIX = "nevora-account-identity-transition:";
export const ACCOUNT_IDENTITY_TRANSITION_TTL_MS = 30 * 60 * 1000;

const LEGACY_BAG_KEY = "nevora-bag";
const LEGACY_FAVOURITES_KEY = "nevora-favourites";
const STORAGE_VERSION = "v2";
const GUEST_BAG_TRANSFER_LOCK = "nevora-guest-bag-transfer";

export type AccountStorage = Pick<Storage, "getItem" | "setItem" | "removeItem"> &
  Partial<Pick<Storage, "length" | "key">>;
export type AccountLockManager = {
  request<T>(name: string, callback: () => T): Promise<T>;
};

type StoredBagState = {
  lines: BagLine[];
  pendingGuestLines: BagLine[];
  processedGuestTransferId: string | null;
};

export function isAccountId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function bagStorageKey(accountId: string | null): string {
  return `nevora-bag:${STORAGE_VERSION}:${accountId ?? "guest"}`;
}

export function favouritesStorageKey(accountId: string | null): string {
  return `nevora-favourites:${STORAGE_VERSION}:${accountId ?? "guest"}`;
}

export function identityTransitionKey(transitionId: string): string {
  return `${ACCOUNT_IDENTITY_TRANSITION_PREFIX}${transitionId}`;
}

export function beginAccountIdentityTransition(storage: AccountStorage, transitionId: string, now = Date.now()): void {
  storage.setItem(identityTransitionKey(transitionId), String(now));
}

export function endAccountIdentityTransition(storage: AccountStorage, transitionId: string): void {
  storage.removeItem(identityTransitionKey(transitionId));
}

export function hasPendingAccountIdentityTransitions(storage: AccountStorage, now = Date.now()): boolean {
  if (!storage.length || !storage.key) return false;
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key?.(index) ?? null)
    .filter((key): key is string => key?.startsWith(ACCOUNT_IDENTITY_TRANSITION_PREFIX) ?? false);
  let pending = false;
  for (const key of keys) {
    const startedAt = Number(storage.getItem(key));
    const age = now - startedAt;
    if (!Number.isFinite(startedAt) || age < 0 || age > ACCOUNT_IDENTITY_TRANSITION_TTL_MS) {
      storage.removeItem(key);
    } else {
      pending = true;
    }
  }
  return pending;
}

function parsePendingGuestLines(raw: unknown): BagLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is BagLine => {
    if (!item || typeof item !== "object") return false;
    const line = item as Record<string, unknown>;
    return typeof line.slug === "string" && /^[a-z0-9-]{1,80}$/.test(line.slug)
      && typeof line.finish === "string" && line.finish.length >= 1 && line.finish.length <= 60
      && typeof line.quantity === "number" && Number.isSafeInteger(line.quantity) && line.quantity > 0;
  }).map(({ slug, finish, quantity }) => ({ slug, finish, quantity }));
}

function readStoredBagState(raw: string | null): StoredBagState {
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object") data = parsed as Record<string, unknown>;
  } catch {
    // The active cart parser below handles malformed content as an empty cart.
  }
  return {
    lines: parseBag(raw),
    pendingGuestLines: parsePendingGuestLines(data.pendingGuestLines),
    processedGuestTransferId: typeof data.processedGuestTransferId === "string" ? data.processedGuestTransferId : null,
  };
}

function serializeStoredBagState(state: StoredBagState): string {
  return JSON.stringify({
    v: 1,
    lines: state.lines,
    pendingGuestLines: state.pendingGuestLines,
    processedGuestTransferId: state.processedGuestTransferId,
  });
}

function mergeWithinLimits(account: BagLine[], incoming: BagLine[]): { lines: BagLine[]; unmerged: BagLine[] } {
  const lines = account.map((line) => ({ ...line }));
  const unmerged: BagLine[] = [];
  for (const incomingLine of incoming) {
    const index = lines.findIndex((line) => line.slug === incomingLine.slug && line.finish === incomingLine.finish);
    if (index >= 0) {
      const available = MAX_QUANTITY - lines[index].quantity;
      const accepted = Math.min(available, incomingLine.quantity);
      if (accepted > 0) lines[index] = { ...lines[index], quantity: lines[index].quantity + accepted };
      if (incomingLine.quantity > accepted) unmerged.push({ ...incomingLine, quantity: incomingLine.quantity - accepted });
    } else if (lines.length < MAX_LINES) {
      const accepted = Math.min(MAX_QUANTITY, incomingLine.quantity);
      lines.push({ ...incomingLine, quantity: accepted });
      if (incomingLine.quantity > accepted) unmerged.push({ ...incomingLine, quantity: incomingLine.quantity - accepted });
    } else {
      unmerged.push({ ...incomingLine });
    }
  }
  return { lines, unmerged };
}

function appendPending(lines: BagLine[], pending: BagLine[]): BagLine[] {
  const result = lines.map((line) => ({ ...line }));
  for (const incoming of pending) {
    const index = result.findIndex((line) => line.slug === incoming.slug && line.finish === incoming.finish);
    if (index < 0) result.push({ ...incoming });
    else result[index] = { ...result[index], quantity: result[index].quantity + incoming.quantity };
  }
  return result;
}

function promotePending(state: StoredBagState): void {
  const merged = mergeWithinLimits(state.lines, state.pendingGuestLines);
  state.lines = merged.lines;
  state.pendingGuestLines = merged.unmerged;
}

function accountBagKey(accountId: string): string {
  return bagStorageKey(accountId);
}

function readGuestBag(raw: string): { lines: BagLine[]; claimedBy: string | null; transferId: string | null; invalidClaim: boolean } {
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") data = parsed as Record<string, unknown>;
  } catch {
    return { lines: [], claimedBy: null, transferId: null, invalidClaim: false };
  }
  const hasClaim = Object.hasOwn(data, "claimedBy");
  return {
    lines: parseBag(raw),
    claimedBy: isAccountId(data.claimedBy) ? data.claimedBy : null,
    transferId: typeof data.transferId === "string" ? data.transferId : null,
    invalidClaim: hasClaim && !isAccountId(data.claimedBy),
  };
}

export async function readBagForAccount(
  storage: AccountStorage,
  accountId: string | null,
  locks: AccountLockManager | null = null,
): Promise<BagLine[]> {
  if (hasPendingAccountIdentityTransitions(storage)) return [];
  if (!accountId) {
    storage.removeItem(LEGACY_BAG_KEY);
    const guestKey = bagStorageKey(null);
    const guestRaw = storage.getItem(guestKey);
    if (!guestRaw) return [];
    const guest = readGuestBag(guestRaw);
    return guest.claimedBy || guest.invalidClaim ? [] : guest.lines;
  }

  if (!locks) return readStoredBagState(storage.getItem(accountBagKey(accountId))).lines;
  return locks.request(GUEST_BAG_TRANSFER_LOCK, () => readAccountBagWithGuestTransfer(storage, accountId));
}

function readAccountBagWithGuestTransfer(storage: AccountStorage, accountId: string): BagLine[] {
  if (hasPendingAccountIdentityTransitions(storage)) return [];
  storage.removeItem(LEGACY_BAG_KEY);
  const guestKey = bagStorageKey(null);
  const guestRaw = storage.getItem(guestKey);
  const key = accountBagKey(accountId);
  const originalRaw = storage.getItem(key);
  const state = readStoredBagState(originalRaw);
  const originalState = serializeStoredBagState(state);
  promotePending(state);

  let claimedTransferId: string | null = null;
  if (guestRaw) {
    let guest = readGuestBag(guestRaw);
    if (!guest.invalidClaim && (!guest.claimedBy || guest.claimedBy === accountId)) {
      if (guest.lines.length === 0) {
        if (!guest.claimedBy) {
          storage.removeItem(guestKey);
        }
      } else {
        if (!guest.claimedBy) {
          guest = { ...guest, claimedBy: accountId, transferId: crypto.randomUUID() };
          storage.setItem(guestKey, JSON.stringify({
            v: 1,
            lines: guest.lines,
            claimedBy: accountId,
            transferId: guest.transferId,
          }));
        }
        claimedTransferId = guest.transferId;
        if (claimedTransferId && state.processedGuestTransferId !== claimedTransferId) {
          const merged = mergeWithinLimits(state.lines, guest.lines);
          state.lines = merged.lines;
          state.pendingGuestLines = appendPending(state.pendingGuestLines, merged.unmerged);
          state.processedGuestTransferId = claimedTransferId;
        }
      }
    }
  }

  const nextRaw = serializeStoredBagState(state);
  if (nextRaw !== originalState || (originalRaw === null && (state.lines.length > 0 || state.pendingGuestLines.length > 0))) {
    storage.setItem(key, nextRaw);
  }
  if (claimedTransferId && state.processedGuestTransferId === claimedTransferId) {
    try {
      storage.removeItem(guestKey);
    } catch {
      // The claimed guest snapshot remains hidden and its transfer ID prevents duplicate merging on retry.
    }
  }
  return state.lines;
}

export function writeBagForAccount(storage: AccountStorage, accountId: string | null, lines: BagLine[]): BagLine[] {
  if (hasPendingAccountIdentityTransitions(storage)) return lines;
  storage.removeItem(LEGACY_BAG_KEY);
  const key = bagStorageKey(accountId);
  if (!accountId) {
    const existingGuest = storage.getItem(key);
    if (existingGuest) {
      const guest = readGuestBag(existingGuest);
      if (guest.claimedBy || guest.invalidClaim) return lines;
    }
    storage.setItem(key, serializeBag(lines));
    return lines;
  }

  const state = readStoredBagState(storage.getItem(key));
  state.lines = parseBag(serializeBag(lines));
  promotePending(state);
  storage.setItem(key, serializeStoredBagState(state));
  return state.lines;
}

export function readFavouritesForAccount(storage: AccountStorage, accountId: string | null): string[] {
  if (hasPendingAccountIdentityTransitions(storage)) return [];
  storage.removeItem(LEGACY_FAVOURITES_KEY);
  return parseFavourites(storage.getItem(favouritesStorageKey(accountId)));
}

export function writeFavouritesForAccount(storage: AccountStorage, accountId: string | null, slugs: string[]): void {
  if (hasPendingAccountIdentityTransitions(storage)) return;
  storage.removeItem(LEGACY_FAVOURITES_KEY);
  storage.setItem(favouritesStorageKey(accountId), serializeFavourites(slugs));
}
