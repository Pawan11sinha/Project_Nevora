# NÉVORA Cloudflare Workers compatibility report

Updated 5 November 2026, after two redeployments and a CPU limit probe. Audited: the sample test app in `deploy-test/opennext`, and the plans in `docs/`.

Live test Worker: `https://nevora-deploy-test-opennext.<account-subdomain>.workers.dev`, version `ca2b0b7a`. It holds sample data only, with no secrets, KV, R2, Supabase or payment connection, on the Workers Free plan. The temporary CPU probe route and its secret have been removed.

## 1. Verdict

**OpenNext on Workers works in production for the sample app, and cached pages are comfortably within the Free plan. The 10 ms CPU limit is real and enforced, and it remains an unresolved blocker for dynamic ecommerce routes. Production launch is not recommended.**

- **The limit is hard.** A deliberate CPU test got requests killed with `503` and `exceeded resource limits`, almost always at exactly 10 ms of CPU.
- **It isn't a simple cut-off.** Many requests above 10 ms still succeed, so a temporary allowance seems to exist. It can run out, and Cloudflare's docs reviewed here don't explain it.
- **Real rendered pages haven't been killed so far:** they use about 13 ms at p50, with no kills in any recorded run, including 1,600 sustained requests. **The synthetic test at a similar CPU level failed about half the time.** That conflict is unexplained, so the clean result can't be treated as safe.
- **Real database-backed pages are untested.** They're the next test, and they decide this question.

**No paid upgrade is recommended yet.** See section 3 for the evidence and the decision rule.

## 2. How to read this report

| Status | Meaning |
|---|---|
| PASS | The automated test passed |
| FAIL | The test failed, or something required is missing |
| WARNING | Works, but carries a risk or needs attention |
| NOT TESTED | Couldn't be tested yet |

| Evidence level | Meaning |
|---|---|
| **Production** | Ran on Cloudflare's network, on `workers.dev` |
| **Local** | Ran in `workerd` on this Mac, which enforces no production limits |
| **Mock** | As Local, against `tools/mock-supabase.mjs`, a fake Supabase |
| **Build** | From build, type-check, lint or dry-run output |
| **Review** | Read from code or docs, not run |

## 3. Real Worker measurements

### Clean run: CPU and latency measured separately

One request at a time, 1 second apart, 40 rounds over 9 paths. Tail captured all 360 requests.

**Worker CPU and wall time**, from `wrangler tail`. This is what the 10 ms limit applies to.

| Path | What it does | Requests | CPU p50 | CPU p95 | CPU max | Over 10 ms | Wall p50 | Wall p95 | Wall max |
|---|---|---|---|---|---|---|---|---|---|
| `/` | Cached | 42 | 2 | 3 | 5 | 0% | 8 | 11 | 12 |
| `/login` | Cached | 40 | 2 | 3 | 3 | 0% | 7 | 12 | 13 |
| `/account` | `proxy.ts` redirect | 40 | 2 | 54 | 57 | 33% | 2 | 55 | 58 |
| `/api/health` | Route handler | 39 | 5 | 44 | 46 | 23% | 5 | 45 | 47 |
| `/no-such` | 404 | 39 | 5 | 10 | 11 | 3% | 11 | 17 | 19 |
| `/p/sample-1` | Cached, failing revalidation | 40 | 7 | 12 | 13 | 8% | 16 | 24 | 24 |
| `/c/earrings` | Cached, failing revalidation | 40 | 7 | 13 | 14 | 15% | 18 | 25 | 27 |
| `/ssr` | Rendered, 48 products | 40 | **17** | 28 | 28 | **100%** | 20 | 32 | 32 |
| `/p/sample-40` | Rendered on demand | 40 | **18** | 29 | 29 | **100%** | 21 | 33 | 34 |
| **All paths** | | **360** | **6** | **33** | **57** | **31%** | | | |

