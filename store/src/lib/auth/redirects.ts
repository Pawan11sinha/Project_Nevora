// Where to send a customer after signing in. Only the store's own pages are allowed, so a crafted link like
// /auth/login?next=https://evil.example can't use NÉVORA's sign-in to send someone elsewhere (an open redirect).

export const DEFAULT_AFTER_SIGN_IN = "/account";

/** Pages a customer may be returned to after signing in. Admin is never one of them: it has its own sign-in. */
const ALLOWED = ["/account", "/bag", "/checkout", "/favourites"];

export function safeNext(next: string | null | undefined): string {
  if (!next || next.length > 200) return DEFAULT_AFTER_SIGN_IN;
  // Must be a plain path on this site: one leading slash, no backslashes, no scheme, no control characters.
  if (!next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f]/.test(next)) return DEFAULT_AFTER_SIGN_IN;
  let path: string;
  try {
    const url = new URL(next, "https://nevora.invalid");
    if (url.origin !== "https://nevora.invalid") return DEFAULT_AFTER_SIGN_IN;
    path = url.pathname;
    return ALLOWED.some((a) => path === a || path.startsWith(`${a}/`)) ? `${path}${url.search}` : DEFAULT_AFTER_SIGN_IN;
  } catch {
    return DEFAULT_AFTER_SIGN_IN;
  }
}
