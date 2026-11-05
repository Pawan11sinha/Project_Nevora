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

This is a separate Free project for testing only. Never put real customer information in it. **Confirm email stays on.**

**Check you're in the right project.** Everything below applies only to the project open in the dashboard. Each Supabase project has its own database, so this can't reach any other project. The address bar should show the same project ref as `SUPABASE_URL` in `opennext/.dev.vars`.

1. Open **SQL Editor**, paste in all of `deploy-test/supabase-test.sql`, and press **Run**. Supabase may warn about a destructive operation, because of the `drop trigger` and `drop policy` lines that replace this file's own test objects.
2. Open **Authentication, Users, Add user, Create new user**, and create these three users. Tick **Auto Confirm User** for each, and use one new throwaway password that you don't use anywhere else.
   - `nevora-test-customer-a@example.com`
   - `nevora-test-customer-b@example.com`
   - `nevora-test-admin@example.com`

   Auto Confirm confirms the account without sending an email, and Confirm email stays on for everyone else. Built-in email only reaches project team members, so these addresses could never receive one.
3. In the SQL Editor, make the admin user an admin:

```sql
update public.deploy_test_profiles
set role = 'admin'
where id = (select id from auth.users where email = 'nevora-test-admin@example.com');
```

4. Check the result. All three should show `confirmed = true`, with `admin` for the admin user and `customer` for the other two:

```sql
select u.email, u.email_confirmed_at is not null as confirmed, p.role
from auth.users u
left join public.deploy_test_profiles p on p.id = u.id
where u.email like 'nevora-test-%@example.com'
order by u.email;
```

**If a user shows `confirmed = false`:** delete it under **Authentication, Users**, and add it again with Auto Confirm ticked. Don't edit `auth.users` directly.

### 3. Add the values

Don't paste any of these into chat. Both files are gitignored.

**`deploy-test/opennext/.dev.vars`:**

- `SUPABASE_URL`: the Project URL, from the **Connect** panel or **Settings, API Keys**
- `SUPABASE_PUBLISHABLE_KEY`: the **publishable** key. Never use the secret or `service_role` key here.

**Don't use `.env.local`.** OpenNext compiles `.env`, `.env.local` and `.env.production` into the Worker bundle, so a later deploy would upload their values. `npm test` fails if one of them exists.

**`deploy-test/.env.test`:**

- `TEST_PASSWORD=` the throwaway password from step 2

Leave `DEPLOY_TEST_TOKEN` as it is.

### Optional: real signup and email verification

This is the only way to test a real confirmation email until Resend and a domain exist. It uses your own address, and doesn't change the project's settings.

- Add `TEST_SIGNUP_EMAIL=` your Supabase account email, and `TEST_SIGNUP_PASSWORD=` another throwaway password, to `deploy-test/.env.test`.
- The test script signs up once, and checks that login is blocked until you click the link in the email.
- Built-in email sends about 2 messages an hour, and only to project team members.

## Undoing the setup

Run `deploy-test/supabase-test-rollback.sql` in the SQL Editor of the same project. It removes all `deploy_test_` objects and their data, with the trigger first. Test users remain until you delete them under **Authentication, Users**, or use the commented lines in that file for the `nevora-test-` users. A user from the optional signup must be deleted in the dashboard. No project settings need restoring. Deleting the whole test project also removes everything.

### Not needed yet

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
