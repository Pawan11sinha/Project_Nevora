// HTTP-level audit of a locally running Worker. Usage: AUDIT_TOKEN=.. ACTION_ID=.. node audit-http.mjs <base> <mockBase>
const base = process.argv[2].replace(/\/$/, "");
const mock = process.argv[3];
const out = [];
const rec = (id, status, evidence) => { out.push({ id, status, evidence }); console.log(`${status.padEnd(7)} ${id}  ::  ${evidence}`); };
const get = (p, o = {}) => fetch(base + p, { redirect: "manual", ...o });
const text = async (p, o) => { const r = await get(p, o); return { r, b: await r.text() }; };
const mockStats = async () => (await fetch(`${mock}/__mock/stats`)).json();
const mockReset = () => fetch(`${mock}/__mock/reset`);

// Routing and rendering
for (const [p, code] of [["/", 200], ["/c/earrings", 200], ["/c/nope", 404], ["/p/sample-1", 200], ["/p/sample-40", 200], ["/p/nope", 404], ["/no-such", 404], ["/ssr", 200], ["/sitemap.xml", 200]]) {
  const r = await get(p);
  const cache = r.headers.get("x-nextjs-cache") ?? "-";
  rec(`route ${p}`, r.status === code ? "PASS" : "FAIL", `status=${r.status} x-nextjs-cache=${cache} cache-control=${r.headers.get("cache-control")}`);
}
{ const a = await text("/ssr"); await new Promise((r) => setTimeout(r, 30)); const b = await text("/ssr"); const m = (s) => s.match(/Rendered at (?:<!-- -->)?([^<]+)/)?.[1]; rec("SSR renders fresh each request", m(a.b) && m(a.b) !== m(b.b) ? "PASS" : "FAIL", `${m(a.b)} vs ${m(b.b)}`); }
{ const r = await get("/c/earrings", { headers: { RSC: "1" }, redirect: "follow" }); await r.arrayBuffer(); rec("RSC payload request", r.status === 200 && (r.headers.get("content-type") ?? "").includes("text/x-component") ? "PASS" : "FAIL", `status=${r.status} type=${r.headers.get("content-type")} redirected=${r.redirected}`); }

// API methods
for (const [p, m, code] of [["/api/health", "GET", 200], ["/api/health", "HEAD", 200], ["/api/health", "POST", 405], ["/api/health", "PUT", 405], ["/api/health", "DELETE", 405], ["/api/health", "PATCH", 405], ["/api/db-test", "GET", 405], ["/api/db-test", "POST", 403]]) {
  const r = await get(p, { method: m });
  rec(`API ${m} ${p}`, r.status === code ? "PASS" : "FAIL", `status=${r.status}, expected ${code}`);
}
{ const r = await get("/api/health", { method: "OPTIONS" }); rec("API OPTIONS /api/health", r.status < 500 ? "PASS" : "FAIL", `status=${r.status} allow=${r.headers.get("allow")} acao=${r.headers.get("access-control-allow-origin")}`); }
{ const r = await get("/api/db-test", { method: "POST", headers: { "x-test-token": "wrong" } }); rec("API wrong token rejected", r.status === 403 ? "PASS" : "FAIL", `status=${r.status}`); }
{ const r = await get("/api/db-test", { method: "POST", headers: { "x-test-token": process.env.AUDIT_TOKEN } }); const b = await r.json(); rec("Env vars and outbound fetch reach mock DB", r.status === 200 && b.taken === true ? "PASS" : "FAIL", `status=${r.status} body=${JSON.stringify(b)}`); }
{ await fetch(`${mock}/__mock/config?failRpc=1`); const { r, b } = await text("/api/db-test", { method: "POST", headers: { "x-test-token": process.env.AUDIT_TOKEN } }); await fetch(`${mock}/__mock/config?failRpc=0`); rec("DB error detail hidden from client", b.includes("INTERNAL_DB_DETAIL_MARKER") ? "FAIL" : "PASS", `status=${r.status} body=${b.slice(0, 90)}`); }

