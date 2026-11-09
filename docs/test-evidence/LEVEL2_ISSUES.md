# Level 2 issue record

Local Supabase native-runtime validation, 7 November 2026. Tests ran on throwaway local stacks using Supabase CLI 3.0.0, Auth v2.197.0-r0 and Storage v1.88.0-r0. Nothing here was tested on hosted Supabase, and none of these results shows production readiness.

Evidence:
- `level2/`: original partial run. Run 1 used lazy start and run 2 used `--eager`, both with Analytics on.
- `level2-corrected/`: corrected run. Run A used `--eager` and run B used lazy start, both with `--exclude analytics`.
- `level2-sql/`: `pg_cron`, `test db`, and dump and restore tests, on a disposable stack with Analytics excluded.
- `level2-mg1/`: throwaway migration and reset test, on a separate disposable stack with Analytics excluded.

Original failures stay on record below and in the evidence files. A later status doesn't replace them.

**Overall:** every planned local test now has a passing result, but Level 2 isn't complete. The hosted PostgreSQL version comparison is pending (local is 17.11), and DEF-6 is open. C1 hasn't started.

## Status

| ID | Status | Summary |
|---|---|---|
| DEF-1 | Fixed | Test script used a flag the CLI rejects |
| DEF-2 | Closed: test error | Reuse of a parent refresh token is documented behaviour |
| DEF-3 | Corrected findings recorded | The newest token is rejected 11 seconds after reuse is detected; the remaining gap is DEF-6 |
| DEF-4 | Closed with qualification | Outbound connection from Analytics' `tzdata`, avoided by excluding Analytics; traffic never directly captured |
| DEF-5 | Closed: expected behaviour | The CLI removes empty destroyed-stack folders |
| DEF-6 | **Fixed locally (8 Nov 2026); hosted verification pending** | After reuse was detected, the newest token still worked for a short window and old access tokens still passed `getUser()`. Fixed with a zero reuse interval, a trigger that ends dead sessions and a live-session check. |

## DEF-1: status command flag (fixed)

**Original result:** `status -o json` exited 1, because CLI 3.0.0 rejects the legacy flag for this command.

**Fix:** the test helper now uses `--output-format json`. This changed only the test script. The full suite then reran on an empty stack.

## DEF-2: old refresh token still worked (closed, test error)

**Original result:** AU5 failed in `level2/` runs 1, 1b and 2. An old refresh token returned HTTP 200 after 11 seconds. The expected result was rejection.

**Finding:** the expectation was wrong. Supabase's sessions guide documents this exception: "If the parent of the currently active refresh token for the user's session is being used, the active token will be returned." It has no time limit, and exists for clients that never received the refresh response.

**Corrected test:** AU5 expects the current token back. It passed in runs A and B.

**Residual risk:** someone holding a just-replaced token can still get the session until the replacement is used. This is why cookies and request bodies must never be logged.

## DEF-3: reuse didn't revoke the newest token (corrected findings)

**Original result:** AU5c failed in `level2/` runs 1b and 2. After an older token was rejected with `refresh_token_already_used`, the newest token still returned HTTP 200.

**Investigation:** the expectation came from the sessions guide: "the whole session is regarded as terminated and all refresh tokens belonging to it are marked as revoked." The original check sent the newest token immediately after detection. From reading the v2.197.0 source:
1. Detection revokes the session's tokens and sets `updated_at = now()`.
2. That timestamp restarts the 10-second reuse interval for the newest token.

**Corrected findings, runs A and B:**

| Test | Result |
|---|---|
| AU5b: older token, once its child has rotated, after 11 s | Rejected with `refresh_token_already_used` |
| AU5c: newest token, 11 s after detection | Rejected with `refresh_token_already_used` |
| Newest token, immediately after detection | HTTP 200, new session token issued. Recorded as an information line, and carried to DEF-6 |

**Not verified:** that the cached binary matches the source tag exactly, and which token version the local stack uses.

## DEF-4: outbound connection (closed with qualification)

**Original result:** in `level2/` run 2, `beam.smp` held one connection from this Mac to `104.18.24.232:443` for 20 samples. RT3 failed. Run 1 recorded none, but Analytics and Realtime never started in that run.

**Evidence that it was Analytics' `tzdata` check:**
- `data.iana.org` resolved to that exact IP. It was the only hostname found in Analytics' and Realtime's compiled code that did.
- Only the `tzdata` library references that host. It's in Analytics and not in Realtime, and its `autoupdate` default is `enabled`.
- `tzdata`'s `latest_remote_poll.txt` was rewritten at 11:31:57, 2 seconds after run 2's start finished.
- With Analytics excluded, runs A and B recorded no outbound samples and the poll file wasn't rewritten.

**Qualification:** Analytics was excluded, and its traffic was **not directly captured**. The contents of that connection were never observed. The conclusion that it carries no project data comes from reading the library's constants and strings, so this doesn't show the connection was harmless.

