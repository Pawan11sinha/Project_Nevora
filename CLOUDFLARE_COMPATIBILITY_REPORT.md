# NÉVORA Cloudflare Workers compatibility report

Audit date: 5 November 2026. Audited: `deploy-test/opennext`, plus the plans in `docs/`.

## 1. Verdict

**Locally compatible, with fixes needed. Not verified in production.**

Next.js 16.4.5 with OpenNext works in Cloudflare's local runtime, including rendering, routing, server actions, cookies and caching. The fixes for the problems found were tested in a throwaway copy and work.

Three limits on this verdict:

1. **Nothing has run on Cloudflare's network.** The deciding test, real CPU against the 10 ms limit, is still outstanding.
2. **Supabase isn't connected.** Every login test used a local mock, which proves the site's cookie and session handling, not real Supabase behaviour.
3. **There's no store yet.** The audited code is a small test app with sample data. Cart, checkout, payments, reviews and the AI assistant don't exist as code, so they can only be assessed on design.

## 2. How to read the results

| Status | Meaning |
|---|---|
| PASS | The automated test passed |
| FAIL | The test failed, or something required is missing |
| WARNING | Works, but carries a risk or needs attention |
| NOT TESTED | Couldn't be tested under this audit's restrictions |

| Evidence level | Meaning |
|---|---|
| **Local** | Ran in `workerd`, Cloudflare's runtime, on this Mac. It enforces no production limits. |
| **Mock** | As Local, but against `tools/mock-supabase.mjs`, a fake Supabase |
| **Build** | From build, type-check, lint or dry-run output |
| **Review** | Read from code or docs, not run |
| **Production** | Ran on Cloudflare's network. **Nothing in this report has this level.** |

### Test totals

| Run | PASS | FAIL | WARNING | NOT TESTED |
|---|---|---|---|---|
| HTTP checks, current test app | 84 | 7 | 11 | 3 |
| Browser and mock-login checks, current test app | 17 | 0 | 3 | 0 |
| Basic browser checks, current test app | 11 | 0 | 0 | 0 |
| HTTP checks, throwaway copy with fixes | 96 | 2 | 4 | 3 |
| Browser and mock-login checks, throwaway copy with fixes | 19 | 0 | 1 | 0 |

The fixes remove 5 of the 7 failures. The remaining 2 are in test-app code: a database error shown to the client (fix 6) and the malformed-URL `500`, which plain Next.js also returns.

## 3. Results by area

### 3.1 Next.js and OpenNext compatibility

| Check | Status | Level | Evidence |
|---|---|---|---|
| Versions satisfy peer requirements | PASS | Build | next 16.4.5, @opennextjs/cloudflare 1.20.16, wrangler 4.157.0. OpenNext requires `next >=16.4.5`. `npm ls` shows no conflicts. |
| OpenNext build | PASS | Build | Exit 0 |
| Template defaults | PASS | Review | `cacheComponents` and `partialPrefetching` are removed from `next.config.ts` |
| Node version pinned | WARNING | Review | Node 25.2.1 locally, with no `.nvmrc` or `engines`. Fix: pin Node 24. |
| Available updates | WARNING | Build | `react` and `react-dom` 19.3.0, latest 19.3.1. `typescript` 7 and `eslint` 10 are major upgrades, so hold them. Not upgraded, as instructed. |

### 3.2 Build, TypeScript and ESLint

| Check | Status | Level | Evidence |
|---|---|---|---|
| `tsc --noEmit` | PASS | Build | Exit 0 |
| `eslint src --max-warnings=0` | PASS | Build | Exit 0 |
| `npm run lint` | **FAIL** | Build | `✖ 25152 problems (1145 errors, 24007 warnings)`, all from generated `.open-next/`. With `--ignore-pattern ".open-next/**"` it passes. Fix: add `.open-next/**` and `.wrangler/**` to `globalIgnores`. |
| `npm run test` | **FAIL** | Review | No test script or test suite in the app. Fix: planned for Phase 1b. |
| Production dependency vulnerabilities | PASS | Build | `npm audit --omit=dev`: 0 |
| Dev dependency vulnerabilities | WARNING | Build | 12 (4 high, 8 moderate), through `@opennextjs/cloudflare` (`glob`) and `eslint-config-next` (`minimatch`). These are build tools and aren't in the Worker. Review before CI runs them on untrusted input. |

