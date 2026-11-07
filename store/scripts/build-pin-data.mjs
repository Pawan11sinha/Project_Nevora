// Builds the checkout's PIN code files from the India Post directory CSV (data.gov.in).
//
//   node scripts/build-pin-data.mjs "<path to the CSV>"
//
// The CSV isn't committed: it's 23 MB, and the generated files under public/data/pin/<version>/ are all the site needs.
// manifest.json records the CSV's SHA-256 and what was cleaned, so a rebuild can be checked against the same source.
// Browsers cache the files for a year, so a published version never changes: if public/data/pin/<version>/ exists, the
// build only checks that its output matches exactly, and refuses to write otherwise. After changing the source or the
// rules, bump PIN_DATA_VERSION in src/lib/pincode.ts and add the matching rule to public/_headers.
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { INDIAN_STATES } from "../src/lib/checkout.ts";
import { PIN_DATA_PATH, PIN_DATA_VERSION, PIN_PATTERN, cityFor, cleanOfficeName, distanceKm, encodeGeo, insideIndia, prefixOf, stateFromCsv, titleCase } from "../src/lib/pincode.ts";

const source = process.argv[2];
if (!source) { console.error("Usage: node scripts/build-pin-data.mjs <csv>"); process.exit(1); }
const raw = readFileSync(source);
const out = join(import.meta.dirname, "..", "public", PIN_DATA_PATH);
const EXAMPLES = 3;          // post office names shown when a PIN covers more than one district
const PIN_SPREAD_KM = 60;    // an office further than this from the middle of its PIN's offices is a bad coordinate
const DISTRICT_SPREAD_KM = 250;
const GRID = 200;            // offices of one PIN within about 500 m of each other are kept as one point

// ---- CSV ----
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1);
}

const [header, ...body] = parseCsv(raw.toString("utf8").replace(/^﻿/, ""));
const EXPECTED = ["circlename", "regionname", "divisionname", "officename", "pincode", "officetype", "delivery", "district", "statename", "latitude", "longitude"];
if (header.join() !== EXPECTED.join()) { console.error(`Unexpected columns: ${header.join()}`); process.exit(1); }
const col = Object.fromEntries(header.map((h, i) => [h, i]));
const stats = { rows: body.length, badPinRows: 0, rowsWithoutDistrict: 0, statesInferred: 0, rowsWithoutState: 0, pins: 0, pinsWithoutPlace: 0, pinsWithSeveralPlaces: 0,
  coordinates: { missing: 0, swapped: 0, outsideIndia: 0, farFromPin: 0, farFromDistrict: 0, kept: 0, pointsAfterMerging: 0 } };

// ---- Places ----
const records = [];
const districtStates = new Map();
for (const r of body) {
  const pin = r[col.pincode].trim();
  if (!PIN_PATTERN.test(pin)) { stats.badPinRows++; continue; }
  const district = r[col.district].trim().toUpperCase();
  const state = stateFromCsv(r[col.statename], INDIAN_STATES);
  const city = district && district !== "NA" ? titleCase(district) : null;
  if (city && state) {
    if (!districtStates.has(city)) districtStates.set(city, new Set());
    districtStates.get(city).add(state);
  }
  records.push({ pin, city, state, office: cleanOfficeName(r[col.officename]), lat: r[col.latitude], lon: r[col.longitude] });
}
for (const rec of records) {
  if (!rec.city) { stats.rowsWithoutDistrict++; continue; }
  if (!rec.state) {
    // Only fill a missing state when the district name belongs to exactly one state elsewhere in the file.
    const known = districtStates.get(rec.city);
    if (known?.size === 1) { rec.state = [...known][0]; stats.statesInferred++; }
    else stats.rowsWithoutState++;
  }
  rec.city = cityFor(rec.city, rec.state);
}

const byPin = new Map();
for (const rec of records) {
  if (!byPin.has(rec.pin)) byPin.set(rec.pin, []);
  byPin.get(rec.pin).push(rec);
}
stats.pins = byPin.size;