All values are milliseconds. Tail reports whole milliseconds. Pages don't call a database yet, so database time isn't included.

**Browser latency**, from this Mac in Delhi to Cloudflare's Delhi location. This includes the network, so don't compare it with CPU.

| Path | Requests | First byte p50 | p95 | Max | Complete p50 | p95 | Max | Unexpected responses |
|---|---|---|---|---|---|---|---|---|
| `/` | 40 | 26 | 33 | 34 | 27 | 35 | 35 | 0 |
| `/login` | 40 | 26 | 41 | 170 | 27 | 42 | 170 | 0 |
| `/account` | 40 | 20 | 73 | 76 | 20 | 73 | 76 | 0 |
| `/api/health` | 40 | 22 | 60 | 124 | 23 | 61 | 126 | 0 |
| `/no-such` | 40 | 30 | 44 | 46 | 30 | 45 | 49 | 0 |
| `/p/sample-1` | 40 | 35 | 50 | 62 | 36 | 50 | 64 | 0 |
| `/c/earrings` | 40 | 37 | 45 | 48 | 38 | 46 | 49 | 0 |
| `/ssr` | 40 | 38 | 47 | 50 | 40 | 50 | 51 | 0 |
| `/p/sample-40` | 40 | 40 | 53 | 111 | 41 | 54 | 111 | 0 |

**Error rate:** 0 of 360 unexpected responses (0.00%). Tail outcomes: `ok` 360 of 360. Exceptions: 0.

### Stress run: over the limit, under concurrency

A sustained burst of 800 requests per path, 8 at a time, on `/ssr` and `/p/sample-40`.

| Measure | Result |
|---|---|
| Sustained burst | **1,600 of 1,600 returned 200** |
| `1102` limit errors | 0 in responses checked, and 0 non-`ok` outcomes in 228 sampled events |
| `/ssr` CPU, sampled | p50 28, p95 244, max **279 ms** |
| `/p/sample-40` CPU, sampled | p50 19, p95 172, max 244 ms |

**This isn't a clean per-request figure.** A scripting mistake of mine made 540 paced requests overlap this burst, and their status codes weren't recorded. The sample also covers only some requests. Treat this only as evidence that the Worker kept responding under load.

### Requests sent

| Run | Requests | Statuses recorded | Unexpected | Tail captured |
|---|---|---|---|---|
| First pass | About 980 | 980 | 0 | 86 |
| Stress | About 2,145 | 1,600 | 0 | 228 |
| Clean run | 360 | 360 | 0 | 360 |
| Smoke and browser checks | About 100 | Yes | 0 | Not captured |
| **Total** | **About 3,600** | **About 3,040** | **0** | |

That's about 3.6% of the free 100,000 a day. **This count comes from my scripts, not Cloudflare's usage dashboard, which I can't read.** Please compare it under Workers & Pages, Metrics.

Tail drops events at higher rates, which is why the first two runs captured so little. Only the clean run gives per-request statistics.

### What the first run showed

The rendered pages went over 10 ms with no errors, and category and product pages used about 7 ms because each view failed to revalidate an expired page. The later sections supersede this first run's conclusions.

### Second run: after the fixes

Version `10cca03e`: `revalidate` removed from cached pages, and the malformed-URL guard added. Same method: 360 requests, one at a time, all captured by tail, with 0 unexpected responses.

