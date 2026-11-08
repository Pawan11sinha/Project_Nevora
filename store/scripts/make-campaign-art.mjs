// Generates the sample campaign artwork for the homepage hero prototype: original vector art, so the prototype uses no
// real or third-party photos. Each image is labelled "Sample campaign artwork". Real campaign photography, uploaded
// through the banner manager (M4b), replaces these.
//   node scripts/make-campaign-art.mjs
// Desktop images are 2400 × 1000 with the left side kept clear for the heading; mobile images are 1080 × 1350 with
// the top kept clear. The text itself is real HTML, never part of the image.
import { mkdirSync, writeFileSync } from "node:fs";

const G = "#a8863f", D = "#7b5e2b", L = "#d8bd86";
const S = (d, w = 5, c = "url(#g)") => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const C = (x, y, r, f = "url(#g)") => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}"/>`;
const O = (x, y, r, w = 5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="url(#g)" stroke-width="${w}"/>`;
const pearl = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#p)" stroke="#d9cfc0" stroke-width="1"/>`;
const dome = (y) => `<path d="M-46 ${y}a46 46 0 0 1 92 0z" fill="url(#g)"/>${Array.from({ length: 9 }, (_, i) => C(-40 + i * 10, y + 9, 3.5)).join("")}`;

// Single pieces, drawn around (0, 0) at roughly 200 units tall.
const piece = {
  jhumka: `${C(0, -90, 8)}${S("M0 -84v50", 4)}${C(0, -40, 7)}<g transform="translate(0 -218)">${dome(215)}</g>${Array.from({ length: 9 }, (_, i) => pearl(-40 + i * 10, 16, 3.2)).join("")}`,
  chandbali: `${S("M0 -100v26")}${S("M-52 -54a52 62 0 0 0 104 0", 9)}${S("M-52 -54q52-34 104 0", 4)}${Array.from({ length: 7 }, (_, i) => { const a = Math.PI * (i + 1) / 8; return pearl(52 * -Math.cos(a), -54 + 72 * Math.sin(a), 6); }).join("")}`,
  hoop: `${O(0, 0, 58, 8)}${S("M0 -58v-14")}`,
  stud: `${pearl(0, 0, 30)}${O(0, 0, 34, 3)}`,
  ring: `${O(0, 30, 62, 9)}<path d="M0 -75l25 28-25 28-25-28z" fill="url(#g)"/>${C(0, -47, 7, L)}`,
  layered: `${S("M-130 -110q130 150 260 0", 3)}${S("M-140 -105q140 215 280 0", 3)}${C(0, -35, 8)}${pearl(0, 2, 11)}${S("M-150 -100q150 290 300 0", 3)}${C(0, 47, 6)}`,
  claw: `<path d="M-110-50q110-60 220 0l-16 22q-94-44-188 0z" fill="url(#t)"/>${Array.from({ length: 7 }, (_, i) => { const x = -84 + i * 28; return `<path d="M${x - 9}-28q9 95 18 120q-22-6-25-40z" fill="url(#t)"/>`; }).join("")}`,
};
const pair = (name, gap = 120) => `<g transform="translate(${-gap / 2} 0)">${piece[name]}</g><g transform="translate(${gap / 2} 0)">${piece[name]}</g>`;

// Scenery.
const shadow = (x, y, w) => `<ellipse cx="${x}" cy="${y}" rx="${w / 2}" ry="${w / 14}" fill="#5a4636" opacity=".16" filter="url(#blur)"/>`;
const plinth = (x, y, w, h) => `${shadow(x + w / 2, y + h - 4, w * 1.05)}<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="url(#stone)"/><rect x="${x}" y="${y}" width="${w}" height="10" rx="5" fill="#fbf7f0" opacity=".7"/>${Array.from({ length: 14 }, (_, i) => `<circle cx="${x + ((i * 97) % w)}" cy="${y + 24 + ((i * 53) % (h - 30))}" r="${1.5 + (i % 3)}" fill="#b9a99a" opacity=".35"/>`).join("")}`;
const arch = (x, y, w, h, fill) => `<path d="M${x} ${y + h}V${y + w / 2}a${w / 2} ${w / 2} 0 0 1 ${w} 0V${y + h}z" fill="${fill}"/><path d="M${x + 14} ${y + h}V${y + w / 2}a${w / 2 - 14} ${w / 2 - 14} 0 0 1 ${w - 28} 0V${y + h}" fill="none" stroke="url(#g)" stroke-width="3" opacity=".55"/>`;
const stand = (x, y, w, h) => `${S(`M${x} ${y + h}V${y + w / 2}a${w / 2} ${w / 2} 0 0 1 ${w} 0V${y + h}`, 7)}<rect x="${x - 40}" y="${y + h}" width="${w + 80}" height="34" rx="8" fill="url(#wood)"/>`;
const rays = (w, h) => Array.from({ length: 4 }, (_, i) => `<polygon points="${w * (0.55 + i * 0.1)},0 ${w * (0.62 + i * 0.1)},0 ${w * (0.3 + i * 0.12)},${h} ${w * (0.22 + i * 0.12)},${h}" fill="#fffaf2" opacity=".16" filter="url(#soft)"/>`).join("");
const sprig = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})" opacity=".85">${S("M0 0q-20-120 30-220", 2.5, "#b7a48f")}${S("M8-90q40-30 60-90", 2, "#b7a48f")}${S("M-6-40q-50-40-60-110", 2, "#b7a48f")}${[[30, -220], [68, -180], [-66, -150], [14, -160], [48, -120], [-40, -100], [36, -205], [-58, -132]].map(([a, b], i) => `<circle cx="${a}" cy="${b}" r="${7 + (i % 3) * 2}" fill="#fffaf3" stroke="#e4d8c8" stroke-width="1.5"/>`).join("")}</g>`;
const bokeh = (w, h, n, color) => Array.from({ length: n }, (_, i) => `<circle cx="${(i * 389) % w}" cy="${(i * 211) % (h * 0.7)}" r="${18 + (i % 4) * 12}" fill="${color}" opacity="${0.12 + (i % 3) * 0.06}" filter="url(#soft)"/>`).join("");
const petals = (x, y, n) => Array.from({ length: n }, (_, i) => `<ellipse cx="${x + ((i * 83) % 420) - 210}" cy="${y + ((i * 37) % 60)}" rx="11" ry="6" transform="rotate(${i * 47} ${x + ((i * 83) % 420) - 210} ${y + ((i * 37) % 60)})" fill="${i % 2 ? "#d9a441" : "#e8b956"}" opacity=".8"/>`).join("");
const place = (x, y, s, inner) => `<g transform="translate(${x} ${y}) scale(${s})">${inner}</g>`;

