// Shared drawing for the sample product art (scripts/make-sample-art.mjs and make-sample-detail-art.mjs), so the main
// and detail views of each piece are drawn from the same shapes. Sample only: real photography replaces all of it.
export const G = "#a8863f", D = "#7b5e2b", L = "#d8bd86";
const S = (d, w = 5, c = "url(#g)") => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const C = (x, y, r, f = "url(#g)") => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}"/>`;
const O = (x, y, r, w = 5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="url(#g)" stroke-width="${w}"/>`;
const pearl = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#p)" stroke="#d9cfc0" stroke-width="1"/>`;
const pair = (one) => `<g transform="translate(-92 0)">${one}</g><g transform="translate(92 0)">${one}</g>`;
const dome = (y) => `<path d="M-46 ${y}a46 46 0 0 1 92 0z" fill="url(#g)"/>${Array.from({ length: 9 }, (_, i) => C(-40 + i * 10, y + 9, 3.5)).join("")}`;

export const art = {
  jhumka: pair(`<g transform="translate(250 0)">${C(0, 158, 8)}${S("M0 164v50", 4)}${C(0, 208, 7)}<g transform="translate(0 30)">${dome(215)}</g></g>`),
  chandbali: pair(`<g transform="translate(250 0)">${S("M0 150v26")}${S("M-52 196a52 62 0 0 0 104 0", 9)}${S("M-52 196q52-34 104 0", 4)}${Array.from({ length: 7 }, (_, i) => { const a = Math.PI * (i + 1) / 8; return pearl(52 * -Math.cos(a), 196 + 72 * Math.sin(a), 6); }).join("")}</g>`),
  hoop: pair(`<g transform="translate(250 0)">${O(0, 250, 58, 8)}${S("M0 192v-14")}</g>`),
  stud: pair(`<g transform="translate(250 0)">${pearl(0, 250, 30)}${O(0, 250, 34, 3)}</g>`),
  necklace: `${S("M125 150q125 200 250 0", 3.5)}${C(250, 250, 6)}${S("M250 255v14", 3)}<path d="M250 268l15 26-15 26-15-26z" fill="url(#g)"/>`,
  layered: `${S("M120 140q130 150 260 0", 3)}${S("M110 145q140 215 280 0", 3)}${C(250, 215, 8)}${pearl(250, 252, 11)}${S("M100 150q150 290 300 0", 3)}${C(250, 297, 6)}`,
  ring: `${O(250, 285, 62, 9)}<path d="M250 180l25 28-25 28-25-28z" fill="url(#g)"/>${C(250, 208, 7, L)}`,
  bracelet: `<ellipse cx="250" cy="260" rx="125" ry="72" fill="none" stroke="url(#g)" stroke-width="5" stroke-dasharray="3 10" stroke-linecap="round"/>${C(250, 332, 11)}${C(185, 322, 7)}${C(315, 322, 7)}`,
  claw: `<g transform="translate(250 255)"><path d="M-110-50q110-60 220 0l-16 22q-94-44-188 0z" fill="url(#t)"/>${Array.from({ length: 7 }, (_, i) => { const x = -84 + i * 28; return `<path d="M${x - 9}-28q9 95 18 120q-22-6-25-40z" fill="url(#t)"/>`; }).join("")}</g>`,
  clip: `<g transform="translate(250 255) rotate(-10)"><rect x="-120" y="-16" width="240" height="32" rx="16" fill="url(#t)"/>${[-72, -36, 0, 36, 72].map((x) => pearl(x, 0, 10)).join("")}</g>`,
  scrunchie: `<g transform="translate(250 255)">${Array.from({ length: 16 }, (_, i) => { const a = i * Math.PI / 8; return `<ellipse cx="${82 * Math.cos(a)}" cy="${82 * Math.sin(a)}" rx="42" ry="27" transform="rotate(${i * 22.5} ${82 * Math.cos(a)} ${82 * Math.sin(a)})" fill="url(#t)" stroke="#a48e7e" stroke-width="1.4"/>`; }).join("")}</g>`,
  bow: `<g transform="translate(250 255)"><path d="M0 0q-85-82-140-46q-20 46 0 92q55 36 140-46z" fill="url(#t)"/><path d="M0 0q85-82 140-46q20 46 0 92q-55 36-140-46z" fill="url(#t)"/><path d="M-12 8q-34 80-58 128l40-14 26 26q6-80 4-140z" fill="url(#t)"/><path d="M12 8q34 80 58 128l-40-14-26 26q-6-80-4-140z" fill="url(#t)"/><rect x="-20" y="-24" width="40" height="48" rx="10" fill="#8f7868"/></g>`,
  headband: `${S("M125 310a125 145 0 0 1 250 0", 22, "url(#t)")}`,
};
export const backgrounds = { warm: ["#f3ecdf", "#e6dac7"], stone: ["#ece6dc", "#d9cfc1"], blush: ["#f4ebe2", "#e9d8cb"] };
export const tones = { warm: "jhumka chandbali hoop stud necklace layered ring bracelet", stone: "claw clip headband", blush: "scrunchie bow" };


export const toneOf = (kind) => Object.entries(tones).find(([, kinds]) => kinds.split(" ").includes(kind))[0];

/** The gradients every sample image uses: background (a to b), gold, taupe and pearl. */
export const defs = (a, b, extra = "") => `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${L}"/><stop offset=".55" stop-color="${G}"/><stop offset="1" stop-color="${D}"/></linearGradient><linearGradient id="t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfc0b1"/><stop offset="1" stop-color="#a48e7e"/></linearGradient><radialGradient id="p" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fffdf8"/><stop offset="1" stop-color="#e3d9c9"/></radialGradient>${extra}</defs>`;
