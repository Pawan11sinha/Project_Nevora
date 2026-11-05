-- Stage 4 load test only. Adds one function, and no tables or rows.
-- It does the real purchase work, then undoes it, so the load test leaves no orders behind.
-- To remove it, use supabase-load-test-rollback.sql.

create or replace function public.deploy_test_load_purchase()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  price int;
  cost int;
begin
  begin
    -- The same two statements as deploy_test_take_one.
    update public.deploy_test_products
    set stock = stock - 1
    where id = 1 and stock > 0
    returning price_paise, cost_paise into price, cost;
    if not found then
      return false;
    end if;
    insert into public.deploy_test_orders (user_id, product_id, unit_price_paise, unit_cost_paise)
    values ((select auth.uid()), 1, price, cost);
    -- Raising here undoes both statements above. Any other error isn't caught, and fails visibly.
    raise exception 'deploy_test_load_rollback' using errcode = 'NV001';
  exception
    when sqlstate 'NV001' then
      return true;
  end;
end;
$$;

revoke all on function public.deploy_test_load_purchase() from public, anon, authenticated;
grant execute on function public.deploy_test_load_purchase() to authenticated;
