// PIN code and post office data rules, shared by the build script (scripts/build-pin-data.mjs), the browser and the tests.
// No browser or framework code here, so it can be tested directly.
//
// Source: the India Post "All India Pincode Directory with contact details along with Latitude and Longitude" CSV
// from data.gov.in. The build script turns it into small static files under /public/data/pin/<version>/:
//   - p/<3-digit prefix>.json: every PIN with that prefix, mapped to the district and state it covers.
//     A file exists for every prefix from 100 to 999, so a lookup never hits a missing file.
//   - geo.bin.gz: every post office location in one compact file, for "Use my current location". It's one file on
//     purpose: downloading the whole thing means no request ever reveals even a rough area of the customer's location.
// Change PIN_DATA_VERSION whenever the files are rebuilt, because browsers cache them for a year.

export const PIN_DATA_VERSION = "v1";
export const PIN_DATA_PATH = `/data/pin/${PIN_DATA_VERSION}`;
export const PIN_PATTERN = /^[1-9]\d{5}$/;

/** One district (and its state) that a PIN covers. `state` is null when India Post's record doesn't say. */
export type PinPlace = { city: string; state: string | null; offices: number; examples: string[] };
/** Stored form of a place: [city, state or "", post office count, ...a few example post office names]. */
export type StoredPlace = [string, string, number, ...string[]];
export type PrefixFile = Record<string, StoredPlace[]>;

const SMALL_WORDS = new Set(["and", "of", "the"]);

