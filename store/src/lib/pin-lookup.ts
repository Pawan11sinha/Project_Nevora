// Browser loading of the static PIN code files. Each file is fetched at most once per page visit, and the browser's
// HTTP cache keeps it for a year after that (see next.config.ts), because the files are versioned.
// Nothing here sends coordinates anywhere: the location file is downloaded whole and searched in the browser.

import { PIN_DATA_PATH, decodeGeo, decodePlaces, prefixOf, type GeoIndex, type PinPlace, type PrefixFile } from "./pincode";

const prefixes = new Map<string, Promise<PrefixFile>>();
let geo: Promise<GeoIndex> | null = null;

async function fetchOk(path: string): Promise<Response> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Couldn't load ${path} (${response.status})`);
  return response;
}

/** The districts a PIN covers, most post offices first. An empty list means the PIN isn't in India Post's list. */
export async function lookupPin(pin: string): Promise<PinPlace[]> {
  const prefix = prefixOf(pin);
  let file = prefixes.get(prefix);
  if (!file) {
    file = fetchOk(`${PIN_DATA_PATH}/p/${prefix}.json`).then((r) => r.json() as Promise<PrefixFile>);
    prefixes.set(prefix, file);
    file.catch(() => prefixes.delete(prefix)); // a failed download can be retried
  }
  return decodePlaces((await file)[pin]);
}

export class UnsupportedBrowserError extends Error {}

/** Every post office location, for finding the nearest one. Downloaded only when the customer asks to use their location. */
export function loadGeo(): Promise<GeoIndex> {
  if (!geo) {
    geo = (async () => {
      let buffer = await (await fetchOk(`${PIN_DATA_PATH}/geo.bin.gz`)).arrayBuffer();
      const bytes = new Uint8Array(buffer);
      // A server or CDN may already have unzipped it, so only unzip when the gzip signature is there.
      if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
        if (typeof DecompressionStream === "undefined") throw new UnsupportedBrowserError("DecompressionStream isn't available");
        buffer = await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
      }
      return decodeGeo(buffer);
    })();
    geo.catch(() => { geo = null; });
  }
  return geo;
}