### 3.3 SSR, SSG, dynamic routing and 404s

| Check | Status | Level | Evidence |
|---|---|---|---|
| Static home page | PASS | Local | `/` returns 200 from cache |
| SSG category and product pages | PASS | Local | `/c/earrings`, `/p/sample-1` return 200 from cache |
| SSR | PASS | Local | `/ssr` timestamps differ between requests, `no-store` |
| Page outside `generateStaticParams` | PASS | Local | `/p/sample-40` returns 200 |
| 404 handling | PASS | Local | `/no-such`, `/c/nope`, `/p/nope` return 404 |
| Client navigation (RSC) | PASS | Local | `text/x-component`, tested in browser |
| Sitemap | PASS | Local | `/sitemap.xml` returns 200 |
| Malformed URL | WARNING | Local | `/c/%E0%A4%A` returns 500, not 400. Plain `next start` does the same, so it isn't an adapter fault. Fix: keep an eye on it in error logs. |
| 100 concurrent requests | PASS | Local | 0 errors on `/`, `/ssr`, `/api/health`. Doesn't indicate production capacity. |

### 3.4 Server Actions and API methods

| Check | Status | Level | Evidence |
|---|---|---|---|
| Server action with valid and invalid input | PASS | Local | Browser test: both results correct |
| Cross-origin action rejected | PASS | Local | `Origin: https://evil.example` returns 500, and the action doesn't run |
| Unknown action rejected | PASS | Local | 409 |
| Action over 1 MB rejected | PASS | Local | 500, and the action doesn't run |
| HTTP methods | PASS | Local | GET and HEAD 200, POST, PUT, DELETE and PATCH 405 on `/api/health`. OPTIONS 204, with no CORS allowance. |
| Token protection | PASS | Local | Missing or wrong token returns 403 |
| Cross-origin check behind a custom domain | NOT TESTED | None | Needs a real deployment |

### 3.5 Proxy, middleware and the Node.js warning

Build output:

```text
WARN Node.js middleware support is experimental in cloudflare, and not officially maintained by OpenNext maintainers. Use at your own risk.
```

Next.js 16 runs `proxy.ts` only on the Node.js runtime, so this warning can't be turned off while using `proxy.ts`.

| Check | Status | Level | Evidence |
|---|---|---|---|
| `proxy.ts` on OpenNext | **WARNING** | Build | Works, but unsupported, as above |
| Redirects on protected paths | PASS | Local | `/admin`, `/account` and subpaths return 307 to login |
| 11 bypass attempts | PASS | Local | `x-middleware-subrequest`, case, slashes, encoding, dot segments, RSC and data paths. No protected content returned. |
| Skips public pages | PASS | Mock | 0 auth calls on 4 public pages with a session cookie |
| **Alternative: Edge `middleware.ts`** | PASS with a warning | Mock | **The experimental warning goes away**, and every redirect, bypass and login test still passes. Compressed size falls from 1,567 to 1,433 KiB. New warning: `The "middleware" file convention is deprecated`. |

**Recommendation:** use Edge `middleware.ts`. It's the adapter's supported path, but it's deprecated in Next.js, so a later Next.js release may remove it. To limit that risk, every page and action checks the session and role itself, as this test app does, so middleware is only for token refresh and redirects.

### 3.6 Cookies, sessions and authentication

