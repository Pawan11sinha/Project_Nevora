// Checkout detail rules: required fields, Indian mobile numbers, PIN codes, states and optional fields.
import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPTY_DETAILS, INDIAN_STATES, normalisePhone, validateDetails, validateField } from "../src/lib/checkout.ts";

const valid = {
  name: "Ananya Sharma",
  phone: "98765 43210",
  email: "",
  address: "Flat 12B, 4th Floor, Lotus Apartments, MG Road",
  landmark: "",
  city: "New Delhi",
  state: "Delhi",
  pincode: "110001",
};

test("a complete set of details passes", () => {
  assert.deepEqual(validateDetails(valid), {});
});

test("every required field is reported when the form is empty, but optional ones aren't", () => {
  const errors = validateDetails(EMPTY_DETAILS);
  assert.deepEqual(Object.keys(errors).sort(), ["address", "city", "name", "phone", "pincode", "state"]);
});

test("common ways of typing an Indian mobile number are accepted", () => {
  for (const ok of ["9876543210", "98765 43210", "+91 98765 43210", "+91-98765-43210", "919876543210", "09876543210", "(987) 654-3210"]) {
    assert.equal(normalisePhone(ok), "9876543210", ok);
  }
});

test("numbers that aren't Indian mobiles are refused", () => {
  for (const bad of ["", "12345", "5876543210", "98765432101", "+1 9876543210", "+9876543210", "9876a43210", "0000000000", "98765 4321"]) {
    assert.equal(normalisePhone(bad), null, bad);
    assert.ok(validateField("phone", bad), bad);
  }
});

test("PIN codes must be 6 digits and can't start with 0", () => {
  assert.equal(validateField("pincode", "110001"), undefined);
  assert.equal(validateField("pincode", " 560034 "), undefined);
  for (const bad of ["", "011000", "11000", "1100011", "11000a", "110 001"]) assert.ok(validateField("pincode", bad), bad);
});

test("email is optional, but must look valid when given", () => {
  assert.equal(validateField("email", ""), undefined);
  assert.equal(validateField("email", "ananya@example.com"), undefined);
  for (const bad of ["ananya", "ananya@", "ananya@example", "an anya@example.com", `${"a".repeat(250)}@x.com`]) assert.ok(validateField("email", bad), bad);
});

test("states must come from the official list of 36", () => {
  assert.equal(INDIAN_STATES.length, 36);
  assert.equal(validateField("state", "Maharashtra"), undefined);
  assert.ok(validateField("state", "Bombay"));
  assert.ok(validateField("state", ""));
});

test("names, cities and addresses have sensible limits", () => {
  assert.equal(validateField("name", "Rohan D'Souza"), undefined);
  assert.equal(validateField("name", "Priya K."), undefined);
  assert.ok(validateField("name", "A"));
  assert.ok(validateField("name", "Ananya2"));
  assert.ok(validateField("name", "x".repeat(81)));
  assert.ok(validateField("address", "12"));
  assert.ok(validateField("address", "x".repeat(201)));
  assert.equal(validateField("city", "Thiruvananthapuram"), undefined);
  // District names from the PIN data can contain digits, but a place needs at least one letter.
  assert.equal(validateField("city", "24 Paraganas North"), undefined);
  assert.ok(validateField("city", "110001"));
  assert.ok(validateField("city", "Delhi!"));
  assert.ok(validateField("landmark", "x".repeat(101)));
  assert.equal(validateField("landmark", ""), undefined);
});

test("surrounding spaces don't cause errors", () => {
  assert.deepEqual(validateDetails({ ...valid, name: `  ${valid.name}  `, city: ` ${valid.city} ` }), {});
});
