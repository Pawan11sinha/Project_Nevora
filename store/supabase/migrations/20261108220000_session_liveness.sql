-- DEF-6: end sessions immediately when Supabase detects refresh-token reuse. DRAFT: disposable local stacks only.
--
-- When a refresh token is reused (a sign of theft), Supabase Auth revokes every refresh token in the session but keeps
-- the session row. Access tokens already issued for that session therefore stay valid until they expire: getUser() and
-- Auth's own /user endpoint accept them, because they only check that the session row exists (reproduced locally,
-- docs/test-evidence/LEVEL2_ISSUES.md, DEF-6). With refresh_token_reuse_interval = 0 (supabase/config.toml) the session
-- can't be revived, but its old access tokens still work.
--
-- 1. A deferred trigger deletes a session once it has no active refresh token left at commit, exactly as signing out
--    does, so Supabase itself then refuses its access tokens everywhere. Normal rotation revokes the old token and
--    inserts the new one in the same transaction, so a live session always ends a transaction with one active token.
-- 2. current_session_is_live() checks the same condition for the caller's own session, independently of the trigger,
--    and RLS uses it, so a dead session can't read customer data even if the trigger were missing.

-- 1. End dead sessions.
create function public.end_session_without_active_refresh_token() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.session_id is not null
     and not exists (select 1 from auth.refresh_tokens t where t.session_id = new.session_id and not t.revoked) then
    -- Same as Supabase's own sign-out: deleting the session also deletes its refresh tokens.
    delete from auth.sessions s where s.id = new.session_id;
  end if;
  return null;
end;
$$;

revoke all on function public.end_session_without_active_refresh_token() from public, anon, authenticated;

-- Deferred to commit, so the moment between revoking the old token and inserting its replacement is never seen.
create constraint trigger end_session_without_active_refresh_token
  after update of revoked on auth.refresh_tokens
  deferrable initially deferred
  for each row when (new.revoked and not old.revoked)
  execute function public.end_session_without_active_refresh_token();

-- 2. Is the caller's session still live? True only if the session in the caller's access token still exists and still
--    has an active refresh token. False for signed-out, revoked or reuse-detected sessions, and for the secret key.
create function public.current_session_is_live() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from auth.sessions s
    where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
      and s.user_id = auth.uid()
      and (s.not_after is null or s.not_after > now())
      and exists (select 1 from auth.refresh_tokens t where t.session_id = s.id and not t.revoked)
  );
$$;

revoke all on function public.current_session_is_live() from public, anon;
grant execute on function public.current_session_is_live() to authenticated;

-- Customers read and update their profile only from a live session.
drop policy "Customers read their own profile" on public.profiles;
drop policy "Customers update their own profile" on public.profiles;

create policy "Customers read their own profile" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) and (select public.current_session_is_live()));

create policy "Customers update their own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and (select public.current_session_is_live()))
  with check (id = (select auth.uid()) and (select public.current_session_is_live()));
