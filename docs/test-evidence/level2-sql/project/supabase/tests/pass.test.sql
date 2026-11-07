begin;
select plan(2);
select ok(true, 'level2 true assertion one');
select is(1 + 1, 2, 'level2 true assertion two');
select * from finish();
rollback;