const placesByPin = new Map();
for (const [pin, recs] of byPin) {
  const groups = new Map();
  for (const rec of recs) {
    if (!rec.city) continue;
    // An office with no state joins a same-named district of this PIN that has one.
    const state = rec.state ?? recs.find((o) => o.city === rec.city && o.state)?.state ?? "";
    rec.placeKey = `${rec.city}|${state}`;
    if (!groups.has(rec.placeKey)) groups.set(rec.placeKey, { city: rec.city, state, offices: new Set() });
    groups.get(rec.placeKey).offices.add(rec.office);
  }
  const places = [...groups.values()].sort((a, b) => b.offices.size - a.offices.size || a.city.localeCompare(b.city));
  if (places.length === 0) { stats.pinsWithoutPlace++; continue; }
  if (places.length > 1) stats.pinsWithSeveralPlaces++;
  placesByPin.set(pin, places);
}

// ---- Coordinates ----
const median = (values) => { const s = [...values].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const located = [];
for (const rec of records) {
  if (!rec.placeKey) continue;
  let lat = Number(rec.lat), lon = Number(rec.lon);
  if (!rec.lat || !rec.lon || !Number.isFinite(lat) || !Number.isFinite(lon)) { stats.coordinates.missing++; continue; }
  if (!insideIndia(lat, lon)) {
    if (insideIndia(lon, lat)) { [lat, lon] = [lon, lat]; stats.coordinates.swapped++; }
    else { stats.coordinates.outsideIndia++; continue; }
  }
  located.push({ ...rec, lat, lon });
}
function dropFar(points, keyOf, limitKm, minGroup, counter) {
  const groups = new Map();
  for (const p of points) { const k = keyOf(p); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
  const middle = new Map([...groups].filter(([, g]) => g.length >= minGroup).map(([k, g]) => [k, [median(g.map((p) => p.lat)), median(g.map((p) => p.lon))]]));
  return points.filter((p) => {
    const m = middle.get(keyOf(p));
    if (m && distanceKm(p.lat, p.lon, m[0], m[1]) > limitKm) { stats.coordinates[counter]++; return false; }
    return true;
  });
}
let points = dropFar(located, (p) => p.pin, PIN_SPREAD_KM, 3, "farFromPin");
points = dropFar(points, (p) => p.placeKey, DISTRICT_SPREAD_KM, 5, "farFromDistrict");
stats.coordinates.kept = points.length;

const placeIndex = new Map();
const places = [];
const pinList = [...new Set(points.map((p) => p.pin))].sort();
const pinIndex = new Map(pinList.map((p, i) => [p, i]));
const seen = new Set();
const geoPoints = [];
for (const p of points.sort((a, b) => a.pin.localeCompare(b.pin) || a.lat - b.lat || a.lon - b.lon)) {
  if (!placeIndex.has(p.placeKey)) { placeIndex.set(p.placeKey, places.length); places.push(p.placeKey.split("|")); }
  const key = `${p.pin}|${p.placeKey}|${Math.round(p.lat * GRID)}|${Math.round(p.lon * GRID)}`;
  if (seen.has(key)) continue;
  seen.add(key);
  geoPoints.push({ lat: p.lat, lon: p.lon, pin: pinIndex.get(p.pin), place: placeIndex.get(p.placeKey) });
}
stats.coordinates.pointsAfterMerging = geoPoints.length;
if (pinList.length > 65535 || places.length > 65535) throw new Error("Too many PINs or places for 16-bit indexes");

// ---- Output ----
const files = new Map(); // path inside the version folder → contents
const prefixFiles = new Map();
for (let n = 100; n <= 999; n++) prefixFiles.set(String(n), {});
for (const [pin, list] of [...placesByPin].sort(([a], [b]) => a.localeCompare(b))) {
  prefixFiles.get(prefixOf(pin))[pin] = list.map((p) => [p.city, p.state, p.offices.size, ...(list.length > 1 ? [...p.offices].sort().slice(0, EXAMPLES) : [])]);
}
for (const [prefix, data] of prefixFiles) files.set(`p/${prefix}.json`, Buffer.from(JSON.stringify(data)));
const geoRaw = encodeGeo(places, pinList.map(Number), geoPoints);
const geo = gzipSync(geoRaw, { level: 9 });
files.set("geo.bin.gz", geo);

const manifest = {
  version: PIN_DATA_VERSION,
  source: {
    title: "All India Pincode Directory with contact details along with Latitude and Longitude",
    publisher: "Department of Posts, Ministry of Communications, Government of India",
    platform: "Open Government Data (OGD) Platform India, data.gov.in",
    licence: "Government Open Data License – India (GODL-India)",
    file: "5c2f62fe-5afa-4119-a499-fec9d604d5bd.csv",
    sha256: createHash("sha256").update(raw).digest("hex"),
    bytes: raw.length,
  },
  changes: [
    "Kept only PIN code, district, state and coordinates; dropped circle, region, division, office type and delivery status.",
    "District and post office names converted to title case; the 'B.O', 'S.O' and 'H.O' suffixes removed.",
    "Districts used as the suggested city, except Delhi's districts (suggested as 'Delhi', or 'New Delhi' for the New Delhi district), 'Mumbai Suburban' (as 'Mumbai') and 'Bengaluru Urban' (as 'Bengaluru').",
    "A missing state was filled only where the district name belongs to exactly one state elsewhere in the file.",
    "Coordinates with latitude and longitude swapped were corrected; coordinates outside India, or far from the other offices of the same PIN or district, were removed.",
    `Coordinates rounded to 0.001 degrees, and offices of one PIN within about 500 m merged into one point.`,
  ],
  stats,
  files: { prefixFiles: prefixFiles.size, geoBytes: geo.length, geoBytesUnzipped: geoRaw.length, places: places.length, geoPins: pinList.length },
};
files.set("manifest.json", Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
files.set("NOTICE.txt", Buffer.from(`PIN code and post office data in this folder

Source: "${manifest.source.title}", ${manifest.source.publisher}, published on the ${manifest.source.platform}.
Published under the ${manifest.source.licence}: https://data.gov.in/government-open-data-license-india
NÉVORA isn't endorsed by the Department of Posts or data.gov.in.

Changes made by NÉVORA:
${manifest.changes.map((c) => `- ${c}`).join("\n")}

Source file SHA-256: ${manifest.source.sha256}
`));

// ---- Version guard ----
// Browsers cache these files for a year, so a published version must never change. If this version's folder exists,
// the new output must match it exactly; otherwise nothing is written and the version has to be bumped.
const existing = existsSync(out) ? readdirSync(out, { recursive: true }).filter((f) => statSync(join(out, f)).isFile()).map((f) => f.split(sep).join("/")) : null;
if (existing) {
  const changed = [...files].filter(([path, data]) => !existing.includes(path) || !readFileSync(join(out, path)).equals(data)).map(([path]) => path);
  const extra = existing.filter((path) => !files.has(path));
  if (changed.length || extra.length) {
    console.error(`${PIN_DATA_PATH} already exists and this build would change it (${changed.length} changed or new, ${extra.length} removed, for example ${[...changed, ...extra].slice(0, 3).join(", ")}).
Browsers cache these files for a year, so a published version must not change. Nothing was written.
To publish new data: bump PIN_DATA_VERSION in src/lib/pincode.ts, add the matching rule to public/_headers, rebuild,
and delete the old version folder one release later.`);
    process.exit(1);
  }
  console.log(`${PIN_DATA_PATH} is unchanged: the rebuild matches the published files exactly. Nothing was written.`);
} else {
  for (const [path, data] of files) {
    mkdirSync(dirname(join(out, path)), { recursive: true });
    writeFileSync(join(out, path), data);
  }
  console.log(`Wrote ${files.size} files to public${PIN_DATA_PATH}.`);
}
console.log(JSON.stringify({ stats, files: manifest.files }, null, 2));
