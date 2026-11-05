// Temporary access gate for test deployments. The Worker calls this before anything else.
// The header name includes "token" because Cloudflare's tail logs redact such headers.
export const GATE_HEADER = "x-test-gate-token";
const MIN_TOKEN_LENGTH = 32;

// Fails closed: with no configured token, or a short one, every request is refused.
export function gateAllows(provided: string | null, expected: string | undefined) {
  if (!expected || expected.length < MIN_TOKEN_LENGTH || provided === null) return false;
  let difference = provided.length ^ expected.length;
  for (let i = 0; i < expected.length; i++) {
    difference |= (provided.charCodeAt(i) || 0) ^ expected.charCodeAt(i);
  }
  return difference === 0;
}