| Path | CPU p50 before → after | CPU p95 before → after | CPU max before → after | Over 10 ms before → after | Latency p50 before → after |
|---|---|---|---|---|---|
| `/` | 2 → 2 | 3 → 3 | 5 → 3 | 0% → 0% | 27 → 29 |
| `/login` | 2 → 1 | 3 → 2 | 3 → 8 | 0% → 0% | 27 → 29 |
| `/account` | 2 → 1 | 54 → 3 | 57 → 8 | 33% → 0% | 20 → 19 |
| `/api/health` | 5 → 3 | 44 → 5 | 46 → 6 | 23% → 0% | 23 → 22 |
| `/no-such` | 5 → 3 | 10 → 4 | 11 → 5 | 3% → 0% | 30 → 29 |
| `/p/sample-1` | **7 → 1** | 12 → 3 | 13 → 4 | 8% → 0% | 36 → 28 |
| `/c/earrings` | **7 → 1** | 13 → 3 | 14 → 3 | 15% → 0% | 38 → 28 |
| `/ssr` | 17 → 13 | 28 → 24 | 28 → 24 | 100% → 83% | 40 → 37 |
| `/p/sample-40` | 18 → 13 | 29 → 23 | 29 → 24 | 100% → 90% | 41 → 38 |
| **All paths** | **6 → 2** | **33 → 17** | **57 → 24** | **31% → 19%** | |

- **Caused by the fix:** category and product pages. Their failing revalidation is gone, and error logs fell from 120 to 40 per 360 requests. The remaining 40 are `/p/sample-40` trying to write to the read-only cache.
- **Not attributable to the fix:** the smaller changes on paths the fix doesn't touch, such as the `/account` and `/api/health` spikes and the `/ssr` figures. Those are probably normal variation between runs, including how many Worker instances started. Two runs can't separate them.

### CPU limit probe

Temporary route, since removed, running a plain arithmetic loop for a chosen number of iterations. Version `60581661`, with one temporary secret, since deleted.

**One request per second, all captured by tail:**

| Iterations | CPU p50 of successes | Requests | Killed | Kill rate | CPU when killed |
|---|---|---|---|---|---|
| 1 million | 7 ms | 40 | 0 | 0% | |
| 2 million | 11 ms | 40 | 0 | 0% | |
| 3 million | 15 ms | 40 | 19 | **48%** | 10 to 12 ms |
| 4 million | 18 ms | 40 | 31 | **78%** | 10 ms |
| 6 million | 25 ms | 40 | 29 | **73%** | 10 ms |
| 8 million | 34 ms | 40 | 29 | **73%** | 10 ms |

**Sustained, 5 at a time:**

| Iterations | Requests | Limit errors | Rate |
|---|---|---|---|
| 1 million | 300 | 1 | 0.3% |
| 2 million | 300 | 0 | 0% |
| 3 million | 300 | 36 | 12% |
| 4 million | 300 | 78 | 26% |
| 6 million | 300 | 49 | 16% |
| 8 million | 300 | 46 | 15% |

In the first, coarser probe, 50 million iterations failed 20 of 20 when stepped up one at a time, while other requests succeeded at up to 349 ms of CPU. Tail reported those failures as outcome `exceededCpu`.

### Is the 10 ms limit a hard production blocker for dynamic routes?

**Treat it as a blocker until real routes pass. It's not resolved.**

| Question | Answer | Evidence |
|---|---|---|
| Is the limit enforced? | **Yes** | Requests killed at 10 ms, with `503` and `exceededCpu` |
| Can a request exceed 10 ms? | Sometimes | Successes up to 349 ms, but unpredictable |
| Do cached pages risk it? | Very unlikely | p95 of 3 ms |
| Do current rendered pages get killed? | Not so far | 13 ms p50, 0 kills in 40, and 0 limit errors in 1,600 sustained in the earlier version |
| Can that be relied on? | **No** | Similar CPU in the synthetic test failed 48% of the time |
| Why do the two differ? | **Unknown** | The loop is one unbroken stretch of CPU, while rendering yields repeatedly. That's only a hypothesis, and I found no Cloudflare statement of how the allowance works. |
| What about real checkout and account pages? | **Untested** | They add auth, database calls and more rendering |

A kill during checkout would show the customer an error. The order function's transaction protects stock, but the customer wouldn't know whether the order was placed.

**Decision rule, accepted by the owner on 5 November 2026:**