const defs = (bg, stone) => `<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient>
<linearGradient id="stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${stone[0]}"/><stop offset="1" stop-color="${stone[1]}"/></linearGradient>
<linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9b98c"/><stop offset="1" stop-color="#b8935f"/></linearGradient>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${L}"/><stop offset=".55" stop-color="${G}"/><stop offset="1" stop-color="${D}"/></linearGradient>
<linearGradient id="t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfc0b1"/><stop offset="1" stop-color="#a48e7e"/></linearGradient>
<radialGradient id="p" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fffdf8"/><stop offset="1" stop-color="#e3d9c9"/></radialGradient>
<filter id="blur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="10"/></filter>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>
</defs>`;

const label = (x, y) => `<text x="${x}" y="${y}" text-anchor="end" font-family="Georgia, serif" font-size="22" letter-spacing="5" fill="#7d6a5d" opacity=".9">SAMPLE CAMPAIGN ARTWORK</text>`;

// Each campaign: colours and a scene drawn for a stage box {x, y, w, h}; the stage sits right (desktop) or low (mobile).
const campaigns = {
  "new-arrivals": {
    bg: ["#f7f1e7", "#e7d9c4"], stone: ["#f1e8da", "#d8c8b1"], archFill: "#efe3d1",
    scene: ({ x, y, w, h }) => `${arch(x + w * 0.2, y, w * 0.5, h * 0.86, "#efe3d1")}${place(x + w * 0.45, y + h * 0.38, h / 420, piece.layered)}${plinth(x + w * 0.02, y + h * 0.7, w * 0.32, h * 0.3)}${plinth(x + w * 0.58, y + h * 0.78, w * 0.36, h * 0.22)}${place(x + w * 0.18, y + h * 0.64, h / 1150, pair("stud", 130))}${place(x + w * 0.76, y + h * 0.66, h / 900, piece.hoop)}${sprig(x + w * 0.96, y + h * 0.8, h / 700)}`,
  },
  "festive-edit": {
    bg: ["#f3e6cf", "#d9bd92"], stone: ["#efe0c6", "#cdb08a"], archFill: "#ead6b4",
    extra: (wd, ht) => bokeh(wd, ht, 14, "#f6d38a"),
    scene: ({ x, y, w, h }) => `${arch(x + w * 0.08, y, w * 0.46, h * 0.88, "#ead6b4")}${stand(x + w * 0.16, y + h * 0.16, w * 0.3, h * 0.5)}${place(x + w * 0.31, y + h * 0.36, h / 640, pair("chandbali", 150))}${plinth(x + w * 0.56, y + h * 0.66, w * 0.38, h * 0.34)}${place(x + w * 0.75, y + h * 0.56, h / 760, pair("jhumka", 140))}${petals(x + w * 0.5, y + h * 0.93, 12)}`,
  },
  "everyday-edit": {
    bg: ["#f2eee7", "#dcd3c6"], stone: ["#ece6dc", "#cfc4b5"], archFill: "#e7e0d4",
    scene: ({ x, y, w, h }) => `${arch(x + w * 0.42, y, w * 0.48, h * 0.86, "#e7e0d4")}${place(x + w * 0.66, y + h * 0.36, h / 560, pair("hoop", 170))}${plinth(x + w * 0.04, y + h * 0.62, w * 0.4, h * 0.38)}${place(x + w * 0.24, y + h * 0.5, h / 820, piece.claw)}${plinth(x + w * 0.5, y + h * 0.8, w * 0.32, h * 0.2)}${place(x + w * 0.66, y + h * 0.7, h / 1000, piece.ring)}${sprig(x + w * 0.02, y + h * 0.66, h / 760)}`,
  },
};

