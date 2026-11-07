// PIN code rules, and checks on the generated files in public/data/pin/.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { gunzipSync } from "node:zlib";
import { INDIAN_STATES, validateField } from "../src/lib/checkout.ts";
import { PIN_DATA_PATH, cityFor, cleanOfficeName, decodeGeo, decodePlaces, distanceKm, encodeGeo, nearestOffice, stateFromCsv, titleCase } from "../src/lib/pincode.ts";

const dir = join(import.meta.dirname, "..", "public", PIN_DATA_PATH);
const prefixFile = (prefix) => JSON.parse(readFileSync(join(dir, "p", `${prefix}.json`), "utf8"));
const places = (pin) => decodePlaces(prefixFile(pin.slice(0, 3))[pin]);
const toBuffer = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const geo = decodeGeo(toBuffer(gunzipSync(readFileSync(join(dir, "geo.bin.gz")))));

test("names from the CSV are tidied", () => {
  assert.equal(titleCase("KUMURAM BHEEM ASIFABAD"), "Kumuram Bheem Asifabad");
  assert.equal(titleCase("JAMMU AND KASHMIR"), "Jammu and Kashmir");
  assert.equal(titleCase("Y.S.R."), "Y.S.R.");
  assert.equal(titleCase("24 PARAGANAS  NORTH"), "24 Paraganas North");
  assert.equal(cleanOfficeName("Kothimir B.O"), "Kothimir");
  assert.equal(cleanOfficeName("Gangtok HO"), "Gangtok");
  assert.equal(cleanOfficeName("Connaught Place S.O"), "Connaught Place");
});

test("CSV states map onto the checkout's list", () => {
  assert.equal(stateFromCsv("TAMIL NADU", INDIAN_STATES), "Tamil Nadu");
  assert.equal(stateFromCsv("THE DADRA AND NAGAR HAVELI AND DAMAN AND DIU", INDIAN_STATES), "Dadra and Nagar Haveli and Daman and Diu");
  assert.equal(stateFromCsv("NA", INDIAN_STATES), null);
  assert.equal(stateFromCsv("", INDIAN_STATES), null);
  assert.equal(stateFromCsv("ATLANTIS", INDIAN_STATES), null);
});

test("districts become the city people write", () => {
  assert.equal(cityFor("South West", "Delhi"), "Delhi");
  assert.equal(cityFor("New Delhi", "Delhi"), "New Delhi");
  assert.equal(cityFor("Mumbai Suburban", "Maharashtra"), "Mumbai");
  assert.equal(cityFor("Pune", "Maharashtra"), "Pune");
});

test("the location file round-trips and finds the nearest office", () => {
  const sample = decodeGeo(toBuffer(encodeGeo([["Pune", "Maharashtra"], ["Gangtok", ""]], [411001, 737101], [
    { lat: 18.5204, lon: 73.8567, pin: 0, place: 0 },
    { lat: 27.3314, lon: 88.6138, pin: 1, place: 1 },
  ])));
  assert.deepEqual(sample.pins, [411001, 737101]);
  const pune = nearestOffice(sample, 18.53, 73.85);
  assert.equal(pune.pin, "411001");
  assert.equal(pune.city, "Pune");
  assert.ok(pune.km < 2);
  assert.equal(nearestOffice(sample, 27.33, 88.61).state, null, "a place without a state stays without one");
  assert.equal(nearestOffice(sample, 22, 80), null, "nothing within 25 km");
  assert.equal(nearestOffice(sample, 51.5, -0.12), null, "outside India");
  assert.throws(() => decodeGeo(new ArrayBuffer(16)));
});

test("a file exists for every possible PIN prefix, so lookups never hit a missing file", () => {
  for (let n = 100; n <= 999; n++) assert.ok(existsSync(join(dir, "p", `${n}.json`)), `missing ${n}.json`);
  assert.equal(readdirSync(join(dir, "p")).length, 900);
});