- **Pass on Free:** zero `exceededCpu` kills across at least 1,000 requests per critical route, both paced and sustained, on real pages making real Supabase database calls: logged-in `/account`, `/admin`, checkout action and order page.
- **Fail:** any `exceededCpu` on a critical route. Then the options are reducing that route's CPU and retesting, or Workers Paid at $5 a month, with a default CPU limit of 30 seconds per request, **only with your approval**.

Even a pass only covers the conditions tested, so Workers logs would need watching after launch.

## 4. Your three investigations

### 4.1 Why a cross-origin Server Action returns 500

**Next.js hardcodes it, and the attack is blocked. It's a confusing status, not a security failure.**

- Next.js's `action-handler.js` sets `res.statusCode = 500` with `Invalid Server Actions request.` when the `Origin` doesn't match the host. Its own comment reads: "This seems to be an CSRF attack. We should not proceed the action."
- Evidence: live, the evil origin returned 500 and the same origin returned 200. Under plain `next start`, the evil origin also returned 500, with no action result in the body, so this isn't caused by OpenNext or Workers.
- **Requests with no `Origin` header are allowed through.** Under `next start` the action ran and returned a result. Next's comment says handcrafted requests "can't contain user credentials that haven't been shared willingly". `SameSite=Lax` cookies add protection, but every real action must check login and validate input itself.
- **Recommendation: leave it.** Changing the status would mean copying Next's security check into our own code, for no security gain. These 500s may appear in error counts, so tell them apart using the logged message.

### 4.2 Whether exposing `/BUILD_ID` is intentional and safe

**It's a side effect, and it's safe.**

- OpenNext copies it from `.next/BUILD_ID` in `createAssets.js`, with the comment "BUILD_ID is used by the SST infra". SST isn't used here, so this looks incidental on Cloudflare.
- It reveals nothing new: the same 21-character value also appears in the home page's HTML. It's a build label, not a secret.
- Hiding it works: `public/.assetsignore` containing `BUILD_ID` gave a 404 locally, with all 11 browser checks passing.
- **Recommendation: optional and low priority.** This is tidiness, not security, because the value stays in the page.

### 4.3 Why malformed URLs return 500

**The cause was in Next.js, and it's now fixed on the live Worker.**

- It returned a plain 21-byte `Internal Server Error`, with no stack trace or file path. Under `next start`, dynamic routes behaved the same. Non-dynamic paths returned 404.
- `route-matcher.js` raises `DecodeError` for these, and `base-server.js` converts that error to 400 in three places. These requests evidently reach some other path. **I didn't pinpoint the exact line.**
- **Fix deployed:** `custom-worker.ts` wraps the OpenNext Worker, using OpenNext's documented approach, and checks only paths containing `%`. Live, `/c/%E0%A4%A` and `/p/%FF` now return 400, and `/c/ear%72ings` still returns 200.

## 5. Results by area

Totals for the current code. Local runs use a throwaway copy with test-only routes added.

| Run | Level | PASS | FAIL | WARNING | NOT TESTED |
|---|---|---|---|---|---|
| **Smoke checks on the live Worker** | **Production** | **15** | **0** | **0** | **0** |
| **Browser checks on the live Worker** | **Production** | **11** | **0** | **0** | **0** |
| HTTP checks | Local and Mock | 99 | 0 | 2 | 3 |
| Browser and mock login | Mock | 19 | 0 | 1 | 0 |
| Unit tests | Build | 9 | 0 | 0 | 0 |

The HTTP warnings are `/BUILD_ID` being public and a test-only route with no cache header.

### 5.1 Next.js and OpenNext

| Check | Status | Level | Evidence |
|---|---|---|---|
| Next.js 16.4.5 with OpenNext 1.20.16 | PASS | Production | Deployed and serving |
| Node pinned | PASS | Build | `.nvmrc` at 24, `engines >=24`. Local Node is still 25.2.1. |
| Dependencies | PASS | Build | None added or upgraded, and the lockfile is unchanged |

