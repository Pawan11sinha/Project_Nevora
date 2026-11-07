// Deployment checks: headers, file types, caching, static files skipping the Worker, every PIN file reachable,
// and nothing private exposed. Run against the local OpenNext preview or a deployed Worker:
//   BASE_URL=http://localhost:8787 node scripts/check-deploy.mjs
//
// How it tells static files from Worker responses: Content-Security-Policy is set only in next.config.ts, which runs
// in the Worker. public/_headers, used for static files, doesn't set it. So a static file that carries a CSP went
// through the Worker. On a deployed Worker, confirm with `wrangler tail` that these requests log no invocations.
import { isStaging, stagingFetch } from "./lib/staging-auth.mjs";

const base = (process.env.BASE_URL ?? "http://localhost:8787").replace(/\/$/, "");
let failed = 0;
const check = (name, pass, detail = "") => { console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!pass) failed++; };
const info = (name, detail) => console.log(`INFO  ${name}  (${detail})`);
const get = (path, init) => stagingFetch(base + path, { redirect: "manual", ...init });
const header = (r, name) => r.headers.get(name) ?? "";
const YEAR = "public, max-age=31536000, immutable";
const PERMISSIONS = "camera=(), microphone=(), geolocation=(self)";
const viaWorker = (r) => r.headers.has("content-security-policy");

// ---- The staging password gate ----
// Runs first, without the password. Every path the Worker serves must answer 401 and ask for the password, before
// Next.js runs. If any of them is served, staging is public: set workers_dev to false and redeploy before anything else.
// Static files are served before the Worker, so they stay reachable by design; this lists exactly which ones are.
//
// GATE_HOST tests the gate on the local preview: requests go to BASE_URL with that Host header, so the Worker sees a
// deployed hostname instead of localhost. Locally the preview needs STAGING_PASSWORD in .dev.vars for this.
const gateHost = process.env.GATE_HOST;
if (isStaging(base) || gateHost) {
  // fetch() drops a custom Host header, so the local emulation uses node:http, which keeps it.
  const bare = async (path, headers = {}) => {
    if (!gateHost) return fetch(base + path, { redirect: "manual", headers });
    const { request } = await import("node:http");
    return new Promise((resolve, reject) => {
      const req = request(new URL(path, base), { headers: { ...headers, Host: gateHost } }, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(new Response(res.statusCode === 304 || res.statusCode === 204 ? null : Buffer.concat(chunks), { status: res.statusCode, headers: Object.entries(res.headers).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : [[k, String(v)]])) })));
      });
      req.on("error", reject);
      req.end();
    });
  };
  const open = [];
  for (const path of ["/", "/checkout", "/bag", "/products/sample-dome-jhumka", "/categories/jewellery", "/no-such-page", "/products/%FF", "/api/x", "/admin"]) {
    const r = await bare(path);
    const body = await r.text();
    const gated = r.status === 401 && /^Basic realm="NEVORA staging"/.test(header(r, "www-authenticate")) && !viaWorker(r) && !/<html/i.test(body) && header(r, "cache-control") === "no-store";
    if (!gated) open.push(`${path}: ${r.status}`);
  }
  const wrong = await bare("/", { Authorization: `Basic ${Buffer.from("nevora:not-the-password-0000000").toString("base64")}` });
  await wrong.arrayBuffer();
  if (wrong.status !== 401) open.push(`wrong password: ${wrong.status}`);
  check("without the password, every page the Worker serves asks for it (401)", open.length === 0, open.join(" | ") || "9 paths and a wrong password");
  if (open.length) {
    console.log("\nSTOP: staging pages are reachable without the password. Set workers_dev to false in wrangler.jsonc and redeploy before anything else.");
    process.exit(1);
  }
  // Static files from this same build, reachable without the password by design. Listed so the exposure is on record.
  const { readdirSync } = await import("node:fs");
  const assets = new URL("../.open-next/assets/", import.meta.url);
  const firstFile = (dir, test = () => true) => { try { return readdirSync(new URL(dir, assets), { recursive: true }).find((f) => /\.[a-z]+$/i.test(f) && test(f)); } catch { return undefined; } };
  const chunk = firstFile("_next/static/", (f) => f.endsWith(".js"));
  const cached = firstFile("cdn-cgi/_next_cache/", (f) => f.endsWith("checkout.cache"))?.split(/[\\/]/).map(encodeURIComponent).join("/");
  const statics = ["/data/pin/v1/p/110.json", "/data/pin/v1/geo.bin.gz", "/sample/jhumka.svg", "/favicon.ico", "/BUILD_ID", chunk && `/_next/static/${chunk}`, cached && `/cdn-cgi/_next_cache/${cached}`].filter(Boolean);
  for (const path of statics) {
    const r = await bare(path);
    await r.arrayBuffer();
    info(`without the password: ${path.length > 60 ? `${path.slice(0, 57)}...` : path}`, r.status === 200 ? "reachable (static file, by design)" : `${r.status}`);
  }
}