/** "KUMURAM BHEEM ASIFABAD" → "Kumuram Bheem Asifabad"; "Y.S.R." stays "Y.S.R."; "and" stays lower case. */
export function titleCase(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .map((word, i) => (i > 0 && SMALL_WORDS.has(word) ? word : word.replace(/(^|[(.\-/])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase())))
    .join(" ");
}

/** Maps the CSV's upper-case state name to one of `states` (the checkout's list), or null if it's missing or unknown. */
export function stateFromCsv(raw: string, states: readonly string[]): string | null {
  const name = raw.trim().toUpperCase().replace(/^THE /, "");
  if (!name || name === "NA") return null;
  return states.find((s) => s.toUpperCase() === name) ?? null;
}

/** "Kothimir B.O" → "Kothimir", "Connaught Place S.O" → "Connaught Place". */
export function cleanOfficeName(raw: string): string {
  return titleCase(raw.replace(/\s+(?:[BSH]\.?\s?O\.?|G\.?P\.?O\.?)\s*$/i, ""));
}

// India Post records districts, and a few districts aren't what anyone writes as their city.
const CITY_NAMES: Record<string, string> = { "Mumbai Suburban": "Mumbai", "Bengaluru Urban": "Bengaluru" };

/** The city to suggest for a district (already in title case). Delhi's districts ("South West", "Central") become "Delhi". */
export function cityFor(district: string, state: string | null): string {
  if (state === "Delhi") return district === "New Delhi" ? "New Delhi" : "Delhi";
  return CITY_NAMES[district] ?? district;
}

export function decodePlaces(stored: StoredPlace[] | undefined): PinPlace[] {
  return (stored ?? []).map(([city, state, offices, ...examples]) => ({ city, state: state || null, offices, examples }));
}

export function prefixOf(pin: string): string {
  return pin.slice(0, 3);
}

// ---- Location file ----
// The build script gzips the output of encodeGeo, and the browser unzips it before decodeGeo. Layout, little-endian:
//   "NVG2" | u32 JSON length | JSON {places: [city, state][], pinDeltas: number[], count} | zero padding to a multiple of 2 |
//   four u16 columns of `count` values each: latitude, longitude, PIN index, place index.
// Each column holds differences from the previous value (wrapping at 65536), which compresses far better than raw values.
// Coordinates are thousandths of a degree from 6°N and 68°E, about 110 m, finer than the source data's own accuracy.

const MAGIC = "NVG2";
const LAT0 = 6;
const LON0 = 68;
/** Mainland India, the islands and the far north-east fit inside this box. */
export const INDIA_BOUNDS = { minLat: 6, maxLat: 37.5, minLon: 68, maxLon: 97.5 };

/** `points` holds four values per office: latitude, longitude, PIN index and place index. */
export type GeoIndex = { places: [string, string][]; pins: number[]; points: Uint16Array };
export type GeoPoint = { lat: number; lon: number; pin: number; place: number };

export function insideIndia(lat: number, lon: number): boolean {
  return lat >= INDIA_BOUNDS.minLat && lat <= INDIA_BOUNDS.maxLat && lon >= INDIA_BOUNDS.minLon && lon <= INDIA_BOUNDS.maxLon;
}

export function encodeGeo(places: [string, string][], pins: number[], points: GeoPoint[]): Uint8Array {
  const pinDeltas = pins.map((p, i) => p - (i ? pins[i - 1] : 0));
  const json = new TextEncoder().encode(JSON.stringify({ places, pinDeltas, count: points.length }));
  const start = 8 + json.length + ((8 + json.length) % 2);
  const out = new Uint8Array(start + points.length * 8);
  const view = new DataView(out.buffer);
  out.set(new TextEncoder().encode(MAGIC), 0);
  view.setUint32(4, json.length, true);
  out.set(json, 8);
  const columns: ((p: GeoPoint) => number)[] = [
    (p) => Math.round((p.lat - LAT0) * 1000),
    (p) => Math.round((p.lon - LON0) * 1000),
    (p) => p.pin,
    (p) => p.place,
  ];
  columns.forEach((value, c) => {
    let previous = 0;
    points.forEach((p, i) => {
      const v = value(p);
      if (v < 0 || v > 65535) throw new Error("Value doesn't fit the location file");
      view.setUint16(start + (c * points.length + i) * 2, (v - previous + 65536) % 65536, true);
      previous = v;
    });
  });
  return out;
}

export function decodeGeo(buffer: ArrayBuffer): GeoIndex {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 8 || new TextDecoder().decode(bytes.subarray(0, 4)) !== MAGIC) throw new Error("Unknown location file format");
  const view = new DataView(buffer);
  const length = view.getUint32(4, true);
  const { places, pinDeltas, count } = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + length)));
  const start = 8 + length + ((8 + length) % 2);
  if (start + count * 8 > bytes.length) throw new Error("Location file is incomplete");
  let pin = 0;
  const pins = (pinDeltas as number[]).map((d) => (pin += d));
  const points = new Uint16Array(count * 4);
  for (let c = 0; c < 4; c++) {
    let value = 0;
    for (let i = 0; i < count; i++) {
      value = (value + view.getUint16(start + (c * count + i) * 2, true)) % 65536;
      points[i * 4 + c] = value;
    }
  }
  return { places, pins, points };
}

/** Distance in kilometres between two points (haversine). */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export type NearestOffice = { pin: string; city: string; state: string | null; km: number };

/** The post office nearest to a point, or null if none is within `maxKm`. Runs entirely in the browser. */
export function nearestOffice(geo: GeoIndex, lat: number, lon: number, maxKm = 25): NearestOffice | null {
  if (!insideIndia(lat, lon)) return null;
  // A cheap flat-earth distance picks the candidate; the exact distance is worked out once at the end.
  const cos = Math.cos((lat * Math.PI) / 180);
  const y = (lat - LAT0) * 1000;
  const x = (lon - LON0) * 1000;
  let best = -1;
  let bestScore = Infinity;
  const { points } = geo;
  for (let i = 0; i < points.length; i += 4) {
    const dy = points[i] - y;
    const dx = (points[i + 1] - x) * cos;
    const score = dx * dx + dy * dy;
    if (score < bestScore) { bestScore = score; best = i; }
  }
  if (best < 0) return null;
  const km = distanceKm(lat, lon, points[best] / 1000 + LAT0, points[best + 1] / 1000 + LON0);
  if (km > maxKm) return null;
  const [city, state] = geo.places[points[best + 3]];
  return { pin: String(geo.pins[points[best + 2]]), city, state: state || null, km };
}
