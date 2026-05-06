-- Rename 'producer' role to 'stampede_producer' across profiles and circles tables.
-- stampede_producer is a privileged role with rights to create circles and duels.
--
-- Uses a DO block to drop check constraints by content rather than by name,
-- because Supabase may auto-generate constraint names that differ from the
-- names used in the original migration.

-- 1. Drop all existing check constraints that reference these columns,
--    regardless of their actual constraint name in the database.
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and (pg_get_constraintdef(oid) ilike '%role%'
           or pg_get_constraintdef(oid) ilike '%subscription_tier%')
  loop
    execute format('alter table public.profiles drop constraint %I', r.conname);
  end loop;

  for r in
    select conname from pg_constraint
    where conrelid = 'public.circles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%required_tier%'
  loop
    execute format('alter table public.circles drop constraint %I', r.conname);
  end loop;
end $$;

-- 2. Migrate any remaining stale data (idempotent — safe to re-run)
update public.profiles set role             = 'stampede_producer' where role             = 'producer';
update public.profiles set subscription_tier = 'stampede_producer' where subscription_tier = 'producer';
update public.circles  set required_tier     = 'stampede_producer' where required_tier     = 'producer';

-- 3. Add new constraints with the correct allowed values
alter table public.profiles
  add constraint profiles_role_check
    check (role in ('fan', 'artist', 'stampede_producer')),
  add constraint profiles_subscription_tier_check
    check (subscription_tier in ('free', 'fan', 'superfan', 'artist', 'stampede_producer'));

alter table public.circles
  add constraint circles_required_tier_check
    check (required_tier in ('free', 'fan', 'superfan', 'artist', 'stampede_producer'));
