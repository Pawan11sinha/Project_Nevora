-- Stage 4 load test only. Adds one function, and no tables or rows.
-- It runs the real deploy_test_take_one() inside a block that then undoes everything, so the real
-- purchase code is exercised and the load test leaves no orders and no stock change behind.
-- To remove it, use supabase-load-test-rollback.sql.
--
-- Sequence gaps: PostgreSQL doesn't reclaim sequence values when work is rolled back. Each call
-- that reaches the insert uses up one deploy_test_orders id, so later orders skip those numbers.
-- This is cosmetic: order counts and existing orders don't change, and rollback doesn't reset it.
-- Each call also leaves dead row versions, which Postgres cleans up automatically.

create or replace function public.deploy_test_load_purchase()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  won boolean;
begin
  begin
    won := public.deploy_test_take_one();
    -- Raising here undoes everything the purchase did. Any other error isn't caught, and fails visibly.
    raise exception 'deploy_test_load_rollback' using errcode = 'NV001';
  exception
    when sqlstate 'NV001' then
      -- Only this function's own rollback counts. Anything else with this code is raised again.
      if sqlerrm = 'deploy_test_load_rollback' then
        return won;
      end if;
      raise;
  end;
end;
$$;

revoke all on function public.deploy_test_load_purchase() from public, anon, authenticated;
grant execute on function public.deploy_test_load_purchase() to authenticated;
