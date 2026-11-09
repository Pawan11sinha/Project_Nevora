"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import {
  announceAccountIdentityChanged,
  beginAccountIdentityChange,
  handleAccountIdentityPageShow,
  notifyAccountIdentityChanged,
} from "@/lib/account-identity-client";
import { isAccountId } from "@/lib/account-storage";

const TRANSITION_PARAM = "identity_transition";

function syncIdentityFromUrl(): void {
  const url = new URL(window.location.href);
  const id = url.searchParams.get(TRANSITION_PARAM);
  if (id && isAccountId(id)) notifyAccountIdentityChanged(id);
  else announceAccountIdentityChanged();
  if (url.searchParams.has(TRANSITION_PARAM)) {
    url.searchParams.delete(TRANSITION_PARAM);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }
}

export function AccountIdentitySync() {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    syncIdentityFromUrl();
    const onGoogleSignIn = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.origin !== window.location.origin) return;
      if (anchor.pathname === "/auth/google") {
        const id = beginAccountIdentityChange();
        const url = new URL(anchor.href);
        url.searchParams.set(TRANSITION_PARAM, id);
        if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
          event.preventDefault();
          window.location.assign(url);
        } else {
          anchor.href = url.toString();
        }
      }
    };
    const onPageShow = (event: PageTransitionEvent) => {
      handleAccountIdentityPageShow(event);
    };
    document.addEventListener("click", onGoogleSignIn, true);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("click", onGoogleSignIn, true);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [pathname, search]);

  return null;
}