// ---- Pages generated by the Worker ----
for (const path of ["/", "/checkout", "/products/sample-dome-jhumka"]) {
  const r = await get(path);
  await r.arrayBuffer();
  check(`${path} returns HTML`, r.status === 200 && header(r, "content-type").startsWith("text/html"), `${r.status} ${header(r, "content-type")}`);
  check(`${path} allows location on NÉVORA's own pages only`, header(r, "permissions-policy") === PERMISSIONS, header(r, "permissions-policy"));
  check(`${path} has the security headers`,
    header(r, "content-security-policy").includes("default-src 'self'") && header(r, "content-security-policy").includes("frame-ancestors 'none'") && !header(r, "content-security-policy").includes("unsafe-eval")
      && header(r, "x-frame-options") === "DENY" && header(r, "x-content-type-options") === "nosniff"
      && header(r, "referrer-policy") === "strict-origin-when-cross-origin" && header(r, "strict-transport-security") === "max-age=86400"
      && header(r, "x-robots-tag").includes("noindex") && !r.headers.has("x-powered-by"));
}

// ---- Private routes are never cached ----
// The bag and checkout, page loads during in-app navigation (RSC), and the planned account, order, admin and API paths.
{
  const requests = [
    ["/checkout", {}], ["/bag", {}], ["/checkout", { headers: { RSC: "1" } }], ["/bag", { headers: { RSC: "1" } }],
    ["/checkout", { method: "HEAD" }], ["/checkout/anything", {}], ["/account", {}], ["/order/NEV-1", {}], ["/admin", {}], ["/admin/login", {}], ["/api/x", {}],
  ];
  const wrong = [];
  for (const [path, init] of requests) {
    const r = await get(path, init);
    await r.arrayBuffer();
    // Existing pages must send exactly "no-store". Paths that don't exist yet render the 404 page, which Next.js marks
    // "private, no-cache, no-store, …": also never cached. Anything public or with s-maxage fails.
    const value = header(r, "cache-control");
    const exists = ["/checkout", "/bag"].includes(path);
    const ok = exists ? value === "no-store" : /\bno-store\b/.test(value) && !/public|s-maxage/.test(value);
    if (!ok) wrong.push(`${init.method ?? "GET"}${init.headers ? " RSC" : ""} ${path}: ${header(r, "cache-control") || "none"}`);
  }
  check("bag, checkout and planned private routes are never cached (no-store)", wrong.length === 0, wrong.slice(0, 3).join(" | ") || `${requests.length} requests`);
  const home = await get("/");
  await home.arrayBuffer();
  check("public pages are still cacheable", /s-maxage=\d+/.test(header(home, "cache-control")), header(home, "cache-control"));
}

