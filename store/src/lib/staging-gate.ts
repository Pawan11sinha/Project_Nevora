// Password gate for the staging Worker. Pure functions, so they can be tested directly.
//
// The browser shows its own username and password box (HTTP Basic authentication over HTTPS). Only the password is
// checked; the username is ignored. The password is a Wrangler secret, STAGING_PASSWORD, never stored in code or Git.
//
// The gate protects everything the Worker serves: pages, in-app page loads and 404s. Static files are served before the
// Worker runs, so they stay reachable; they hold only public data and app code, with no secrets or personal data.
// It fails closed: a deployed Worker without a usable password refuses every request. Only the local preview on
// plain-HTTP localhost skips it.

export const MIN_PASSWORD_LENGTH = 20;

export type GateDecision = "allow" | "challenge" | "misconfigured";

/** True only for the local preview: plain HTTP on localhost. A deployed Worker is always reached over HTTPS by its own hostname. */
export function isLocalPreview(url: URL): boolean {
  return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
}

/** Compares two strings in time that doesn't depend on where they differ. */
export function constantTimeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** The password from an `Authorization: Basic …` header, or null if there isn't a readable one. */
export function basicPassword(authorization: string | null): string | null {
  const match = authorization?.match(/^Basic\s+([A-Za-z0-9+/=]+)\s*$/i);
  if (!match) return null;
  try {
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(match[1]), (c) => c.charCodeAt(0)));
    const colon = decoded.indexOf(":");
    return colon < 0 ? null : decoded.slice(colon + 1);
  } catch {
    return null;
  }
}

export function gateDecision(url: URL, authorization: string | null, password: string | undefined): GateDecision {
  if (isLocalPreview(url)) return "allow";
  if (!password || password.length < MIN_PASSWORD_LENGTH) return "misconfigured";
  const given = basicPassword(authorization);
  return given !== null && constantTimeEqual(given, password) ? "allow" : "challenge";
}

const baseHeaders = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
};

export function gateResponse(decision: Exclude<GateDecision, "allow">): Response {
  if (decision === "misconfigured") {
    return new Response("Staging is closed.", { status: 503, headers: baseHeaders });
  }
  return new Response("Sign-in required.", {
    status: 401,
    headers: { ...baseHeaders, "WWW-Authenticate": 'Basic realm="NEVORA staging", charset="UTF-8"' },
  });
}
