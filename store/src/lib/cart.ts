// Bag rules, with no browser or framework code, so they can be tested directly.
// The bag stores only what the customer chose: product, finish and quantity. Prices always come
// from the catalogue when the bag is shown, and checkout will recalculate everything on the server.
import type { Product } from "./sample-catalogue";

export type BagLine = { slug: string; finish: string; quantity: number };
export type LineProblem = "missing" | "sold-out" | "finish";
export type ResolvedLine = BagLine & { key: string; product?: Product; unitPaise: number; linePaise: number; problem?: LineProblem };
export type AddResult = "added" | "limit" | "full" | "switching";

/** A display limit for the bag only. Real stock is checked on the server at checkout. */
export const MAX_QUANTITY = 10;
export const MAX_LINES = 30;
export const BAG_VERSION = 1;

const SLUG = /^[a-z0-9-]{1,80}$/;

export const lineKey = (slug: string, finish: string) => `${slug}::${finish}`;
const keyOf = (line: BagLine) => lineKey(line.slug, line.finish);
const clamp = (quantity: number) => Math.min(MAX_QUANTITY, Math.max(1, quantity));

export function addLine(lines: BagLine[], slug: string, finish: string, quantity = 1): { lines: BagLine[]; result: AddResult } {
  const key = lineKey(slug, finish);
  const index = lines.findIndex((line) => keyOf(line) === key);
  if (index >= 0) {
    const current = lines[index];
    if (current.quantity >= MAX_QUANTITY) return { lines, result: "limit" };
    const next = lines.slice();
    next[index] = { ...current, quantity: clamp(current.quantity + quantity) };
    return { lines: next, result: "added" };
  }
  if (lines.length >= MAX_LINES) return { lines, result: "full" };
  return { lines: [...lines, { slug, finish, quantity: clamp(quantity) }], result: "added" };
}

export function setQuantity(lines: BagLine[], key: string, quantity: number): BagLine[] {
  if (!Number.isInteger(quantity)) return lines;
  return lines.map((line) => (keyOf(line) === key ? { ...line, quantity: clamp(quantity) } : line));
}

export const removeLine = (lines: BagLine[], key: string) => lines.filter((line) => keyOf(line) !== key);

export const itemCount = (lines: BagLine[]) => lines.reduce((total, line) => total + line.quantity, 0);

/** Reads stored data defensively: anything malformed is dropped, never trusted. */
export function parseBag(raw: string | null): BagLine[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!data || typeof data !== "object") return [];
  const { v, lines } = data as { v?: unknown; lines?: unknown };
  if (v !== BAG_VERSION || !Array.isArray(lines)) return [];
  let out: BagLine[] = [];
  for (const item of lines) {
    if (!item || typeof item !== "object") continue;
    const { slug, finish, quantity } = item as Record<string, unknown>;
    if (typeof slug !== "string" || !SLUG.test(slug)) continue;
    if (typeof finish !== "string" || finish.length < 1 || finish.length > 60) continue;
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) continue;
    out = addLine(out, slug, finish, quantity).lines;
  }
  return out;
}

export const serializeBag = (lines: BagLine[]) =>
  JSON.stringify({ v: BAG_VERSION, lines: lines.map(({ slug, finish, quantity }) => ({ slug, finish, quantity })) });

/** Prices come from the catalogue lookup only. Unavailable lines are kept so the customer can see and remove them. */
export function resolveLines(lines: BagLine[], find: (slug: string) => Product | undefined): ResolvedLine[] {
  return lines.map((line) => {
    const product = find(line.slug);
    const base = { ...line, key: keyOf(line) };
    if (!product) return { ...base, unitPaise: 0, linePaise: 0, problem: "missing" as const };
    if (product.soldOut) return { ...base, product, unitPaise: product.pricePaise, linePaise: 0, problem: "sold-out" as const };
    if (!product.finishes.includes(line.finish)) return { ...base, product, unitPaise: product.pricePaise, linePaise: 0, problem: "finish" as const };
    return { ...base, product, unitPaise: product.pricePaise, linePaise: product.pricePaise * line.quantity };
  });
}

/** Messages for an add that didn't happen, shared by the product page and product cards. */
export const ADD_RESULT_MESSAGES: Record<Exclude<AddResult, "added">, string> = {
  limit: "That's the most of this piece one bag can hold.",
  full: "Your bag is full. Remove something to add this piece.",
  switching: "Your account is changing. Please try again in a moment.",
};

/**
 * Why a product and finish can't go in the bag, or null if they can: the product must exist and be in stock, and the
 * finish must be one of the product's own finishes. Nothing is ever added without a finish the customer chose.
 * The same checks resolveLines applies when the bag is shown.
 */
export function addProblem(product: Product | undefined, finish: string | null | undefined): LineProblem | null {
  if (!product) return "missing";
  if (product.soldOut) return "sold-out";
  if (!finish || !product.finishes.includes(finish)) return "finish";
  return null;
}

/** Only available lines count towards the subtotal. */
export const subtotalPaise = (resolved: ResolvedLine[]) => resolved.reduce((total, line) => (line.problem ? total : total + line.linePaise), 0);