// ---- Static files ----
const html = await (await get("/checkout")).text();
const chunk = html.match(/\/_next\/static\/[^"']+\.js/)?.[0];
check("the checkout page references a build file", Boolean(chunk), chunk);
if (chunk) {
  const r = await get(chunk);
  await r.arrayBuffer();
  check("build files are cached for a year", r.status === 200 && header(r, "cache-control") === YEAR, header(r, "cache-control"));
  check("build files are JavaScript", /javascript/.test(header(r, "content-type")), header(r, "content-type"));
  check("build files skip the Worker", !viaWorker(r));
}

const pinFile = async (path) => { const r = await get(path); return { r, body: Buffer.from(await r.arrayBuffer()) }; };
{
  const { r, body } = await pinFile("/data/pin/v1/p/110.json");
  check("PIN files are JSON", r.status === 200 && header(r, "content-type").startsWith("application/json") && JSON.parse(body)["110001"]?.[0]?.[0] === "New Delhi", header(r, "content-type"));
  check("PIN files are cached for a year", header(r, "cache-control") === YEAR, header(r, "cache-control"));
  check("PIN files carry nosniff and the location policy", header(r, "x-content-type-options") === "nosniff" && header(r, "permissions-policy") === PERMISSIONS);
  check("PIN files skip the Worker", !viaWorker(r));
}
{
  const { r, body } = await pinFile("/data/pin/v1/geo.bin.gz");
  const zipped = body[0] === 0x1f && body[1] === 0x8b;
  check("the location file is served", r.status === 200 && body.length > 100_000, `${body.length} bytes`);
  check("the location file has a binary type", /application\/(gzip|x-gzip|octet-stream)/.test(header(r, "content-type")), header(r, "content-type"));
  check("the location file is cached for a year", header(r, "cache-control") === YEAR, header(r, "cache-control"));
  check("the location file skips the Worker", !viaWorker(r));
  info("location file encoding", `content-encoding ${header(r, "content-encoding") || "none"}, gzip signature in body: ${zipped}. The browser code handles both.`);
}
{
  const { r, body } = await pinFile("/data/pin/v1/NOTICE.txt");
  check("the attribution notice is UTF-8 text", header(r, "content-type") === "text/plain; charset=utf-8" && body.toString("utf8").includes("NÉVORA"), header(r, "content-type"));
  const m = await pinFile("/data/pin/v1/manifest.json");
  check("the manifest is JSON for this version", header(m.r, "content-type").startsWith("application/json") && JSON.parse(m.body).version === "v1");
}
{
  const r = await get("/sample/jhumka.svg");
  await r.arrayBuffer();
  check("sample images are SVG, cached for a day, and skip the Worker", r.status === 200 && header(r, "content-type").startsWith("image/svg+xml") && header(r, "cache-control") === "public, max-age=86400" && !viaWorker(r), `${header(r, "content-type")}; ${header(r, "cache-control")}`);
}

// Every prefix file, 20 at a time.
{
  const prefixes = Array.from({ length: 900 }, (_, i) => String(100 + i));
  const problems = [];
  let viaWorkerCount = 0;
  for (let i = 0; i < prefixes.length; i += 20) {
    await Promise.all(prefixes.slice(i, i + 20).map(async (p) => {
      const { r, body } = await pinFile(`/data/pin/v1/p/${p}.json`);
      if (viaWorker(r)) viaWorkerCount++;
      try { JSON.parse(body); } catch { problems.push(`${p}: not JSON`); return; }
      if (r.status !== 200 || header(r, "cache-control") !== YEAR || !header(r, "content-type").startsWith("application/json")) problems.push(`${p}: ${r.status} ${header(r, "cache-control")}`);
    }));
  }
  check("all 900 PIN prefix files are served as cached JSON", problems.length === 0, problems.slice(0, 3).join(" | "));
  check("none of the 900 PIN prefix files run the Worker", viaWorkerCount === 0, `${viaWorkerCount} via Worker`);
}

// ---- Worker guard and private files ----
{
  const r = await get("/products/%FF");
  const text = await r.text();
  check("a malformed URL gets 400, not 500", r.status === 400 && text === "Bad Request" && header(r, "cache-control") === "no-store", `${r.status}`);
  const ok = await get("/products/sample-dome-jhumk%61");
  await ok.arrayBuffer();
  // Known OpenNext difference: plain `next start` decodes %61 to "a" and serves the page, while OpenNext looks up the
  // pre-rendered page by the raw path and answers 404. Browsers never percent-encode plain letters, and NÉVORA's slugs
  // are plain letters, so only hand-typed URLs are affected. Reported to the owner; not hidden as a pass.
  info("percent-encoded letters in a product URL (known OpenNext difference)", `${ok.status}; next start gives 200`);
}
for (const path of ["/_headers", "/.dev.vars", "/.env", "/wrangler.jsonc", "/package.json", "/custom-worker.ts", "/open-next.config.ts", "/next.config.ts", "/.open-next/worker.js"]) {
  const r = await get(path);
  const text = await r.text();
  check(`${path} isn't served`, r.status === 404 && !/max-age=31536000|nevora-store-staging|SUPABASE|SECRET/i.test(text), `${r.status}`);
}
{
  const r = await get("/BUILD_ID");
  info("/BUILD_ID", `${r.status}: a public build label, also present in page HTML, not a secret`);
  await r.arrayBuffer();
}

console.log(failed ? `\n${failed} check(s) failed against ${base}` : `\nAll checks passed against ${base}`);
process.exit(failed ? 1 : 0);
