# Phase 1a deployment test

A temporary test of Next.js on Cloudflare Workers Free, comparing OpenNext and vinext. It uses sample data and has no shop features. Delete this folder and its test accounts' resources after the decision.

- `opennext/` and `vinext/`: the same test app under each adapter
- `tools/`: test scripts
- `supabase-test.sql`: test table and functions
- `RESULTS.md`: results so far

## What the owner sets up

None of this needs a domain or a payment card. **If either site asks for a card, stop and check first.**

### 1. Cloudflare account

1. Sign up at https://dash.cloudflare.com/sign-up with the email you want for the business, and turn on two-factor login.
2. Don't add a domain, buy a plan or enable R2.
3. In a terminal, log in. A browser window opens for you to approve it:

```bash
cd ~/Desktop/Project_Nevora/deploy-test/opennext
npx wrangler login
npx wrangler whoami
```

### 2. Supabase test project

1. Sign up at https://supabase.com/dashboard, and create a Free organisation.
2. Create a project named `nevora-deploy-test`, with region **South Asia (Mumbai)** if offered. If Mumbai isn't offered, note that and choose the closest region.
3. Save the database password in a password manager. Don't paste it into a chat, or into any file here.
4. Open **SQL Editor**, paste in all of `deploy-test/supabase-test.sql`, and press **Run**.
5. Open **Authentication, Users, Add user, Create new user**, and make two test users with "Auto Confirm User" ticked:
   - `test-customer@example.com`
   - `test-admin@example.com`
6. In the SQL Editor, make the second one an admin:

```sql
insert into public.deploy_test_admins (user_id)
select id from auth.users where email = 'test-admin@example.com';
```

### 3. Add the two values

Open `deploy-test/.env.test` and fill in the two blank lines, from the project's **Connect** panel or **Settings, API Keys**:

- `SUPABASE_URL`: the Project URL
- `SUPABASE_PUBLISHABLE_KEY`: the **publishable** key. Never use the secret or `service_role` key here.

Leave `DEPLOY_TEST_TOKEN` as it is. Don't paste these values into chat.

### Not needed yet

- **GitHub:** needed from Phase 1b, for the store's code and backup job.
- **Resend and the domain:** needed for real email later. Not part of this test.
- **R2:** its signup may need a card, so that test waits for your approval.

## What happens after setup

Tell Claude setup is done. Claude then:

1. Deploys both apps to free `workers.dev` addresses and sets their values.
2. Runs `tools/smoke.mjs`, `tools/browser.mjs` and `tools/race.mjs` against the live Workers.
3. Records real CPU per request with `wrangler tail` and `tools/cpu-report.mjs`.
4. Tests ISR with a free KV namespace, and login with the two test users.
5. Writes up results and estimated cost in `RESULTS.md`, then waits for your decision. No paid plan is used.

## Supabase recovery test

The owner runs these, because they use the database password.

1. **Pause and resume:** Project Settings, General, Pause project. Then Resume project from the dashboard. Time how long it takes to return.
2. **Backup and restore:** needs `pg_dump` and `psql`, or Docker, and neither is installed on this Mac. Claude will give exact commands once the tool choice is approved.

## Clean-up after the decision

- Delete both test Workers and any KV namespace: `npx wrangler delete --name <worker>`
- Delete the `nevora-deploy-test` Supabase project, which frees a free-plan slot
- Delete this folder, including `.env.test`
