-- Removes everything supabase-test.sql creates. For the test project only.
-- This permanently deletes all deploy_test_ tables and their data.
-- It touches only deploy_test_ objects. Safe to run again.

-- The trigger goes first. If it outlived its table, every signup would fail.
drop trigger if exists deploy_test_on_signup on auth.users;

drop view if exists public.deploy_test_products_public;

-- Orders go before products and before deploy_test_is_admin, because they depend on them.
drop table if exists public.deploy_test_orders;
drop table if exists public.deploy_test_products;

drop function if exists public.deploy_test_take_one();
drop function if exists public.deploy_test_admin_set_stock(int);
drop function if exists public.deploy_test_admin_set_price(int);
drop function if exists public.deploy_test_is_admin();
drop function if exists public.deploy_test_new_user();

drop table if exists public.deploy_test_profiles;

-- Optional: also remove the dashboard test users. Left commented out because it deletes accounts.
-- Check the list with the select first. A user from the optional signup test doesn't match this
-- pattern, so delete that one under Authentication, Users.
-- select email from auth.users where email like 'nevora-test-%@example.com';
-- delete from auth.users where email like 'nevora-test-%@example.com';