### 5.2 Build, TypeScript and ESLint

| Check | Status | Level | Evidence |
|---|---|---|---|
| Build, `npm run typecheck`, `npm run lint --max-warnings=0` | PASS | Build | All exit 0. The lint failure is fixed. |
| `npm test` | PASS | Build | 7 of 7, with Node's built-in runner and no new dependency |
| Production dependency vulnerabilities | PASS | Build | 0 at the audit, and dependencies unchanged since |
| Dev dependency vulnerabilities | WARNING | Build | 12 at the audit, all in build tools |

### 5.3 SSR, SSG, routing and 404s

| Check | Status | Level | Evidence |
|---|---|---|---|
| Static, SSG, SSR and on-demand pages | PASS | Production | All 200, with expected content |
| 404 handling | PASS | Production | `/no-such`, `/c/nope` |
| Client navigation | PASS | Production | Browser check |
| Malformed URL | PASS | Production | Now 400. See 4.3. |

### 5.4 Server Actions and API methods

| Check | Status | Level | Evidence |
|---|---|---|---|
| Valid and invalid input | PASS | Production | Browser check |
| Cross-origin rejected | PASS | Production | 500, action not run. See 4.1. |
| Token-protected route | PASS | Production | 403 without a token |
| HTTP methods, unknown action, 1 MB limit | PASS | Local | 405, 409, rejected |

### 5.5 Proxy and the Node.js warning

| Check | Status | Level | Evidence |
|---|---|---|---|
| **`proxy.ts` on Workers** | **PASS, with a WARNING** | **Production** | Redirects work live, with 0 errors in 40 clean requests. The experimental build warning remains. |
| Redirects | PASS | Production | `/admin` and `/account` return 307 to the right login |
| 11 bypass attempts | PASS | Local | No protected content returned |
| Skips public pages | PASS | Mock | 0 auth calls |

**Decision: keep `proxy.ts`.** Next.js says `middleware.ts` "is deprecated and will be removed in a future version", and Supabase's guide is built around `proxy.ts`. The earlier recommendation to switch was withdrawn. Pages and actions check login and role themselves. Compressed Worker size with `proxy.ts` is about 1.5 MiB, and the OpenNext tracker has an open issue about `proxy.ts` bundle size, so keep watching it.

### 5.6 Cookies, sessions and authentication

| Check | Status | Level | Evidence |
|---|---|---|---|
| `HttpOnly`, `Secure`, `SameSite=Lax` | PASS | Mock | Cookie attributes confirmed in the browser |
| Login, logout, tampered cookie, wrong password | PASS | Mock | |
| Customer blocked from admin, admin allowed | PASS | Mock | Server-side role check |
| Token refresh | PASS | Mock | 1 refresh per page view |
| Parallel requests near expiry | WARNING | Mock | 5 requests made 5 refreshes. Supabase revokes a session on some refresh token reuse, so **this must be tested on real Supabase**. |
| `getUser` or `getClaims` | WARNING | Review | Supabase recommends `getClaims` to protect pages. Not changed, because it can't be tested without real Supabase. |
| **Real Supabase auth, and `Secure` cookies on HTTPS** | **NOT TESTED** | None | Supabase isn't connected, so no login was possible on the live Worker |
| Signup | FAIL | Review | Not implemented. Needs Resend and a domain. |

`HttpOnly` is deliberate. Supabase calls it "not necessary" because a browser client must read the cookies, and this design has no browser client. Adding one later means removing it.

### 5.7 Static assets, images and fonts

| Check | Status | Level | Evidence |
|---|---|---|---|
| Asset caching | PASS | Production | `public, max-age=31536000, immutable`, `cf-cache-status: HIT`, `content-encoding: br`. The failure is fixed. |
| Sample images | PASS | Production | `max-age=86400`, HIT, `nosniff` |
| Fonts self-hosted | PASS | Production | Heading font loads, with no failed requests |
| Sensitive files | PASS | Production | `.env`, `wrangler.jsonc` return 404 |
| `/BUILD_ID` | WARNING | Production | Public and safe. See 4.2. |
| R2, custom domain, real photos | NOT TESTED | None | Off, as instructed |