| Check | Status | Level | Evidence |
|---|---|---|---|
| Multiple `Set-Cookie` headers | PASS | Local | Both cookies preserved with attributes |
| Login creates a session | PASS | Mock | Reaches `/account` |
| Customer blocked from `/admin` | PASS | Mock | `denied=true`, `adminContent=false`, checked by server RPC |
| Admin reaches admin area | PASS | Mock | Role check passes |
| Forged and tampered cookies | PASS | Mock | Sent to login |
| Logout | PASS | Mock | Cookie removed, `/account` blocked |
| Wrong password | PASS | Mock | Generic "Login failed" |
| Token refresh | PASS | Mock | 1 refresh per page view, cookie updated, still logged in |
| `HttpOnly` session cookie | **WARNING** | Mock | `httpOnly=false` by default. Fixed in the copy with `cookieOptions`, and all flows still pass. |
| `Secure` session cookie | **WARNING** | Mock | `secure=false` by default. Same fix. Needs a recheck on HTTPS. |
| Cookie lifetime | WARNING | Mock | 400 days. Decide the real session length in Supabase settings. |
| Parallel requests near expiry | WARNING | Mock | 5 requests made 5 refresh calls. Real Supabase rotates refresh tokens, so test this on the real service. |
| Auth calls per protected page | WARNING | Mock | 2 `/auth/v1/user` calls per `/account` view (middleware and page). This adds latency and counts against the subrequest limit. Fix: drop one once real timing is known. |
| Real Supabase login, email verification, password reset | NOT TESTED | None | Supabase isn't connected |
| Signup | **FAIL** | Review | Not implemented. Needs Resend and a domain, because Supabase's default email refuses non-team addresses. |

### 3.7 Static assets, images and fonts

| Check | Status | Level | Evidence |
|---|---|---|---|
| Fonts self-hosted | PASS | Local | 0 third-party requests in the browser |
| Images load at 360px | PASS | Local | Plain responsive component, 11 of 11 browser checks |
| Asset caching | **FAIL** | Local | `/_next/static/*` returns `public, max-age=0, must-revalidate`. `next start` returns `immutable`. Fix verified in the copy: `public/_headers`. |
| `/BUILD_ID` public | WARNING | Local | Returns 200. Low risk, as it reveals only a build ID. |
| Source maps public | PASS | Local | 404 |
| Sensitive files public | PASS | Local | `.env`, `.dev.vars`, `wrangler.jsonc`, `package.json` return 404 |
| R2 storage, custom domain, presigned upload | NOT TESTED | None | R2 is off, as instructed, and there's no domain |
| Real product photo size and speed | NOT TESTED | None | Test images are tiny SVGs |

### 3.8 Caching, ISR and invalidation

| Check | Status | Level | Evidence |
|---|---|---|---|
| Prerendered pages from static-asset cache | PASS | Local | Served from cache |
| On-demand pages cached, current config | **FAIL** | Local | `/p/sample-40` is re-rendered every time. The read-only cache can't store it. CPU indicator 13.3 ms. |
| On-demand pages with KV | PASS | Local | Copy: first MISS, then cached. CPU indicator 2.5 ms. |
| Time-based ISR with KV and memory queue | PASS | Local | Content changes after expiry |
| `revalidatePath` with KV tag cache | PASS | Local | Stable until called, then changes |
| Private responses | PASS | Local | `/ssr` is `no-store`. 0 cookies set on cached pages. |
| API responses lack a cache header | WARNING | Local | Route handlers send no `Cache-Control`. Fix: set `no-store` on private routes. |
| Prerendered pages skip the Worker | **WARNING** | Local | They don't. `s-maxage` changes per request, so the Worker computes it. Every page view uses a Worker request and CPU. |
| KV behaviour in production | NOT TESTED | None | Local KV is immediately consistent. Cloudflare documents KV as eventually consistent, so invalidation may lag. |

**Finding: a 5-minute `revalidate` won't fit KV's free write limit.** One page revalidated every 5 minutes means up to 288 writes a day, so about 20 pages means up to 5,760 writes against the 1,000-a-day limit. Fix: use a long `revalidate`, such as one day, and call `revalidatePath` when the admin edits a product. Prices stay safe either way, because `create_order` reads them from the database.

### 3.9 Bindings, environment variables, runtime APIs and bundle size

| Check | Status | Level | Evidence |
|---|---|---|---|
| Compressed Worker size | PASS | Build | `Total Upload: 7512.71 KiB / gzip: 1566.65 KiB`. Under the stricter 3 MiB figure. With KV: 1,623 KiB. With Edge middleware: 1,433 KiB. |
| Asset file count | PASS | Build | 33 files, limit 20,000 |
| Environment values reach server code | PASS | Mock | Worker read values from `.dev.vars` in the copy, and called the mock |
| Runtime APIs | PASS | Local | Web Crypto, `randomUUID`, `node:crypto`, `Buffer`, `AsyncLocalStorage`, streams, `CompressionStream`, timers, `after()`, `getCloudflareContext`, `waitUntil`, `cookies()`, `headers()` |
| Bindings | PASS | Local | `ASSETS`, `WORKER_SELF_REFERENCE`, and KV in the copy |
| Native modules | PASS | Review | None in `src`. No `sharp`. |
| `wrangler secret` in production | NOT TESTED | None | Needs a deployment |
| Real KV namespaces | NOT TESTED | None | Needs a deployment |

