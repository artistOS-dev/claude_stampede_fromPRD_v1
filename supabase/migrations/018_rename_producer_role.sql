-- Rename 'producer' role to 'stampede_producer' across profiles and circles tables.
-- stampede_producer is a privileged role with rights to create circles and duels.

-- 1. Migrate existing data before altering constraints
update public.profiles
  set role = 'stampede_producer'
  where role = 'producer';

update public.profiles
  set subscription_tier = 'stampede_producer'
  where subscription_tier = 'producer';

update public.circles
  set required_tier = 'stampede_producer'
  where required_tier = 'producer';

-- 2. Drop old check constraints and recreate with new value
alter table public.profiles
  drop constraint if exists profiles_role_check,
  drop constraint if exists profiles_subscription_tier_check;

alter table public.profiles
  add constraint profiles_role_check
    check (role in ('fan', 'artist', 'stampede_producer')),
  add constraint profiles_subscription_tier_check
    check (subscription_tier in ('free', 'fan', 'superfan', 'artist', 'stampede_producer'));

alter table public.circles
  drop constraint if exists circles_required_tier_check;

alter table public.circles
  add constraint circles_required_tier_check
    check (required_tier in ('free', 'fan', 'superfan', 'artist', 'stampede_producer'));
