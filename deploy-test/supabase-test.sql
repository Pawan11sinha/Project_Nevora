-- Deployment test only. Sample data, no real customer details. Deleted with the test project.
-- Paste into Supabase: SQL Editor, New query, Run. Safe to run again, and it resets the test
-- product's price and stock. To undo everything, use supabase-test-rollback.sql.

-- Profiles and roles ---------------------------------------------------------------------------
create table if not exists public.deploy_test_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'customer' check (role in ('customer', 'admin'))
);
alter table public.deploy_test_profiles enable row level security;

-- Every signup becomes a customer. Signup metadata is deliberately ignored.
create or replace function public.deploy_test_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.deploy_test_profiles (id, role) values (new.id, 'customer')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists deploy_test_on_signup on auth.users;
create trigger deploy_test_on_signup
  after insert on auth.users
  for each row execute function public.deploy_test_new_user();

insert into public.deploy_test_profiles (id, role)
select id, 'customer' from auth.users
on conflict (id) do nothing;

create or replace function public.deploy_test_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.deploy_test_profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

drop policy if exists "own profile" on public.deploy_test_profiles;
create policy "own profile" on public.deploy_test_profiles
  for select to authenticated using (id = (select auth.uid()));
-- Start from no rights, whatever this project grants by default, then allow reading only.
revoke all on public.deploy_test_profiles from public, anon, authenticated;
grant select on public.deploy_test_profiles to authenticated;

-- Sample product -------------------------------------------------------------------------------
create table if not exists public.deploy_test_products (
  id int primary key,
  name text not null,
  price_paise int not null check (price_paise > 0),
  cost_paise int not null,
  stock int not null check (stock >= 0)
);
alter table public.deploy_test_products enable row level security;
revoke all on public.deploy_test_products from public, anon, authenticated;

insert into public.deploy_test_products (id, name, price_paise, cost_paise, stock)
values (1, 'Sample product (test only)', 19900, 6500, 1)
on conflict (id) do update set price_paise = 19900, stock = 1;

-- Everyone can read these columns. Cost has no grant, so it stays unreadable.
grant select (id, name, price_paise, stock) on public.deploy_test_products to anon, authenticated;
drop policy if exists "public product read" on public.deploy_test_products;
create policy "public product read" on public.deploy_test_products
  for select to anon, authenticated using (true);

-- security_invoker makes the view use the caller's rights, not its owner's. Without it, a
-- simple view can accept writes that bypass RLS. The revoke removes any default write rights.
create or replace view public.deploy_test_products_public
  with (security_invoker = true) as
  select id, name, price_paise, stock from public.deploy_test_products;
revoke all on public.deploy_test_products_public from public, anon, authenticated;
grant select on public.deploy_test_products_public to anon, authenticated;

-- Orders ---------------------------------------------------------------------------------------
create table if not exists public.deploy_test_orders (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,
  product_id int not null references public.deploy_test_products (id),
  unit_price_paise int not null,
  unit_cost_paise int not null,
  created_at timestamptz not null default now()
);
alter table public.deploy_test_orders enable row level security;
revoke all on public.deploy_test_orders from public, anon, authenticated;
grant select (id, user_id, product_id, unit_price_paise, created_at) on public.deploy_test_orders to authenticated;

drop policy if exists "own orders" on public.deploy_test_orders;
create policy "own orders" on public.deploy_test_orders
  for select to authenticated using (user_id = (select auth.uid()));

-- Admins can read all orders. Cost stays hidden, because the column grant above applies to them too.
drop policy if exists "admins read orders" on public.deploy_test_orders;
create policy "admins read orders" on public.deploy_test_orders
  for select to authenticated using ((select public.deploy_test_is_admin()));

-- Takes one unit if any is left, and records an order at the database's price. Competing calls
-- can't both win, because the update locks the row and rechecks the stock.
create or replace function public.deploy_test_take_one()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  price int;
  cost int;
begin
  update public.deploy_test_products
  set stock = stock - 1
  where id = 1 and stock > 0
  returning price_paise, cost_paise into price, cost;
  if not found then
    return false;
  end if;
  insert into public.deploy_test_orders (user_id, product_id, unit_price_paise, unit_cost_paise)
  values ((select auth.uid()), 1, price, cost);
  return true;
end;
$$;

-- Admin-only actions check the role inside the database.
create or replace function public.deploy_test_admin_set_stock(new_stock int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.deploy_test_is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.deploy_test_products set stock = new_stock where id = 1;
end;
$$;

create or replace function public.deploy_test_admin_set_price(new_price int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.deploy_test_is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.deploy_test_products set price_paise = new_price where id = 1;
end;
$$;

-- Supabase grants new functions to anon and authenticated by default, so revoking from
-- public alone isn't enough. Remove all access, then grant only what each function needs.
revoke all on function public.deploy_test_new_user() from public, anon, authenticated;
revoke all on function public.deploy_test_take_one() from public, anon, authenticated;
revoke all on function public.deploy_test_is_admin() from public, anon, authenticated;
revoke all on function public.deploy_test_admin_set_stock(int) from public, anon, authenticated;
revoke all on function public.deploy_test_admin_set_price(int) from public, anon, authenticated;
grant execute on function public.deploy_test_take_one() to anon, authenticated;
grant execute on function public.deploy_test_is_admin() to authenticated;
grant execute on function public.deploy_test_admin_set_stock(int) to authenticated;
grant execute on function public.deploy_test_admin_set_price(int) to authenticated;