**Limits of the clean result:** the watch sampled TCP once a second for a few minutes. It could miss a very short connection, UDP traffic, or a check at another time. Realtime, Studio and Functions were awake only in run A.

**Correction to an earlier report:** RT4 compared file names and sizes only, so "no downloads" wasn't justified. Treat RT4 in `level2/` run 2 as failed, because the poll file was rewritten at the same size. Level 1's "cache identical" result can't rule out a download either. `release_ets/2026f.v2.ets` appeared at 02:07:03 during Level 1, and a download from IANA is the likely but unconfirmed source. The corrected RT4 compares content hashes, and they were identical across 35,022 files.

**Local working rule until decided otherwise:** keep Analytics excluded. With it on, a stack can contact IANA and may write to the cache.

## DEF-5: empty Level 1 stack folder removed (closed, expected)

**Original observation:** the empty `9fe68da1…` folder disappeared when the Level 2 stack started, despite the decision to leave it untouched.

**Finding:** the CLI's `pruneDestroyed` step, at the end of its orphan sweep, removes a stack folder only if it isn't the current stack, its only entry is an empty `data` folder, and it's at least 10 minutes old. No data was lost. The same thing happened to the empty `63ad65ef…` folder when the corrected run started.

**Consequence:** empty stack folders can't be kept while the CLI starts other stacks. The orphan sweep's handling of other stacks wasn't read, so a `store/` stack shouldn't run alongside a throwaway one until it's checked.

## DEF-6: gap after reuse detection (fixed locally; hosted verification pending)

**Reproduced in runs A and B:**

| Check | Result |
|---|---|
| Newest refresh token, immediately after reuse is detected | HTTP 200, new session token issued |
| Access token issued before detection, checked with `getUser()` after it | HTTP 200 |

**Why it matters:**
- The documented session termination isn't immediate. The source points to a 10-second window, though its exact length wasn't measured.
- `getUser()` alone can't catch a detected token theft.
- `require_admin_session()` may not catch it either if it only checks that the session row exists.
- An old access token could keep working until it expires, up to 1 hour with the current `jwt_expiry`.

**Design inputs, to be tested in C1 and app integration:**
- Decide the admin access token lifetime.
- Define what happens when a refresh fails.
- Test `require_admin_session()` against this exact sequence.
- Decide deliberately whether customer pages showing orders or addresses use `getUser()`.
- Inactivity limits and time-boxed sessions are Pro-only features, so they need app-level handling or a separately approved upgrade.

**Not known:** whether hosted Supabase behaves the same, how long a session revived in the window lasts, and whether Supabase regards this as a defect. Reporting it to Supabase is a separate decision, best made after a hosted check.

**Must be resolved before:** real customer or admin sessions.

### Root cause (investigated 8 Nov 2026, disposable local stacks, CLI 3.0.0)

Reproduced with the store's settings at the time (`refresh_token_reuse_interval = 10`, `jwt_expiry = 3600`):
- **The reuse interval causes the revival window, and more.** Supabase accepts any refresh token revoked within the last 10 seconds. Detection revokes the tokens with a fresh timestamp, so the newest token is accepted again and revives the session (part a). The same rule let a just-replaced token mint a **second active token, forking the session with no detection**: a thief racing the owner within 10 seconds is never noticed.
- **Detection keeps the session row.** It revokes every refresh token but leaves `auth.sessions` in place, and `getUser()` and Auth's `/user` endpoint only check that the row exists. So access tokens issued before detection kept working until they expired (part b), on Auth's own endpoints too. Sign-out deletes the row, which is why it doesn't have this gap.
- **Concurrency doesn't need the interval.** Supabase's parent rule (DEF-2: reusing the parent of the current token returns the current token) covers retries after a lost response and concurrent requests carrying one token: 6 at once all succeeded with interval 0.

### Fix (in `store/`, draft; nothing hosted)

| Layer | Change |
|---|---|
| Config | `refresh_token_reuse_interval = 0`: no forks and no revival. `jwt_expiry = 900`: an access token from an ended session is usable for at most 15 minutes anywhere the checks below don't reach. |
| Database | `20261108220000_session_liveness.sql`: a deferred constraint trigger on `auth.refresh_tokens` deletes a session that ends a transaction with no active refresh token (what reuse detection leaves), exactly as sign-out does. Normal rotation revokes and inserts in one transaction, so it never fires. `current_session_is_live()` checks the caller's own session independently of the trigger, and the profile RLS policies require it. |
| App | `getLiveCustomer()` (`getUser()`, then the live-session check) guards the account page and every account action. An ended session's cookies are cleared by `/auth/session-ended`, which never signs out a live session. V1 password recovery is deferred; a deliberate sign-out ends the current session. |