### 3.10 CPU, memory and request size

**Local CPU indicator.** This is `workerd` process CPU per request on this Mac, and includes local tooling overhead. **It isn't a production measurement.** Cloudflare's hardware differs and local runs don't enforce the limit. Use it only to compare pages.

| Path | Current app | With KV |
|---|---|---|
| `/api/health` | 1.95 ms | 2.10 ms |
| `/sample/product-400.svg` | 1.25 ms | 1.20 ms |
| `/` (cached) | 2.90 ms | 3.10 ms |
| `/c/earrings` (cached) | 2.60 ms | 2.80 ms |
| `/p/sample-1` (cached) | 2.55 ms | 2.50 ms |
| `/p/sample-40` (on demand) | **13.30 ms** | 2.50 ms |
| `/ssr` (48 products, every request) | **9.30 ms** | 9.00 ms |

| Check | Status | Level | Evidence |
|---|---|---|---|
| Real CPU against 10 ms | **NOT TESTED** | None | **The main outstanding test.** Locally, cached pages look comfortable. Fully rendered pages are close to or over the limit, and they have no database calls yet. |
| Startup | PASS | Local | `wrangler check startup`: about 9 ms non-idle, against a 1 second limit. Local CPU. |
| Real memory against 128 MB | NOT TESTED | None | The local runtime allowed 200 MB, so it doesn't enforce the limit. Process memory isn't per-isolate memory. |
| Request body in route handlers | PASS | Local | 1, 10 and 50 MB accepted locally. Cloudflare's limit isn't enforced here. |
| Server action body limit | PASS | Local | Over 1 MB rejected |
| 50 subrequests per request | PASS | Review | Protected pages use about 3. Not stress-tested. |

### 3.11 Security, authorisation, validation and errors

| Check | Status | Level | Evidence |
|---|---|---|---|
| Content-Security-Policy, HSTS, X-Frame-Options, X-Content-Type-Options | **FAIL** | Local | All missing. Fix verified: 6 of 6 headers on cached, dynamic, API and 404 responses, with all 11 browser checks passing. |
| Referrer-Policy, Permissions-Policy | WARNING | Local | Missing. Same fix. |
| `X-Powered-By` | WARNING | Local | `Next.js` on `/ssr`. Fix verified: `poweredByHeader: false`. |
| CSP strength | WARNING | Local | The tested policy needs `'unsafe-inline'` for scripts. Nonces would stop pages being cached. Accept this at launch, and revisit it. |
| Headers on static assets | WARNING | Local | `next.config` headers don't reach them. Add `nosniff` to `public/_headers`. |
| Database error shown to client | **FAIL** | Mock | `{"error":"INTERNAL_DB_DETAIL_MARKER"}` from `/api/db-test`. Fix: log internally and return a generic message. Test app only, but the store must not repeat it. |
| Thrown errors hide details | PASS | Local | No message or stack in route or page responses |
| Branded error page | WARNING | Review | No `error.tsx` or `global-error.tsx` |
| Login input validation | WARNING | Review | `login-actions.ts` uses `String(form.get(...))` with no Zod. Same `next` value handling is limited to two fixed paths, so there's no open redirect. |
| Rate limiting | **FAIL** | Review | None yet. Planned in `SECURITY_PLAN.md`. |
| Test token comparison | WARNING | Review | `!==` isn't constant time. Test-only code. |
| Secrets in build output | PASS | Build | Test token: 0 files. Variable names in browser assets: 0. `NEXT_PUBLIC_` uses in `src`: 0. |
| Real RLS and role checks | NOT TESTED | None | Supabase isn't connected. Mock role checks passed. |

### 3.12 Logging, monitoring and deployment