test("known PIN codes give the right city and state", () => {
  assert.deepEqual(places("110001").map((p) => [p.city, p.state]), [["New Delhi", "Delhi"]]);
  assert.deepEqual(places("400069").map((p) => [p.city, p.state]), [["Mumbai", "Maharashtra"]]);
  assert.deepEqual(places("743370").map((p) => [p.city, p.state]), [["24 Paraganas South", "West Bengal"]]);
  assert.deepEqual(places("999999"), [], "not a real PIN");
  assert.deepEqual(places("222101"), [], "in the CSV, but with no district or state");
});

test("a PIN shared by several districts lists each once, largest first, with example post offices", () => {
  const list = places("110025");
  assert.ok(list.length >= 2);
  assert.equal(list[0].city, "Delhi");
  assert.ok(list.every((p, i) => i === 0 || p.offices <= list[i - 1].offices));
  assert.equal(new Set(list.map((p) => `${p.city}|${p.state}`)).size, list.length);
  assert.ok(list.every((p) => p.examples.length >= 1 && p.examples.length <= 3));
  assert.deepEqual(places("110001")[0].examples, [], "a single-district PIN needs no examples");
});

test("every suggested city and state passes the checkout's own rules", () => {
  for (const file of readdirSync(join(dir, "p"))) {
    for (const [pin, stored] of Object.entries(JSON.parse(readFileSync(join(dir, "p", file), "utf8")))) {
      assert.match(pin, /^[1-9]\d{5}$/);
      assert.equal(file, `${pin.slice(0, 3)}.json`);
      for (const p of decodePlaces(stored)) {
        assert.equal(validateField("city", p.city), undefined, `${pin}: ${p.city}`);
        if (p.state) assert.equal(validateField("state", p.state), undefined, `${pin}: ${p.state}`);
      }
    }
  }
});

test("the location file matches the PIN files", () => {
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  assert.equal(geo.points.length / 4, manifest.stats.coordinates.pointsAfterMerging);
  assert.equal(geo.pins.length, manifest.files.geoPins);
  for (let i = 0; i < geo.points.length; i += 4) {
    assert.ok(geo.points[i + 2] < geo.pins.length && geo.points[i + 3] < geo.places.length);
  }
  // Every office's PIN and district must be one the PIN lookup also offers.
  const checked = new Set();
  for (let i = 0; i < geo.points.length; i += 4 * 97) {
    const pin = String(geo.pins[geo.points[i + 2]]);
    const [city, state] = geo.places[geo.points[i + 3]];
    if (checked.has(`${pin}|${city}`)) continue;
    checked.add(`${pin}|${city}`);
    assert.ok(places(pin).some((p) => p.city === city && (p.state ?? "") === state), `${pin} ${city}`);
  }
});

test("real locations find a nearby post office", () => {
  const delhi = nearestOffice(geo, 28.6315, 77.2167); // Connaught Place
  assert.match(delhi.pin, /^110/);
  assert.equal(delhi.state, "Delhi");
  const gangtok = nearestOffice(geo, 27.3314, 88.6138);
  assert.equal(gangtok.state, "Sikkim");
  assert.ok(gangtok.km < 5);
  assert.equal(nearestOffice(geo, 15, 65), null, "the Arabian Sea");
  assert.ok(distanceKm(28.6315, 77.2167, 19.076, 72.8777) > 1100);
});

test("the attribution notice names the source, licence and changes", () => {
  const notice = readFileSync(join(dir, "NOTICE.txt"), "utf8");
  for (const text of ["Department of Posts", "data.gov.in", "Government Open Data License", "Changes made by NÉVORA", "SHA-256"]) assert.ok(notice.includes(text), text);
});

test("the published version, its manifest and its year-long cache rule agree", () => {
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  assert.equal(manifest.version, PIN_DATA_PATH.split("/").at(-1));
  const headers = readFileSync(join(import.meta.dirname, "..", "public", "_headers"), "utf8");
  const rule = headers.split(/\n(?=\S)/).find((block) => block.startsWith(`${PIN_DATA_PATH}/*`));
  assert.ok(rule, `public/_headers needs a rule for ${PIN_DATA_PATH}/*`);
  assert.match(rule, /Cache-Control: public, max-age=31536000, immutable/);
});
