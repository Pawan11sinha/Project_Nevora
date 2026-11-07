begin;
select plan(1);
select ok(false, 'level2 deliberately false assertion');
select * from finish();
rollback;
