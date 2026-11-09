"use client";

import {
  ACCOUNT_ID_COOKIE,
  ACCOUNT_IDENTITY_EVENT,
  ACCOUNT_IDENTITY_STORAGE_EVENT,
  beginAccountIdentityTransition as beginTransition,
  endAccountIdentityTransition as endTransition,
  hasPendingAccountIdentityTransitions,
  isAccountId,
} from "./account-storage.ts";

const fallbackTransitions = new Set<string>();

export function currentAccountId(): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${ACCOUNT_ID_COOKIE}=`;
  const value = document.cookie.split("; ").find((cookie) => cookie.startsWith(prefix))?.slice(prefix.length);
  if (!value) return null;
  try {
    const decoded = decodeURIComponent(value);
    return isAccountId(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function signalIdentityChange(): void {
  window.dispatchEvent(new Event(ACCOUNT_IDENTITY_EVENT));
  try {
    window.localStorage.setItem(ACCOUNT_IDENTITY_STORAGE_EVENT, `${Date.now()}:${Math.random()}`);
  } catch {
    // Same-tab subscribers still receive the event when storage is unavailable.
  }
}

export function isAccountIdentityTransitionPending(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return fallbackTransitions.size > 0 || hasPendingAccountIdentityTransitions(window.localStorage);
  } catch {
    return fallbackTransitions.size > 0;
  }
}

export function beginAccountIdentityChange(): string {
  const id = crypto.randomUUID();
  try {
    beginTransition(window.localStorage, id);
  } catch {
    fallbackTransitions.add(id);
  }
  signalIdentityChange();
  return id;
}

function finishTransition(id: string | null): void {
  if (!id) return;
  fallbackTransitions.delete(id);
  try {
    endTransition(window.localStorage, id);
  } catch {
    // Same-tab subscribers still receive the event when storage is unavailable.
  }
}

export function cancelAccountIdentityChange(id: string | null): void {
  finishTransition(id);
  signalIdentityChange();
}

export function notifyAccountIdentityChanged(id?: string | null): void {
  if (id) finishTransition(id);
  signalIdentityChange();
}

export function announceAccountIdentityChanged(): void {
  signalIdentityChange();
}

export function handleAccountIdentityPageShow(event: Pick<PageTransitionEvent, "persisted">): void {
  if (event.persisted) announceAccountIdentityChanged();
}