### Evidence after the fix

| Case | Before | After |
|---|---|---|
| Newest token immediately after detection | 200, session revived | 400 |
| Access token issued before detection, `getUser()` | 200 | 403 |
| Just-replaced token reused within 10 s | 200, second active token (fork) | 400, session ended |
| Retry with the previous token (lost response) | 200 | 200 |
| 6 concurrent refreshes with one token | 200, one token | 200, one token |
| A token and its parent refreshed at the same moment | Forked | One active token, or the session ends; never a fork |

Tests: `store/supabase/tests/session_liveness_test.sql` (17 pgTAP checks), and the DEF-6 section of `store/scripts/check-auth.mjs` through the app on the OpenNext preview: theft detected on either side, concurrent requests, three tabs, retries, replay of an older cookie, and sign-out. The earlier password-reset session-revocation test belonged to the superseded email-recovery flow and is not part of V1.

### What remains

- **Hosted verification:** the hosted project must use the same two settings, and it must be checked that the trigger can be created on `auth.refresh_tokens`, which Supabase owns. Locally `postgres`, which isn't a superuser there, created it. If the platform forbids it, the live-session check still protects the store's pages and customer data in RLS, but Auth's own endpoints would accept an ended session's access token for up to 15 minutes.
- **Undetectable theft is unchanged (DEF-2):** because of the parent rule, a thief using a stolen token that's still current, or one step old, shares the session undetected. Detection only catches older tokens. Session cookies are HttpOnly and never logged; a sign-out ends the session. Password recovery remains a V2 item.
- **Cost of interval 0:** if two requests refresh a token and its parent at the same moment, the session may end and the customer signs in again. It didn't happen in the concurrency tests, because a refreshed access token is valid for 15 minutes.
- **Admin:** `require_admin_session()` should also require `current_session_is_live()` when C1 builds it.

## Related checks that passed in the corrected run

AU5, AU5b, AU5c and AU10 (`aal2` survives a token refresh) passed in runs A and B, along with the other Storage, Auth and persistence tests. These passes show only that those behaviours worked on a local throwaway stack.

## Storage `0.0.0` diagnostic (explained)

`/storage/v1/version` returned `0.0.0` in every run, while the CLI resolved Storage as `v1.88.0`. Storage's code uses its `VERSION` variable or falls back to `0.0.0`, and the running process had no such variable. The endpoint can't confirm the version, so the `v1.88.0` identity rests on the lock file and cache path. Storage's upload, access, signed-URL, limit and deletion tests passed regardless.

## SQL-dependent tests and MG1

These ran after the issues above, each on its own disposable stack, using a helper that refused any target except that stack on `127.0.0.1`. PostgreSQL was 17.11. The network watch recorded no outbound samples.

| Test | Result | Evidence |
|---|---|---|
| CR1: create `pg_cron` and schedule `select 1` | Passed | Extension created, job 1 scheduled |
| CR2: job runs | Passed | `succeeded` after 31 seconds |
| CR3: unschedule | Passed | No later runs in 70 seconds |
| TD1: `test db` with a passing file | Passed | Exit 0, 2 tests pass |
| TD2: `test db` with a deliberately failing file | Passed, as expected | Exit 1, and the failure was reported. A false assertion failing is the correct result. |
| DP1: dumps | Passed | Exit 0 for full schema, marker schema and marker data. Marker schema and row present. |
| DP2: restore | Passed, **marker schema only** | Same row in `level2_restore` as in the source |
| MG1: throwaway migration and reset | Passed | `migration up` applied the table. After `db reset`, the table was rebuilt, the marker row was gone (count 0), and migration history was correct. |

**Limits:**
- **Simple tests:** one cron run, trivial pgTAP files and a one-table migration. They show the tools work on this Mac, not that the NÉVORA schema, the three-role design or any payment rule will.
- **DP2:** it restored one small schema into a separate local database. It isn't a backup or restore proof, and didn't cover Auth, Storage or a whole database. Restore on the hosted platform stays with Phase F.
- **`pg_cron`:** this says nothing about scheduler reliability over time, or on hosted Supabase.
- **`test db`:** the CLI installed and removed `pgtap` itself, and the test files themselves don't create it.
- **`migration list`:** its `remote` column here refers to the local database. Nothing hosted was contacted.
- **Network watch:** same limits as under DEF-4.
- **Config:** these stacks used a throwaway config with Confirm email and TOTP on and Analytics excluded. `store/supabase/config.toml` wasn't used or changed.

**Additions to the planned SQL, all on disposable stacks:**
- Target checks and a schema-absence query.
- `start_time` added to the cron status query, so CR3 could compare runs.
- Three dump files instead of one, because the row comparison needs data as well as schema.
- For MG1: a separate stack with the migration added after start, plus `migration up`, `migration list`, existence and count checks, a history query and one marker row.