### 5.8 Caching, ISR and invalidation

| Check | Status | Level | Evidence |
|---|---|---|---|
| Prerendered pages served from cache | PASS | Production | `x-opennext-cache: HIT` on `/` |
| Compressed page size | PASS | Production | `/` 3.8 KB, `/c/earrings` 3.2 KB, `/ssr` 4.5 KB |
| **On-demand pages are never cached** | **FAIL** | **Production** | `/p/sample-40` was over 10 ms on 90% of requests in the second run. The read-only cache can't store it, and logs an error each time. |
| ISR errors | PASS | Production | `revalidate` removed, so the `Dummy queue` errors are gone. Pages now refresh only on redeploy. |
| KV caching | NOT TESTED | None | Off, as instructed. Approved for a later isolated test, after Supabase. Local result earlier: 13.3 to 2.5 ms for on-demand pages. |

**Without KV, updating catalogue pages needs a redeploy, or a render on each request at about 18 ms.** A decision for the next stage.

### 5.9 Bindings, environment and size

| Check | Status | Level | Evidence |
|---|---|---|---|
| Deployed on Free | PASS | Production | `Total Upload: 7487.79 KiB / gzip: 1557.62 KiB`. Accepted by Cloudflare. |
| Startup limit | PASS | Production | Deploy accepted, and the first request took 49 ms |
| Minimum environment | PASS | Production | The temporary secret was deleted, and `wrangler secret list` returns `[]`. Bindings are only `ASSETS` and `WORKER_SELF_REFERENCE`. |
| Temporary probe route removed | PASS | Production | `/api/cpu-probe` returns 404, with or without the old token |
| Secrets in code or git | PASS | Build | Token scan found 0 files. `.env.test` confirmed ignored. |
| `wrangler secret` values reaching code | NOT TESTED | None | None configured. Passed locally through `.dev.vars`. |

### 5.10 CPU, memory and request size

| Check | Status | Level | Evidence |
|---|---|---|---|
| **CPU on cached pages** | **PASS** | **Production** | p95 3 ms on `/` |
| **CPU limit enforced** | **FAIL for heavy work** | **Production** | Killed at about 10 ms with `exceededCpu`. See section 3. |
| **CPU on rendered pages** | **WARNING** | **Production** | p50 13 ms, over the limit, with no kills so far |
| Sustained load | PASS | Production | 1,600 of 1,600 returned 200 |
| CPU with a real database | NOT TESTED | None | Needs Supabase |
| Memory against 128 MB | NOT TESTED | None | No test route on the live Worker, and no errors seen |
| Request body limits in production | NOT TESTED | None | Local only |

### 5.11 Security, validation and errors

| Check | Status | Level | Evidence |
|---|---|---|---|
| Security headers | PASS | Production | CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy on `/` |
| `X-Powered-By` | PASS | Local | Absent. Not rechecked on a dynamic page live. |
| CSP strength | WARNING | Review | Needs `'unsafe-inline'` for scripts, because nonces would stop pages being cached |
| Database errors hidden | PASS | Local | Generic message after the fix |
| Login validation, open redirect | PASS | Build | Zod schema, unit tests |
| Error pages | PASS | Build | `error.tsx` and `global-error.tsx` added. Not seen rendering on the live Worker. |
| Rate limiting | FAIL | Review | Not built. Planned for the store. |
| Real RLS | NOT TESTED | None | Needs Supabase |

### 5.12 Logging, monitoring and deployment

