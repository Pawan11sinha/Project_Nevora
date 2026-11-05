-- Deployment test only. Holds no real customer data, and is deleted with the test project.
-- Paste into Supabase: SQL Editor, New query, Run. Running it again resets the test stock to 1.

create table if not exists public.deploy_test_stock (
  id int primary key,
  quantity int not null check (quantity >= 0)
);
alter table public.deploy_test_stock enable row level security;

insert into public.deploy_test_stock (id, quantity) values (1, 1)
on conflict (id) do update set quantity = 1;

create table if not exists public.deploy_test_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.deploy_test_admins enable row level security;

-- Takes one unit if any is left. Competing calls can't both win, because the update
-- locks the row and rechecks the quantity.
create or replace function public.deploy_test_take_one()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated int;
begin
  update public.deploy_test_stock
  set quantity = quantity - 1
  where id = 1 and quantity > 0;
  get diagnostics updated = row_count;
  return updated = 1;
end;
$$;

create or replace function public.deploy_test_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.deploy_test_admins where user_id = (select auth.uid())
  );
$$;

revoke all on function public.deploy_test_take_one() from public;
revoke all on function public.deploy_test_is_admin() from public;
grant execute on function public.deploy_test_take_one() to anon, authenticated;
grant execute on function public.deploy_test_is_admin() to authenticated;
