// Favourites (wishlist) rules, with no browser or framework code, so they can be tested directly.
// Local only: favourites live in this browser's storage, with no login, database or server request. An account-synced
// wishlist, merging these after sign-in, is planned after launch (roadmap M13).

export const FAVOURITES_VERSION = 1;
export const MAX_FAVOURITES = 60;

const SLUG = /^[a-z0-9-]{1,80}$/;

export type ToggleResult = "added" | "removed" | "full";

/** Reads stored favourites. Anything unreadable, unknown or duplicated is dropped, never trusted. */
export function parseFavourites(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (data?.v !== FAVOURITES_VERSION || !Array.isArray(data.slugs)) return [];
    const seen = new Set<string>();
    for (const slug of data.slugs) if (typeof slug === "string" && SLUG.test(slug)) seen.add(slug);
    return [...seen].slice(0, MAX_FAVOURITES);
  } catch {
    return [];
  }
}

export const serializeFavourites = (slugs: string[]) => JSON.stringify({ v: FAVOURITES_VERSION, slugs });

/** Adds a product (newest first) or removes it if it's already a favourite. Never creates a duplicate. */
export function toggleFavourite(slugs: string[], slug: string): { slugs: string[]; result: ToggleResult } {
  if (!SLUG.test(slug)) return { slugs, result: "full" };
  if (slugs.includes(slug)) return { slugs: slugs.filter((s) => s !== slug), result: "removed" };
  if (slugs.length >= MAX_FAVOURITES) return { slugs, result: "full" };
  return { slugs: [slug, ...slugs], result: "added" };
}
