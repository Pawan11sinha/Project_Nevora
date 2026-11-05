-- Removes the Stage 4 load test function. Touches nothing else, and deletes no data.
drop function if exists public.deploy_test_load_purchase();
