// Checks that pages really render and server routes really work.
// Usage: node smoke.mjs <base-url> [repeat]
const base = (process.argv[2] ?? "http://localhost:8787").replace(/\/$/, "");
const repeat = Number(process.argv[3] ?? 1);

const checks = [
  { name: "static home", path: "/", status: 200, text: "Static home page" },
  { name: "cached category", path: "/c/earrings", status: 200, text: "Generated at" },
  { name: "cached product", path: "/p/sample-1", status: 200, text: "Sample Oxidised Jhumka 1" },
  { name: "product generated on demand", path: "/p/sample-40", status: 200, text: "Sample Satin Scrunchie Pack 40" },
  { name: "server-rendered listing", path: "/ssr", status: 200, text: "Rendered at" },
  { name: "route handler", path: "/api/health", status: 200, text: '"ok":true' },
  { name: "not found page", path: "/no-such-page", status: 404, text: "Test page not found" },
  { name: "unknown category", path: "/c/nope", status: 404, text: "Test page not found" },
  { name: "sitemap", path: "/sitemap.xml", status: 200, text: "/c/earrings" },
  { name: "static image", path: "/sample/product-400.svg", status: 200, text: "Sample 400" },
  { name: "proxy guards account", path: "/account", status: 307, location: "/login" },
  { name: "proxy guards admin", path: "/admin", status: 307, location: "/admin/login" },
  { name: "admin login page", path: "/admin/login", status: 200, text: "Admin login test" },
  { name: "customer login page", path: "/login", status: 200, text: "Customer login test" },
  { name: "db route needs token", path: "/api/db-test", method: "POST", status: 403 },
];

let failures = 0;
for (const c of checks) {
  const times = [];
  const problems = new Set();
  for (let i = 0; i < repeat; i++) {
    const start = performance.now();
    try {
      const res = await fetch(base + c.path, { method: c.method ?? "GET", redirect: "manual" });
      const body = await res.text();
      times.push(performance.now() - start);
      if (res.status !== c.status) problems.add(`status ${res.status}, expected ${c.status}`);
      if (c.text && !body.includes(c.text)) problems.add(`missing "${c.text}"`);
      if (c.location && !(res.headers.get("location") ?? "").endsWith(c.location)) {
        problems.add(`redirected to ${res.headers.get("location")}`);
      }
      if (/exceeded resource limits|error code: 1102|error code: 1027/i.test(body)) {
        problems.add("Cloudflare limit error");
      }
    } catch (error) {
      problems.add(String(error));
    }
  }
  times.sort((a, b) => a - b);
  const median = times.length ? Math.round(times[Math.floor(times.length / 2)]) : "-";
  if (problems.size) failures++;
  console.log(`${problems.size ? "FAIL" : "PASS"}  ${c.name.padEnd(30)} ${median} ms  ${[...problems].join("; ")}`);
}
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