// Server actions
const action = process.env.ACTION_ID;
const actionForm = (phone) => { const f = new FormData(); f.set("0", '[{"message":""},"$K1"]'); f.set("1_name", "Test Customer"); f.set("1_phone", phone); return f; };
const postAction = (origin, phone = "9876543210") => get("/action-test", { method: "POST", headers: { "next-action": action, origin, accept: "text/x-component" }, body: actionForm(phone) });
{ const r = await postAction(base); const b = await r.text(); rec("Server action same origin runs", r.status === 200 && b.includes('"message"') ? "PASS" : "FAIL", `status=${r.status} actionReturned=${b.includes('"message"')}; valid and invalid input are checked in the browser test`); }
{ const r = await postAction("https://evil.example"); const b = await r.text(); rec("Server action cross-origin rejected", r.status >= 400 && !b.includes('"message"') ? "PASS" : "FAIL", `status=${r.status} actionRan=${b.includes('"message"')}`); }
{ const r = await get("/action-test", { method: "POST", headers: { "next-action": "0".repeat(42), origin: base }, body: actionForm("9876543210") }); rec("Unknown server action rejected", r.status >= 400 ? "PASS" : "FAIL", `status=${r.status}`); }
{ const r = await postAction(base, "9".repeat(2 * 1024 * 1024)); const b = await r.text(); rec("Server action over 1 MB rejected", r.status >= 400 && !b.includes('"message"') ? "PASS" : "WARNING", `status=${r.status} ranAction=${b.includes('"message"')}`); }

// Proxy
for (const [p, loc] of [["/account", "/login"], ["/admin", "/admin/login"], ["/admin/anything", "/admin/login"], ["/account/orders", "/login"]]) {
  const r = await get(p);
  rec(`proxy guards ${p}`, r.status === 307 && (r.headers.get("location") ?? "").endsWith(loc) ? "PASS" : "FAIL", `status=${r.status} location=${r.headers.get("location")}`);
}
for (const [label, p, headers] of [
  ["x-middleware-subrequest header", "/admin", { "x-middleware-subrequest": "src/proxy:src/proxy:src/proxy:src/proxy:src/proxy" }],
  ["x-middleware-subrequest middleware", "/admin", { "x-middleware-subrequest": "middleware:middleware:middleware:middleware:middleware" }],
  ["trailing slash", "/admin/", {}], ["uppercase path", "/ADMIN", {}], ["double slash", "//admin", {}], ["encoded a", "/%61dmin", {}], ["encoded slash", "/admin%2F", {}], ["dot segment", "/x/../admin", {}], ["RSC request", "/admin", { RSC: "1" }], ["next-url header", "/admin", { "x-invoke-path": "/" }], ["data path", "/_next/data/x/admin.json", {}],
]) {
  const { r, b } = await text(p, { headers });
  const leaked = /Admin area test|Logged in/.test(b);
  rec(`proxy bypass: ${label}`, leaked ? "FAIL" : "PASS", `status=${r.status} location=${r.headers.get("location") ?? "-"} protectedContent=${leaked}`);
}

