// Design token rules. Uses Node's test runner, with no extra dependency.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const token = (name) => {
  const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, "i"));
  assert.ok(match, `missing token ${name}`);
  return match[1].toLowerCase();
};
const luminance = (hex) => {
  const channel = (i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test("the four approved brand colours are exact", () => {
  assert.equal(token("ivory"), "#f8f5ef");
  assert.equal(token("espresso"), "#34251f");
  assert.equal(token("gold"), "#c5a46d");
  assert.equal(token("taupe"), "#b9a99a");
});

test("no teal or teal-like colour is defined", () => {
  for (const [, hex] of css.matchAll(/--color-[a-z-]+:\s*(#[0-9a-f]{6})/gi)) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(!(g > r + 20 && b > r + 20), `${hex} looks teal`);
  }
});

for (const [text, background, minimum] of [
  ["espresso", "ivory", 4.5],
  ["espresso", "cream", 4.5],
  ["ivory", "espresso", 4.5],
  ["ink-soft", "ivory", 4.5],
  ["ink-soft", "cream", 4.5],
  ["gold-deep", "ivory", 4.5],
  ["gold-deep", "cream", 4.5],
  ["ivory", "espresso-deep", 4.5],
  ["control", "ivory", 3],
]) {
  test(`${text} on ${background} reaches ${minimum}:1`, () => {
    const ratio = contrast(token(text), token(background));
    assert.ok(ratio >= minimum, `${text} on ${background} is ${ratio.toFixed(2)}:1`);
  });
}

test("gold and taupe stay decorative: too low for text on ivory", () => {
  assert.ok(contrast(token("gold"), token("ivory")) < 4.5);
  assert.ok(contrast(token("taupe"), token("ivory")) < 4.5);
});

test("gold and taupe are never used as text colours in components", async () => {
  const { readdirSync, statSync } = await import("node:fs");
  const walk = (dir) => readdirSync(dir).flatMap((name) => {
    const path = new URL(`${name}${statSync(new URL(name, dir)).isDirectory() ? "/" : ""}`, dir);
    return statSync(path).isDirectory() ? walk(path) : path.pathname.match(/\.tsx?$/) ? [path] : [];
  });
  for (const file of walk(new URL("../src/", import.meta.url))) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /\btext-(gold|taupe)\b(?!-deep)/, file.pathname);
  }
});
