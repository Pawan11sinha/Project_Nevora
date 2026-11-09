// Generates the extra sample views used by the product page gallery: an angled side view, a styled view on fabric and
// a packaging view with the piece beside its box. Only for products that declare them (extraViews in
// src/lib/sample-catalogue.ts), so every product shows only the images it really has. Each carries a "SAMPLE" label.
// Sample only: real product photography, ordered in admin (product_images.sort_order), replaces it.
//   node scripts/make-sample-gallery-art.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { PRODUCTS } from "../src/lib/sample-catalogue.ts";
import { art, backgrounds, defs, toneOf } from "./lib/sample-art.mjs";

const label = (text, fill = "#7d6a5d") => `<text x="250" y="596" text-anchor="middle" font-family="Georgia, serif" font-size="15" letter-spacing="3" fill="${fill}">${text}</text>`;
const frame = (a, b, extra, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 625" width="500" height="625" role="img" aria-hidden="true">${defs(a, b, extra)}${body}</svg>`;
const shadow = `<filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#4a3427" flood-opacity=".2"/></filter>`;

const views = {
  // The same piece turned away and seen from the side: narrower, tilted and lit from the left.
  angle: (kind, shape) => {
    const [a, b] = backgrounds[toneOf(kind)];
    return frame(b, a, shadow, `<rect width="500" height="625" fill="url(#bg)"/><g filter="url(#shadow)" transform="translate(250 300) rotate(-12) scale(0.72 0.95) translate(-250 -300)"><g transform="translate(0 50)">${shape}</g></g>${label("SAMPLE · SIDE VIEW")}`);
  },
  // On draped cream fabric with a small ivory dish, as a styled shot would be.
  styled: (kind, shape) => {
    const folds = [80, 210, 340, 470].map((y, i) => `<path d="M-20 ${y}q140 ${i % 2 ? -60 : 60} 270 0t270 0" fill="none" stroke="#ffffff" stroke-opacity=".35" stroke-width="26"/>`).join("");
    return frame("#efe4d3", "#dccab1", shadow, `<rect width="500" height="625" fill="url(#bg)"/>${folds}<ellipse cx="250" cy="330" rx="170" ry="120" fill="#f8f5ef" stroke="#e2d6c4" stroke-width="3" filter="url(#shadow)"/><g transform="translate(250 330) scale(0.62) translate(-250 -300)"><g transform="translate(0 50)">${shape}</g></g>${label("SAMPLE · STYLED")}`);
  },
  // The piece beside a NÉVORA box, for packaging and scale.
  packaging: (kind, shape) => {
    const box = `<g filter="url(#shadow)"><rect x="200" y="250" width="230" height="170" rx="6" fill="#34251f"/><rect x="192" y="232" width="246" height="46" rx="6" fill="#4a372e"/><text x="315" y="263" text-anchor="middle" font-family="Georgia, serif" font-size="20" letter-spacing="5" fill="#d9c49c">NÉVORA</text></g>`;
    return frame("#f3ecdf", "#e6dac7", shadow, `<rect width="500" height="625" fill="url(#bg)"/>${box}<g transform="translate(130 400) scale(0.42) translate(-250 -300)"><g transform="translate(0 50)">${shape}</g></g>${label("SAMPLE · PACKAGING")}`);
  },
};

let written = 0;
for (const product of PRODUCTS) {
  for (const view of product.extraViews ?? []) {
    const out = new URL(`../public/sample/${view}/`, import.meta.url);
    mkdirSync(out, { recursive: true });
    writeFileSync(new URL(`${product.art}.svg`, out), views[view](product.art, art[product.art]));
    written++;
  }
}
console.log(`${written} sample gallery images written to public/sample/<view>/`);
