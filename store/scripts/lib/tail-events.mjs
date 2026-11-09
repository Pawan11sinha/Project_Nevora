// Shared handling of `wrangler tail --format json` output for the CPU tools.
//
// Raw tail events contain visitor IP addresses, request headers (including the staging password's Authorization header)
// and Cloudflare metadata. None of that is ever written anywhere: `slimEvent` keeps an allow-list of fields, plus the
// value of one test header, `x-nevora-probe`, which the CPU test sets on its own requests so they can be matched up.

export const PROBE_HEADER = "x-nevora-probe";
/** Probe IDs are short, lower-case and made only of letters, digits and dashes; anything else is discarded. */
export const PROBE_PATTERN = /^[a-z0-9-]{1,80}$/;

/** The only fields ever kept from a tail event. */
export const SLIM_FIELDS = ["t", "method", "path", "outcome", "cpu", "wall", "exceptions", "probe"];

function probeOf(headers) {
  if (!headers || typeof headers !== "object") return null;
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === PROBE_HEADER && typeof value === "string" && PROBE_PATTERN.test(value)) return value;
  }
  return null;
}

/** One small record per Worker invocation, with nothing identifying a visitor. */
export function slimEvent(e) {
  const url = e?.event?.request?.url;
  let path = null;
  try {
    path = url ? new URL(url).pathname : null;
  } catch {
    path = null;
  }
  return {
    t: e?.eventTimestamp ?? null,
    method: e?.event?.request?.method ?? null,
    path,
    outcome: e?.outcome ?? null,
    cpu: e?.cpuTime ?? null,
    wall: e?.wallTime ?? null,
    exceptions: Array.isArray(e?.exceptions) ? e.exceptions.length : 0,
    probe: probeOf(e?.event?.request?.headers),
  };
}

/**
 * Splits tail's stream of pretty-printed JSON objects into events. Calls onEvent(slimEvent) for each parsed object,
 * or onEvent({ unparsed: true }) when one can't be parsed. Returns a function to feed text chunks into.
 */
export function createTailParser(onEvent) {
  let buffer = "";
  let depth = 0, start = -1, inString = false, escaped = false, scanned = 0;
  return (chunk) => {
    buffer += chunk;
    for (let i = scanned; i < buffer.length; i++) {
      const ch = buffer[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === "{" && depth++ === 0) start = i;
      else if (ch === "}" && --depth === 0) {
        let slim;
        try {
          slim = slimEvent(JSON.parse(buffer.slice(start, i + 1)));
        } catch {
          slim = { unparsed: true };
        }
        onEvent(slim);
        buffer = buffer.slice(i + 1);
        i = -1;
        start = -1;
      }
    }
    scanned = buffer.length;
  };
}
