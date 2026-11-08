// Generates placeholder product art, so the prototype uses no real or third-party photos.
// Each file carries a "Sample" label. Real photography replaces these before launch.
import { writeFileSync } from "node:fs";
import { art, backgrounds, defs, toneOf } from "./lib/sample-art.mjs";

for (const [kind, shape] of Object.entries(art)) {
  const [a, b] = backgrounds[toneOf(kind)];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 625" width="500" height="625" role="img" aria-hidden="true">${defs(a, b)}<rect width="500" height="625" fill="url(#bg)"/><g transform="translate(0 50)">${shape}</g><text x="250" y="596" text-anchor="middle" font-family="Georgia, serif" font-size="15" letter-spacing="3" fill="#7d6a5d">SAMPLE</text></svg>`;
  writeFileSync(new URL(`../public/sample/${kind}.svg`, import.meta.url), svg);
}
console.log(`${Object.keys(art).length} sample images written`);
