-- Customer profiles: created by trigger with role 'customer' whatever the signup metadata says, readable and editable
-- only by their owner (full_name and phone only), invisible to signed-out visitors, and kept in step with Auth.
--   npm run -s supabase -- --workdir <disposable stack> test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

-- Two customers. The second tries to make itself an admin through signup metadata and gives a non-Google avatar.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'asha@example.test', '{"full_name": "Asha Rao"}'),
  ('22222222-2222-2222-2222-222222222222', 'meera@example.test', '{"name": "Meera Iyer", "role": "admin", "picture": "https://evil.example/x.png"}');

select is((select count(*)::int from public.profiles where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')), 2, 'a profile is created for each new auth user');
select is((select role from public.profiles where id = '22222222-2222-2222-2222-222222222222'), 'customer', 'signup metadata never sets the role');
select is((select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 'Asha Rao', 'full_name comes from signup metadata');
select is((select full_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'), 'Meera Iyer', 'Google''s name is used when full_name is absent');
select is((select email from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 'asha@example.test', 'the email is copied');
select is((select avatar_url from public.profiles where id = '22222222-2222-2222-2222-222222222222'), null, 'a non-Google avatar URL is dropped');

-- A Google identity linked later fills the missing picture, but never replaces the name.
update auth.users set raw_user_meta_data = raw_user_meta_data || '{"avatar_url": "https://lh3.googleusercontent.com/a/abc", "full_name": "Other Name"}'
  where id = '11111111-1111-1111-1111-111111111111';
select is((select avatar_url from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 'https://lh3.googleusercontent.com/a/abc', 'a linked Google picture fills the empty avatar');
select is((select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 'Asha Rao', 'linking never replaces an existing name');

update auth.users set email = 'asha.new@example.test' where id = '11111111-1111-1111-1111-111111111111';
select is((select email from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 'asha.new@example.test', 'an email change is copied');

-- A live session for Asha: the profile policies also require one (DEF-6, 20261108220000_session_liveness.sql).
insert into auth.sessions (id, user_id) values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111');
insert into auth.refresh_tokens (token, user_id, session_id, revoked) values ('asha-live-token', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', false);

-- Signed out: nothing.
set local role anon;
select throws_ok('select * from public.profiles', '42501', null, 'signed-out visitors can''t read profiles');
reset role;

-- Signed in as Asha.
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated", "session_id": "aaaaaaaa-0000-0000-0000-000000000001"}';
select is((select count(*)::int from public.profiles), 1, 'a customer sees only one profile');
select is((select id::text from public.profiles), '11111111-1111-1111-1111-111111111111', '... their own');

update public.profiles set full_name = 'Asha R', phone = '9876543210' where id = '11111111-1111-1111-1111-111111111111';
select is((select full_name || ' ' || phone from public.profiles), 'Asha R 9876543210', 'a customer updates their own name and phone');

update public.profiles set full_name = 'Hijacked' where id = '22222222-2222-2222-2222-222222222222';
select is((select count(*)::int from public.profiles where full_name = 'Hijacked'), 0, 'updating another customer''s profile changes nothing');

select throws_ok($$update public.profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111'$$, '42501', null, 'a customer can''t change their own role');
select throws_ok($$update public.profiles set email = 'x@example.test'$$, '42501', null, 'a customer can''t change the email copy');
select throws_ok($$update public.profiles set avatar_url = 'https://lh3.googleusercontent.com/z'$$, '42501', null, 'a customer can''t change the avatar');
select throws_ok($$insert into public.profiles (id) values ('33333333-3333-3333-3333-333333333333')$$, '42501', null, 'a customer can''t create profiles');
select throws_ok($$delete from public.profiles$$, '42501', null, 'a customer can''t delete profiles');
select throws_ok($$update public.profiles set phone = '12345'$$, '23514', null, 'an invalid mobile number is refused');
reset role;

select is((select role from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 'customer', 'the role is still customer');
select isnt((select updated_at from public.profiles where id = '11111111-1111-1111-1111-111111111111'), null, 'updated_at is set');

-- The secret key's role has no access to profiles at all (revoked in the migration).
select ok(not has_table_privilege('service_role', 'public.profiles', 'SELECT') and not has_table_privilege('service_role', 'public.profiles', 'INSERT') and not has_table_privilege('service_role', 'public.profiles', 'UPDATE') and not has_table_privilege('service_role', 'public.profiles', 'DELETE') and not has_table_privilege('service_role', 'public.profiles', 'TRUNCATE'), 'service_role has no access to profiles');

select * from finish();
rollback;
