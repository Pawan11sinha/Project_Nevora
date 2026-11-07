// Private routes (bag, checkout, account, orders, admin, API) must never become publicly cacheable.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { test } from "node:test";
import { NO_STORE, PRIVATE_ROUTES, PUBLIC_ROUTES, noStoreHeaderRules } from "../src/lib/cache-policy.ts";

const appDir = join(import.meta.dirname, "..", "src", "app");

/** The URL path of every page and route handler in src/app, without (group) folders. */
function appRoutes() {
  return readdirSync(appDir, { recursive: true })
    .filter((f) => /(^|[\\/])(page|route)\.(tsx?|jsx?)$/.test(f))
    .map((f) => "/" + relative(appDir, join(appDir, f)).split(sep).slice(0, -1).filter((s) => !/^\(.*\)$/.test(s)).join("/"));
}
const topLevel = (path) => (path === "/" ? "/" : `/${path.split("/")[1]}`);

// Next.js path matching for the two rule shapes used here: an exact path, and "<path>/:path*".
const matches = (source, path) => source.endsWith("/:path*") ? path.startsWith(source.slice(0, -"/:path*".length) + "/") : source === path;
const noStore = (path) => noStoreHeaderRules().some((r) => matches(r.source, path) && r.headers.some((h) => h.key === "Cache-Control" && h.value === NO_STORE));

test("every route in src/app is classified as public or private", () => {
  const routes = appRoutes();
  assert.ok(routes.includes("/checkout") && routes.includes("/bag"), routes.join(", "));
  for (const route of routes) {
    const top = topLevel(route);
    assert.ok([...PUBLIC_ROUTES, ...PRIVATE_ROUTES].includes(top), `${route} isn't in PUBLIC_ROUTES or PRIVATE_ROUTES in src/lib/cache-policy.ts`);
  }
});

test("no route is both public and private", () => {
  assert.deepEqual(PUBLIC_ROUTES.filter((r) => PRIVATE_ROUTES.includes(r)), []);
});

test("the bag and checkout are never cached, including anything added under them", () => {
  for (const path of ["/bag", "/checkout", "/checkout/confirm", "/checkout/a/b"]) assert.ok(noStore(path), path);
});

test("planned account, order, admin and API routes are covered before they exist", () => {
  for (const path of ["/account", "/account/orders/123", "/order/NEV-1001", "/admin", "/admin/login", "/admin/orders/1", "/api/anything"]) assert.ok(noStore(path), path);
});

test("public catalogue pages stay cacheable", () => {
  for (const path of ["/", "/products/sample-dome-jhumka", "/categories/jewellery", "/collections/korean-edit", "/info/shipping"]) assert.ok(!noStore(path), path);
});

test("next.config.ts applies the no-store rules after the security headers", () => {
  const config = readFileSync(join(import.meta.dirname, "..", "next.config.ts"), "utf8");
  assert.match(config, /import \{ noStoreHeaderRules \} from "\.\/src\/lib\/cache-policy"/);
  const security = config.indexOf("headers: securityHeaders");
  const rules = config.indexOf("...noStoreHeaderRules()");
  assert.ok(security > 0 && rules > security, "noStoreHeaderRules() must be spread after the security headers rule");
});
