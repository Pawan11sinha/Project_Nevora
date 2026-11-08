// Generates the sample "detail" view of each product: a close-up of the same piece on a deeper, softly textured
// backdrop. It's the second image shown when a desktop visitor hovers a product card (roadmap M4c). Sample only:
// real product photography, ordered in admin (product_images.sort_order), replaces it.
//   node scripts/make-sample-detail-art.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { art, defs, toneOf } from "./lib/sample-art.mjs";

// Deeper versions of each tone, so the detail view reads as a different shot of the same piece.
const deeper = { warm: ["#e8d9c1", "#cdb894"], stone: ["#e0d7c9", "#c3b6a4"], blush: ["#ecdacb", "#d3b7a2"] };
// Where each kind of piece sits in the 500 × 625 frame (after the main image's 50px shift), to zoom in on it.
const focus = { necklace: 300, layered: 300, bracelet: 310, headband: 270 };
// Pairs of earrings are wider, so they're zoomed in less to keep both in frame.
const zoom = { jhumka: 1.4, chandbali: 1.4, hoop: 1.4, stud: 1.45 };

const out = new URL("../public/sample/detail/", import.meta.url);
mkdirSync(out, { recursive: true });
for (const [kind, shape] of Object.entries(art)) {
  const [a, b] = deeper[toneOf(kind)];
  const cy = focus[kind] ?? 305;
  const texture = `<pattern id="weave" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0v14" stroke="#ffffff" stroke-opacity=".18" stroke-width="1.2"/></pattern><radialGradient id="light" cx=".35" cy=".25" r=".9"><stop offset="0" stop-color="#fffaf2" stop-opacity=".55"/><stop offset="1" stop-color="#fffaf2" stop-opacity="0"/></radialGradient><filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="9" flood-color="#4a3427" flood-opacity=".22"/></filter>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 625" width="500" height="625" role="img" aria-hidden="true">${defs(a, b, texture)}<rect width="500" height="625" fill="url(#bg)"/><rect width="500" height="625" fill="url(#weave)"/><rect width="500" height="625" fill="url(#light)"/><g filter="url(#shadow)" transform="translate(250 300) scale(${zoom[kind] ?? 1.75}) translate(-250 ${-cy})"><g transform="translate(0 50)">${shape}</g></g><text x="250" y="596" text-anchor="middle" font-family="Georgia, serif" font-size="15" letter-spacing="3" fill="#6a574c">SAMPLE · DETAIL</text></svg>`;
  writeFileSync(new URL(`${kind}.svg`, out), svg);
}
console.log(`${Object.keys(art).length} sample detail images written to public/sample/detail/`);