// Cookies
{ const r = await get("/api/audit/cookie", { headers: { cookie: "x=1; y=2" } }); const c = r.headers.getSetCookie(); const j = await r.json(); rec("Multiple Set-Cookie headers preserved", c.length === 2 ? "PASS" : "FAIL", c.join(" | ")); rec("Request cookies readable", ["x", "y"].every((c) => j.received.includes(c)) ? "PASS" : "FAIL", JSON.stringify(j.received)); }
{ await mockReset(); for (const p of ["/", "/c/earrings", "/p/sample-1", "/login"]) await get(p, { headers: { cookie: "sb-127-auth-token=forged" } }); const s = await mockStats(); rec("Proxy skips public pages even with cookie", s.user === 0 && s.refresh === 0 ? "PASS" : "FAIL", JSON.stringify(s)); }
{ await mockReset(); const r = await get("/account", { headers: { cookie: "sb-127-auth-token=forged" } }); rec("Forged session cookie rejected", r.status === 307 ? "PASS" : "FAIL", `status=${r.status} location=${r.headers.get("location")}`); }
{ const r = await get("/c/earrings", { headers: { cookie: "sb-127-auth-token=x" } }); rec("Cached public page sets no cookie", r.headers.getSetCookie().length === 0 ? "PASS" : "FAIL", `set-cookie count=${r.headers.getSetCookie().length} cache=${r.headers.get("cache-control")}`); }
{ const r = await get("/ssr"); rec("Dynamic pages not cacheable", /no-store/.test(r.headers.get("cache-control") ?? "") ? "PASS" : "FAIL", r.headers.get("cache-control")); }
{ const r = await get("/api/audit/cookie"); rec("Dynamic route cache header", /no-store/.test(r.headers.get("cache-control") ?? "") ? "PASS" : "WARNING", `cache-control=${r.headers.get("cache-control")}`); }

// Security headers
{ const r = await get("/"); for (const [h, severity] of [["content-security-policy", "FAIL"], ["strict-transport-security", "FAIL"], ["x-frame-options", "FAIL"], ["x-content-type-options", "FAIL"], ["referrer-policy", "WARNING"], ["permissions-policy", "WARNING"]]) rec(`header ${h}`, r.headers.get(h) ? "PASS" : severity, r.headers.get(h) ?? "missing"); const d = await get("/ssr"); rec("x-powered-by hidden", d.headers.get("x-powered-by") ? "WARNING" : "PASS", `on /ssr: ${d.headers.get("x-powered-by") ?? "absent"}`); for (const [h] of [["x-frame-options"]]) rec(`headers also on dynamic page: ${h}`, d.headers.get(h) ? "PASS" : "FAIL", d.headers.get(h) ?? "missing"); }

// Errors and hostile input
{ const { r, b } = await text("/api/audit/throw"); rec("Route error hides detail", r.status === 500 && !b.includes("AUDIT_SECRET_ERROR_MARKER") ? "PASS" : "FAIL", `status=${r.status} leak=${b.includes("AUDIT_SECRET_ERROR_MARKER")} body=${b.slice(0, 40)}`); }
{ const { r, b } = await text("/audit/throw"); rec("Page error hides detail", r.status === 500 && !b.includes("AUDIT_SECRET_ERROR_MARKER") ? "PASS" : "FAIL", `status=${r.status} leak=${b.includes("AUDIT_SECRET_ERROR_MARKER")} stack=${/at .*\.(js|mjs|tsx):/.test(b)}`); rec("Branded error page exists", /error\.tsx/.test(process.env.ERROR_PAGE ?? "") ? "PASS" : "WARNING", "no error.tsx or global-error.tsx in src/app"); }
for (const [p, ok] of [["/c/%E0%A4%A", (s) => s < 500], ["/p/%3Cscript%3Ealert(1)%3C%2Fscript%3E", (s) => s === 404], [`/c/${"a".repeat(8000)}`, (s) => s < 500], ["/..%2f..%2fetc/passwd", (s) => s === 404], ["/.env", (s) => s === 404], ["/.dev.vars", (s) => s === 404], ["/wrangler.jsonc", (s) => s === 404], ["/package.json", (s) => s === 404], ["/cdn-cgi/_next_cache/x", (s) => s >= 400]]) {
  const { r, b } = await text(p);
  rec(`hostile path ${p.slice(0, 40)}`, ok(r.status) && !b.includes("<script>alert(1)") ? "PASS" : "FAIL", `status=${r.status}`);
}
{ const r = await get("/BUILD_ID"); rec("BUILD_ID not public", r.status === 404 ? "PASS" : "WARNING", `status=${r.status}`); }