| Check | Status | Level | Evidence |
|---|---|---|---|
| `wrangler tail` | PASS | Production | Provides CPU, wall time, outcome and logs. Drops events at higher rates. |
| Personal data in logs | WARNING | Production | Tail events include visitor IP addresses. Raw logs stayed in a temporary folder and aren't in the repo or this report. |
| Workers Logs in the dashboard | NOT TESTED | None | Enabled, but I can't view the dashboard |
| Error tracking and alerts | FAIL | Review | None. Cloudflare's billing alerts need a Professional plan or higher. Weekly manual check remains the plan. |
| Git and GitHub readiness | PASS | Build | Local repo. Nothing uploaded. `novero_chat.md` removed from history. |
| CI | NOT TESTED | Review | `.github/workflows/ci.yml` written, with no secrets and no deploy. It only runs once on GitHub. |
| Rollback | NOT TESTED | None | Available through `wrangler rollback`, not exercised |

## 6. Free-tier estimates at 50,000 visits a month

Assumes 4 pages per visit, or 200,000 page views, with about 1 Worker request per page view, as measured earlier in the browser. Bot traffic and checkout are excluded. All are estimates.

| Resource | Estimated use | Free limit | Status |
|---|---|---|---|
| Worker requests | About 6,700 a day | 100,000 a day, resets 5:30 am IST | PASS. About 15 times an average day before Error 1027. |
| CPU, cached pages | About 1 to 2 ms | 10 ms | PASS |
| CPU, rendered pages | About 13 ms | 10 ms | **WARNING: over a limit that is enforced, with no kills so far** |
| Static assets | Not counted | Free and unlimited | PASS |
| KV writes, if enabled | 5,760 a day at 5-minute revalidate, about 20 to 100 with long revalidate | 1,000 a day | Use the long setting |
| Supabase egress | Low with caching | 5 GB a month | NOT TESTED |
| Resend | About 3 emails per order | 100 a day, 3,000 a month | About 33 orders in a day hits the limit |

| Stage | Monthly cost | Trigger |
|---|---|---|
| All free | ₹0 | Current state |
| Workers Paid | $5, about ₹450 | A critical route fails the decision rule, or requests pass documented triggers. **Your approval is needed first.** |
| Add Supabase Pro | Add $25 | Steady orders, for backups and no pausing |
| Add Resend Pro | Add $20 | Over 70 emails a day |

Rupee figures assume about ₹90 to the dollar. A domain is about ₹1,000 a year, as an estimate.

## 7. Is Workers Free suitable?

**Yes for testing and for cached catalogue pages. Not established for dynamic ecommerce routes.**

- **The case for it:** cached pages use about 1 to 2 ms, all recorded real-page requests succeeded, and the request allowance has plenty of room.
- **The case against it:** the 10 ms limit is enforced, and account, checkout and admin pages must render on demand with database work on top.
- **Next:** apply the decision rule in section 3 on real routes. No upgrade is recommended before that.

## 8. Can the architecture support each feature?

No feature below exists as store code yet.

| Feature | Design | Evidence | Status | What's missing |
|---|---|---|---|---|
| Customer signup and login | Yes | Login and session pass on Mock | WARNING | Signup, real Supabase, Resend, domain |
| Admin dashboard | Yes | Separate login and role check pass on Mock. Redirects pass live. | WARNING | Screens, real RLS |
| Product and category management | Yes | No KV means updates need a redeploy or per-request rendering | WARNING | KV decision, database, admin screens, R2 upload |
| Shopping cart | Yes | Client components hydrate live | PASS on design | Cart code |
| Checkout | Yes | Server actions work live. Race safety untested. | NOT TESTED | `create_order`, real database, CPU check |
| Prepaid and COD advance | Yes | Manual verification needs no gateway | NOT TESTED | `record_payment`, admin screens, UPI settings |
| Product reviews | Yes, post-launch | | NOT TESTED | Tables, moderation, cache plan |
| AI shopping assistant | Yes, post-launch | | NOT TESTED | Streaming and CPU test, API costs, rate limits |