| Check | Status | Level | Evidence |
|---|---|---|---|
| `observability` on | PASS | Build | In `wrangler.jsonc` |
| Log contents | WARNING | Review | Logging code is minimal. No request bodies logged. |
| Error tracking | **FAIL** | Review | None. Workers Logs keep 3 days on Free. |
| Git repository | **FAIL** | Build | `fatal: not a git repository`. No history or rollback yet. |
| CI | **FAIL** | Review | No `.github/`. Planned for Phase 1b. |
| `.env.example` | **FAIL** | Review | Missing |
| `wrangler tail`, Workers Logs, alerts | NOT TESTED | None | Needs a deployment |
| Deployment and rollback | NOT TESTED | None | Not deployed, as instructed |

### 3.13 Free tier at 50,000 visits a month

Assumes 4 pages per visit, or 200,000 page views. The browser journey measured 4 Worker requests across 5 steps with prefetch off, or about 1 per page view. This excludes bots and checkout traffic. All are estimates.

| Resource | Estimated use | Free limit | Status |
|---|---|---|---|
| Worker requests | About 6,700 a day | 100,000 a day | PASS. About 15 times an average day before Error 1027. |
| CPU per request | Unknown in production | 10 ms | **NOT TESTED**, and the main risk |
| Static asset requests | Not counted | Free and unlimited | PASS |
| KV reads | At least 1 per cached page, about 6,700 a day | 100,000 a day | PASS, estimated |
| KV writes | Up to 5,760 a day at 5-minute revalidate, about 20 to 100 a day with the fix | 1,000 a day | **FAIL as configured**, PASS with the fix |
| Workers Logs | Under 200,000 events a day | 200,000 a day | PASS |
| Supabase egress | Low with caching | 5 GB a month | NOT TESTED, because the test app doesn't read the database |
| Supabase pause | Active stores stay awake | Pauses after low activity over 7 days | WARNING. Backups don't exist on Free. |
| R2 | About 25 MB, low reads | 10 GB, 10M reads a month | NOT TESTED. R2 is off, and overages are billed. |
| Resend | About 3 emails per order | 100 a day, 3,000 a month | PASS at planned volume. About 33 orders in a day hits the limit. |

**Feasible on paper at this traffic, if CPU passes.** Free-tier failures stop the site with errors rather than charging you, apart from R2.

**Expected monthly cost:**

| Stage | Cost | Trigger |
|---|---|---|
| All free | ₹0 | CPU passes in production |
| Workers Paid | $5, about ₹450 | CPU fails, or requests pass documented triggers |
| Add Supabase Pro | Add $25 | Steady orders, for backups and no pausing |
| Add Resend Pro | Add $20 | Over 70 emails a day |
| All three | About $50, about ₹4,500 | Growth |

Rupee figures assume about ₹90 to the dollar. The domain is extra, at about ₹1,000 a year (estimate).

## 4. Can the architecture support each feature?

No feature below exists as store code yet. "Design" means it's documented in `docs/`.

| Feature | Design | Platform evidence | Status | What's missing |
|---|---|---|---|---|
| Customer signup and login | Yes | Login, session and logout pass on Mock | WARNING | Signup code, real Supabase, Resend, domain |
| Admin dashboard | Yes | Separate login and role check pass on Mock | WARNING | All dashboard screens, real RLS |
| Product and category management | Yes | `revalidatePath` works locally. Dynamic categories designed. | WARNING | Database, admin screens, R2 upload (untested) |
| Shopping cart | Yes | Client components hydrate | PASS on design | Cart code |
| Checkout | Yes | Actions and validation work. Race safety not tested. | NOT TESTED | `create_order`, real database |
| Prepaid and COD advance | Yes | Manual verification needs no gateway, so no adapter risk | NOT TESTED | `record_payment`, admin screens, UPI settings |
| Product reviews | Yes, post-launch | ISR invalidation works locally | NOT TESTED | Tables, moderation, code. KV writes need watching if each review invalidates a page. |
| AI shopping assistant | Yes, post-launch | Streams available. No API test. | NOT TESTED | Streaming test, API costs, rate limits. Waiting on a model is low CPU, but this needs measuring. Usage is billed separately. |

## 5. Critical blockers

Before real customers can use this:

1. **Real CPU isn't measured.** This decides between free hosting and $5 a month. Needs a test deployment to `workers.dev`, which wasn't allowed in this audit.
2. **Supabase isn't connected.** Real auth, RLS, order race safety and egress are all untested.
3. **The store doesn't exist yet.** This is expected at this stage.
4. **No security headers, rate limiting or backups.** Header fix verified. The others are planned.
5. **Images and email depend on the domain, and R2 may need a card.** Neither is tested.

These aren't platform failures. No test found a reason to abandon Workers.

## 6. Recommended fixes, in priority order

Items 1 to 6 are small and have been verified in the throwaway copy, except where noted.

| # | Fix | Verified? |
|---|---|---|
| 1 | Replace `proxy.ts` with Edge `middleware.ts`, keeping checks in pages and actions | Yes |
| 2 | Add security headers and `poweredByHeader: false` in `next.config.ts` | Yes |
| 3 | Add `public/_headers` for immutable asset caching and `nosniff` | Yes, except `nosniff` |
| 4 | Set `httpOnly`, `secure` and `sameSite` through `cookieOptions` | Yes, on Mock. Recheck on HTTPS. |
| 5 | Use KV cache, KV tag cache and memory queue, with long `revalidate` and on-demand invalidation | Yes, locally |
| 6 | Never return database error messages. Add `error.tsx`, `global-error.tsx`, Zod on login, and `no-store` on private routes. | Not yet |
| 7 | Add `.open-next/**` and `.wrangler/**` to ESLint ignores, then add `.nvmrc`, `.env.example` and test scripts | Ignore pattern yes |
| 8 | Initialise git and connect GitHub with CI | Not yet |
| 9 | **Deploy the test app to `workers.dev` and measure real CPU, with your approval** | Outstanding |
| 10 | Connect a Supabase test project, then test real login, RLS and the race | Outstanding |
| 11 | Add rate limiting, the backup job with `auth` export, and error monitoring | Outstanding |
| 12 | Approve R2, once the card question is settled, then test uploads with the domain | Outstanding |

Also update `docs/`: replace `proxy.ts` and the `next/image` loader rule, and record the KV write limit. These haven't been changed, pending approval.

## 7. Should we proceed to Supabase integration?

**Yes, with a test project only, and alongside the CPU test.** Real CPU must include real database calls, so the two belong together. The production schema and real customer data should wait until CPU passes and fixes 1 to 6 are in.

## 8. How to rerun

Test code lives in `deploy-test/tools/` and `deploy-test/audit-overlay/`. The overlay adds test-only routes, and must never be copied into the store.

```bash
cd ~/Desktop/Project_Nevora/deploy-test/opennext
npx tsc --noEmit
npx eslint src --max-warnings=0
npx opennextjs-cloudflare build
npx wrangler deploy --dry-run --outdir /tmp/nevora-dry
npm audit --omit=dev
```

```bash
# In a throwaway copy of opennext/ with audit-overlay/src copied over it,
# a .dev.vars holding fake values, and the Worker running on port 8799:
node deploy-test/tools/mock-supabase.mjs 54999
AUDIT_TOKEN=<fake token> ACTION_ID=<id from server-reference-manifest.json> node deploy-test/tools/audit-http.mjs http://localhost:8799 http://127.0.0.1:54999
node deploy-test/tools/audit-browser.mjs http://localhost:8799 http://127.0.0.1:54999
WORKERD_MATCH=<path unique to the copy> node deploy-test/tools/audit-cpu.mjs http://localhost:8799 200
```

## 9. What this audit did and didn't touch

**Not done:** no production or test deployment, no R2, no domain, no plan change, no dependency installed or upgraded, no secrets printed, and no database connection.

**Changed:**

- Added this report, `deploy-test/audit-overlay/`, and `tools/audit-http.mjs`, `audit-browser.mjs`, `audit-cpu.mjs` and `mock-supabase.mjs`.
- App source files are unchanged. All experiments ran in a scratchpad copy.
- **`deploy-test/opennext/.next` and `.open-next` were rebuilt.** This happened while the owner's own `npm run preview` was running on port 8787, so that preview may show cache misses or `409` errors until restarted. That process wasn't stopped.