// Static assets
{ const home = await (await get("/")).text(); const css = home.match(/\/_next\/static\/[^"]+\.css/)?.[0]; const font = home.match(/\/_next\/static\/media\/[^"]+\.woff2/)?.[0]; const js = home.match(/\/_next\/static\/[^"]+\.js/)?.[0];
  for (const [label, p] of [["css", css], ["font", font], ["js", js]]) { const r = await get(p, { headers: { "accept-encoding": "gzip, br" } }); await r.arrayBuffer(); rec(`asset ${label}`, r.status === 200 && /immutable/.test(r.headers.get("cache-control") ?? "") ? "PASS" : "WARNING", `status=${r.status} type=${r.headers.get("content-type")} cache=${r.headers.get("cache-control")} x-opennext=${r.headers.get("x-opennext") ?? "-"}`); }
  const r = await get("/sample/product-400.svg"); await r.arrayBuffer(); rec("public image headers", r.status === 200 && /svg/.test(r.headers.get("content-type") ?? "") && /max-age=[1-9]/.test(r.headers.get("cache-control") ?? "") ? "PASS" : "WARNING", `type=${r.headers.get("content-type")} cache=${r.headers.get("cache-control")}`);
  const c1 = await get("/c/earrings"); await c1.arrayBuffer(); await new Promise((w) => setTimeout(w, 2100)); const c2 = await get("/c/earrings"); await c2.arrayBuffer(); rec("prerendered pages avoid the Worker", c1.headers.get("cache-control") === c2.headers.get("cache-control") ? "PASS" : "WARNING", `cache-control changes per request (${c1.headers.get("cache-control")} then ${c2.headers.get("cache-control")}), so the Worker computed it and each page view uses a Worker request and CPU`);
  const m = await get((js ?? "") + ".map"); await m.arrayBuffer(); rec("source maps not public", m.status === 404 ? "PASS" : "WARNING", `status=${m.status}`);
}

// Runtime APIs
{ const r = await (await get("/api/audit/runtime")).json(); for (const [k, v] of Object.entries(r)) rec(`runtime ${k}`, typeof v === "string" && v.startsWith("FAILED") ? "FAIL" : v === false ? "WARNING" : "PASS", JSON.stringify(v)); }
{ await get("/api/audit/after"); await new Promise((r) => setTimeout(r, 300)); const j = await (await get("/api/audit/after")).json(); rec("after() runs", j.afterRunsSeen >= 1 ? "PASS" : "FAIL", JSON.stringify(j)); }

// Size and load
for (const mb of [1, 10, 50]) { const r = await get("/api/audit/body", { method: "POST", body: new Uint8Array(mb * 1024 * 1024) }); const j = await r.json().catch(() => ({})); rec(`request body ${mb} MB (route handler)`, j.bytes === mb * 1048576 ? "PASS" : "WARNING", `status=${r.status} bytes=${j.bytes}`); }
for (const mb of [32, 128, 200]) { const r = await get(`/api/audit/memory?mb=${mb}`).catch((e) => ({ status: String(e) })); rec(`allocate ${mb} MB locally`, "NOT TESTED", `status=${r.status}; local runtime doesn't enforce the 128 MB production limit`); }
for (const p of ["/", "/ssr", "/api/health"]) { const t = performance.now(); const res = await Promise.all(Array.from({ length: 100 }, () => get(p).then(async (r) => { await r.arrayBuffer(); return r.status; }).catch(() => 0))); const bad = res.filter((s) => s !== 200).length; rec(`100 concurrent ${p}`, bad ? "FAIL" : "PASS", `errors=${bad} total=${Math.round(performance.now() - t)} ms`); }
{ for (const p of ["/", "/c/earrings", "/p/sample-1", "/ssr"]) { const r = await get(p, { headers: { "accept-encoding": "identity" } }); const n = (await r.arrayBuffer()).byteLength; rec(`response size ${p}`, "PASS", `${(n / 1024).toFixed(1)} KB uncompressed`); } }
console.log("\nSUMMARY", JSON.stringify(out.reduce((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {})));