## 9. Remaining production blockers

1. **Supabase isn't connected:** real auth, RLS, session refresh, stock concurrency, backup and restore, and database CPU are all untested.
2. **The 10 ms limit is enforced, and rendered pages exceed it.** Critical dynamic routes must pass the decision rule in section 3.
3. **Catalogue updates have no answer without KV:** ISR can't refresh with the read-only cache.
4. **The store doesn't exist yet:** expected at this stage.
5. **Protections not built yet:** rate limiting, automated backups, and error tracking.
6. **Images and email depend on the domain,** and R2 may need a card.
7. **Open business checks:** trademark, and the CA's review of the ₹1,200 compliance placeholder.

## 10. Recommended next steps

| # | Step | Status |
|---|---|---|
| 1 | Create the Supabase test project | Waiting for you, once you've reviewed the setup |
| 2 | Run `tools/supabase-test.mjs`, then add signup and database pages to the test app and measure real routes against the decision rule | Next |
| 3 | Test KV in isolation: invalidation, price changes, stock updates, refresh and write limits | Approved, after Supabase |
| 4 | Consolidated report, including the 10 ms answer | After those |
| 5 | Push to private GitHub | Waiting for your review of the file list |

## 11. Private GitHub setup

Nothing has been uploaded, and the push waits for your approval of the file list. The GitHub CLI isn't installed here.

Checks done on all tracked files and full history:

- `novero_chat.md` is excluded, and was removed from local history. It remains on your computer.
- All `.env` files are ignored, except `.env.example`, which holds no values. `.env.test` is ignored.
- No API keys, tokens or passwords found. The test token isn't in any commit.
- No supplier phone numbers or names found, other than the generic market names "Sadar Bazaar" and "Chandni Chowk" in the roadmap.
- The only phone-like value is the fake test number `9876543210`.
- Your account subdomain was replaced with a placeholder in this report and in history.
- Commits use your GitHub no-reply address, and the personal email doesn't appear.

When approved:

1. On https://github.com/new, create a **Private** repository named `nevora-store`, with no README, licence or `.gitignore`.
2. Run:

```bash
cd ~/Desktop/Project_Nevora
git remote add origin git@github.com:<your-username>/nevora-store.git
git push -u origin main
```

Use the HTTPS address GitHub shows you if SSH isn't set up.

## 12. How to rerun

```bash
cd ~/Desktop/Project_Nevora/deploy-test/opennext
npm run typecheck && npm run lint && npm test
npx opennextjs-cloudflare build
npx opennextjs-cloudflare deploy
```

```bash
cd ~/Desktop/Project_Nevora/deploy-test
B=https://nevora-deploy-test-opennext.<account-subdomain>.workers.dev
node tools/smoke.mjs $B 3
node tools/browser.mjs $B
# Clean CPU run. In one terminal:
(cd opennext && npx wrangler tail nevora-deploy-test-opennext --format json > /tmp/tail.log)
# In another:
node tools/measure-paced.mjs $B 40 /tmp/client.json
# After stopping tail:
node tools/report-live.mjs /tmp/tail.log /tmp/client.json
```

`tools/audit-*.mjs`, `tools/cpu-probe*.mjs`, `tools/mock-supabase.mjs` and `audit-overlay/` run only against a local throwaway copy. The overlay adds test-only routes, including the CPU probe, and must never be copied into the store.

## 13. Limits of this evidence

- One location (Delhi), one short session, and sample data with no database.
- Tail reports whole milliseconds, and captures only some events at higher rates.
- Cold starts weren't isolated. The spikes are only probably cold starts.
- Requests in the stress run overlapped, as explained in section 3.
- Each measured run used one fixed version. The probe route ran only in version `60581661`, and was removed afterwards.
- The probe uses synthetic CPU, which may not behave like real rendering.
- About 6,800 test requests in total today, across all runs, by my scripts' count.
