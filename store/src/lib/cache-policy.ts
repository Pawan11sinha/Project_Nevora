// Which routes may be cached by browsers and shared caches, and which must never be.
// Every top-level route in src/app must appear in exactly one list; tests/cache-policy.test.mjs enforces this, so a new
// route can't be added without deciding. next.config.ts turns PRIVATE_ROUTES into `Cache-Control: no-store` headers.
//
// Private pages are still pre-rendered and served from OpenNext's cache, so this costs no extra Worker CPU. It only
// stops browsers and shared caches from storing the response.

export const NO_STORE = "no-store";

/** The customer's bag and checkout, and the planned account, order, admin and API routes. Never cached. */
export const PRIVATE_ROUTES = ["/bag", "/checkout", "/account", "/order", "/admin", "/api"] as const;

/** The public catalogue and information pages. Pre-rendered and cacheable. "/" is the home page only. */
export const PUBLIC_ROUTES = ["/", "/categories", "/collections", "/products", "/info", "/design"] as const;

/** Header rules for next.config.ts: each private route and everything under it. */
export function noStoreHeaderRules() {
  return PRIVATE_ROUTES.flatMap((route) => [route, `${route}/:path*`]).map((source) => ({
    source,
    headers: [{ key: "Cache-Control", value: NO_STORE }],
  }));
}
