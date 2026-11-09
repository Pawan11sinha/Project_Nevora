-- DEF-6: a session whose refresh tokens are all revoked (Supabase's response to refresh-token reuse) is ended at
-- commit, normal rotation never ends a session, and current_session_is_live() and the profile policies refuse any
-- session that isn't live. The deferred trigger fires at commit; SET CONSTRAINTS ALL IMMEDIATE fires it inside this
-- test's transaction instead.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email, raw_user_meta_data) values
  ('51111111-1111-1111-1111-111111111111', 'live@example.test', '{"full_name": "Live Customer"}'),
  ('52222222-2222-2222-2222-222222222222', 'other@example.test', '{"full_name": "Other Customer"}');
insert into auth.sessions (id, user_id) values
  ('5aaaaaaa-0000-0000-0000-000000000001', '51111111-1111-1111-1111-111111111111'),
  ('5aaaaaaa-0000-0000-0000-000000000002', '51111111-1111-1111-1111-111111111111'),
  ('5aaaaaaa-0000-0000-0000-000000000003', '52222222-2222-2222-2222-222222222222');
insert into auth.refresh_tokens (token, user_id, session_id, revoked) values
  ('rot-t0', '51111111-1111-1111-1111-111111111111', '5aaaaaaa-0000-0000-0000-000000000001', false),
  ('fam-t0', '51111111-1111-1111-1111-111111111111', '5aaaaaaa-0000-0000-0000-000000000002', true),
  ('fam-t1', '51111111-1111-1111-1111-111111111111', '5aaaaaaa-0000-0000-0000-000000000002', false),
  ('other-t0', '52222222-2222-2222-2222-222222222222', '5aaaaaaa-0000-0000-0000-000000000003', false);

-- Normal rotation, as Supabase does it: revoke the current token and insert its replacement in one transaction.
update auth.refresh_tokens set revoked = true where token = 'rot-t0';
insert into auth.refresh_tokens (token, user_id, session_id, revoked, parent) values ('rot-t1', '51111111-1111-1111-1111-111111111111', '5aaaaaaa-0000-0000-0000-000000000001', false, 'rot-t0');
set constraints all immediate;
select is((select count(*)::int from auth.sessions where id = '5aaaaaaa-0000-0000-0000-000000000001'), 1, 'normal rotation keeps the session');
set constraints all deferred;

-- Reuse detected: Supabase revokes every token in the session and keeps the session row. The trigger ends it.
update auth.refresh_tokens set revoked = true where session_id = '5aaaaaaa-0000-0000-0000-000000000002' and not revoked;
set constraints all immediate;
select is((select count(*)::int from auth.sessions where id = '5aaaaaaa-0000-0000-0000-000000000002'), 0, 'a session with every refresh token revoked is ended');
select is((select count(*)::int from auth.refresh_tokens where session_id = '5aaaaaaa-0000-0000-0000-000000000002'), 0, '... and its refresh tokens go with it, as on sign-out');
select is((select count(*)::int from auth.sessions where id = '5aaaaaaa-0000-0000-0000-000000000003'), 1, 'other customers'' sessions are untouched');
set constraints all deferred;

-- current_session_is_live() as each kind of caller.
set local role authenticated;
set local request.jwt.claims = '{"sub": "51111111-1111-1111-1111-111111111111", "role": "authenticated", "session_id": "5aaaaaaa-0000-0000-0000-000000000001"}';
select ok(public.current_session_is_live(), 'a rotated, active session is live');
select is((select count(*)::int from public.profiles), 1, 'a live session reads its own profile');

set local request.jwt.claims = '{"sub": "51111111-1111-1111-1111-111111111111", "role": "authenticated", "session_id": "5aaaaaaa-0000-0000-0000-000000000002"}';
select ok(not public.current_session_is_live(), 'a session ended after reuse detection isn''t live');
select is((select count(*)::int from public.profiles), 0, 'an access token from an ended session reads nothing');
update public.profiles set full_name = 'Attacker' where id = '51111111-1111-1111-1111-111111111111';
reset role;
select is((select full_name from public.profiles where id = '51111111-1111-1111-1111-111111111111'), 'Live Customer', '... and changes nothing');
set local role authenticated;

set local request.jwt.claims = '{"sub": "51111111-1111-1111-1111-111111111111", "role": "authenticated", "session_id": "5aaaaaaa-0000-0000-0000-000000000003"}';
select ok(not public.current_session_is_live(), 'another user''s session id doesn''t count');
set local request.jwt.claims = '{"sub": "51111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select ok(not public.current_session_is_live(), 'a token without a session id isn''t live');
set local request.jwt.claims = '{"sub": "51111111-1111-1111-1111-111111111111", "role": "authenticated", "session_id": "5aaaaaaa-0000-0000-0000-00000000dead"}';
select ok(not public.current_session_is_live(), 'a deleted (signed-out) session isn''t live');
reset role;

-- A session that's revoked but still has its row (as if the trigger were missing, on a platform that forbids it)
-- still isn't live: the check doesn't depend on the trigger. The trigger is deferred to commit, so until then the row
-- stays, which is exactly that state.
update auth.refresh_tokens set revoked = true where session_id = '5aaaaaaa-0000-0000-0000-000000000003';
select is((select count(*)::int from auth.sessions where id = '5aaaaaaa-0000-0000-0000-000000000003'), 1, 'before commit the revoked session''s row still exists');
set local role authenticated;
set local request.jwt.claims = '{"sub": "52222222-2222-2222-2222-222222222222", "role": "authenticated", "session_id": "5aaaaaaa-0000-0000-0000-000000000003"}';
select ok(not public.current_session_is_live(), 'without the trigger, a revoked session still isn''t live');
select is((select count(*)::int from public.profiles), 0, '... and RLS still refuses it');
reset role;

-- Signed-out visitors can't call the check at all.
set local role anon;
select throws_ok('select public.current_session_is_live()', '42501', null, 'signed-out visitors can''t call the check');
reset role;
select ok(not has_function_privilege('authenticated', 'public.end_session_without_active_refresh_token()', 'execute'), 'nobody can call the trigger function through the API');

select * from finish();
rollback;
