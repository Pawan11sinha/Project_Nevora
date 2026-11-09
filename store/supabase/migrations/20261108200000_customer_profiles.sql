-- Customer profiles (DATABASE_SCHEMA.md, `profiles`), brought forward from C1 for customer sign-in (owner's approval,
-- 8 Nov 2026). DRAFT: run only on disposable local stacks so far, so it may still be edited. C1 builds on this table.
--
-- Identity (email, password, Google identity, sessions) stays in Supabase Auth. This table holds the profile only.
-- - One row per auth user, keyed by auth.users.id. Google and email sign-ins for the same verified email are one auth
--   user (Supabase's automatic identity linking), so they share this one row: there are never duplicate profiles.
-- - New rows are always role 'customer'. Signup metadata is never used for the role. The admin role is granted by hand
--   with SQL; customers can't change their own role.
-- - RLS: a customer reads and updates only their own row, and only full_name and phone. Nobody signed out reads anything.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  full_name text not null default '' check (char_length(full_name) <= 100),
  -- A copy of the sign-in email, kept in step with auth.users by trigger, so the account page and orders can show it.
  email text check (email is null or char_length(email) <= 320),
  -- Google's profile picture, if Google provided one. Only Google's image host is accepted.
  avatar_url text check (avatar_url is null or (char_length(avatar_url) <= 1000 and avatar_url ~ '^https://lh[0-9]\.googleusercontent\.com/')),
  -- Optional Indian mobile number, collected later at checkout: 10 digits starting 6 to 9.
  phone text check (phone is null or phone ~ '^[6-9][0-9]{9}$'),
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One profile per auth user. Identity lives in Supabase Auth.';

-- Supabase's default privileges grant table access to anon, authenticated and service_role (the local stack grants
-- everything; hosted projects grant less), so take it all back first. service_role (the secret key) gets nothing: the
-- store never uses it for profiles, and named server-only operations will get their own grants if ever needed.
revoke all on table public.profiles from anon, authenticated, service_role, public;
grant select on table public.profiles to authenticated;
grant update (full_name, phone) on table public.profiles to authenticated;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create policy "Customers read their own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy "Customers update their own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- updated_at follows every change.
create function public.profiles_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles
  for each row execute function public.profiles_touch_updated_at();

-- Only Google's avatar host is kept from sign-in metadata; anything else is dropped rather than failing the sign-up.
create function public.profile_avatar_from_metadata(meta jsonb) returns text
language sql immutable set search_path = '' as $$
  select case
    when url ~ '^https://lh[0-9]\.googleusercontent\.com/' and char_length(url) <= 1000 then url
  end
  from (select coalesce(meta ->> 'avatar_url', meta ->> 'picture') as url) as m;
$$;

-- Creates the profile when Supabase Auth creates a user (email sign-up or first Google sign-in). The name comes from
-- signup metadata (full_name) or Google (full_name or name). The role is never read from metadata.
create function public.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (
    new.id,
    left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), 100),
    new.email,
    public.profile_avatar_from_metadata(new.raw_user_meta_data)
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Keeps the email copy in step when the sign-in email changes, and fills a missing name or Google picture when a Google
-- identity is linked to an existing email account later. Never touches the role.
create function public.handle_auth_user_updated() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles p
  set email = new.email,
      full_name = case when p.full_name = '' then left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), 100) else p.full_name end,
      avatar_url = coalesce(p.avatar_url, public.profile_avatar_from_metadata(new.raw_user_meta_data))
  where p.id = new.id
    and (p.email is distinct from new.email
      or (p.full_name = '' and coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '') <> '')
      or (p.avatar_url is null and public.profile_avatar_from_metadata(new.raw_user_meta_data) is not null));
  return new;
end;
$$;

create trigger on_auth_user_updated after update of email, raw_user_meta_data on auth.users
  for each row execute function public.handle_auth_user_updated();

-- The trigger functions run only from Auth's triggers, never through the API.
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.handle_auth_user_updated() from public, anon, authenticated;
revoke all on function public.profiles_touch_updated_at() from public, anon, authenticated;
revoke all on function public.profile_avatar_from_metadata(jsonb) from public, anon, authenticated;
