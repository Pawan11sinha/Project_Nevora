// Race logic for the stock tests. Every request runs to completion, and is never retried.
export const RACE_TIMEOUT_MS = 30_000;

// One purchase attempt. It always resolves, and reports what actually happened.
export async function attemptPurchase({ url, headers, timeoutMs = RACE_TIMEOUT_MS }) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: "{}",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return { kind: "invalid", detail: `status ${response.status}, not JSON` };
    }
    if (response.status === 200 && json === true) return { kind: "win" };
    if (response.status === 200 && json === false) return { kind: "loss" };
    return { kind: "invalid", detail: `status ${response.status}, code ${json?.code ?? "none"}` };
  } catch (error) {
    // Keep the underlying cause, which fetch hides behind "fetch failed".
    const cause = error.cause;
    const parts = [error.name, error.message, cause?.code, cause?.message].filter(Boolean);
    return { kind: "network", detail: parts.join(" | ") };
  }
}

// Starts every attempt together, and waits for ALL of them before returning.
export async function runRace({ buyers, availableStock, attempt }) {
  const settled = await Promise.allSettled(Array.from({ length: buyers }, (_, i) => attempt(i)));
  const results = settled.map((s) =>
    s.status === "fulfilled" ? s.value : { kind: "network", detail: `rejected: ${s.reason}` },
  );
  const count = (kind) => results.filter((r) => r.kind === kind).length;
  const summary = {
    buyers,
    availableStock,
    completed: settled.length,
    wins: count("win"),
    losses: count("loss"),
    invalid: count("invalid"),
    network: count("network"),
  };
  const errors = {};
  for (const r of results) {
    if (r.detail) errors[r.detail] = (errors[r.detail] ?? 0) + 1;
  }
  // Passes only when every request returned a valid result and exactly the stock was sold.
  const pass =
    summary.invalid === 0 &&
    summary.network === 0 &&
    summary.wins === availableStock &&
    summary.losses === buyers - availableStock;
  return { ...summary, errors, pass };
}