const out = new URL("../public/sample/campaign/", import.meta.url);
mkdirSync(out, { recursive: true });
for (const [name, c] of Object.entries(campaigns)) {
  for (const [kind, W, H, stage, clear, lab] of [
    // Desktop: stage on the right 58%; a soft ivory wash keeps the left 42% clear for text.
    ["desktop", 2400, 1000, { x: 1020, y: 90, w: 1300, h: 910 }, `<linearGradient id="wash" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#faf6ef" stop-opacity=".92"/><stop offset=".38" stop-color="#faf6ef" stop-opacity=".55"/><stop offset=".55" stop-color="#faf6ef" stop-opacity="0"/></linearGradient>`, [2350, 970]],
    // Mobile: stage in the lower 55%; the top stays clear for text.
    ["mobile", 1080, 1350, { x: 60, y: 610, w: 960, h: 740 }, `<linearGradient id="wash" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#faf6ef" stop-opacity=".92"/><stop offset=".4" stop-color="#faf6ef" stop-opacity=".5"/><stop offset=".55" stop-color="#faf6ef" stop-opacity="0"/></linearGradient>`, [1040, 1325]],
  ]) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-hidden="true">${defs(c.bg, c.stone).replace("</defs>", `${clear}</defs>`)}<rect width="${W}" height="${H}" fill="url(#bg)"/>${c.extra ? c.extra(W, H) : ""}${rays(W, H)}${c.scene(stage)}<rect width="${W}" height="${H}" fill="url(#wash)"/>${label(lab[0], lab[1])}</svg>`;
    writeFileSync(new URL(`${name}-${kind}.svg`, out), svg);
  }
}
console.log(`${Object.keys(campaigns).length * 2} sample campaign images written to public/sample/campaign/`);
