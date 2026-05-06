-- Rename 'artist' role to 'artist_manager'.
-- artist_manager is a privileged role for artists and their managers to
-- administer their presence on Stampede. Not a regular fan/listener role.
--
-- Also creates the privileged_role_keys table: a super_admin-only table
-- storing the secret access codes required during signup for privileged roles.

-- ── 1. Drop existing role/tier check constraints by content ────────────────
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

-- ── 2. Migrate existing data ────────────────────────────────────────────────
update public.profiles set role              = 'artist_manager' where role              = 'artist';
update public.profiles set subscription_tier = 'artist_manager' where subscription_tier = 'artist';
update public.circles  set required_tier     = 'artist_manager' where required_tier     = 'artist';

-- ── 3. Recreate constraints with updated values ─────────────────────────────
alter table public.profiles
  add constraint profiles_role_check
    check (role in ('fan', 'artist_manager', 'stampede_producer')),
  add constraint profiles_subscription_tier_check
    check (subscription_tier in ('free', 'fan', 'superfan', 'artist_manager', 'stampede_producer'));

alter table public.circles
  add constraint circles_required_tier_check
    check (required_tier in ('free', 'fan', 'superfan', 'artist_manager', 'stampede_producer'));

-- ── 4. Privileged role keys table ──────────────────────────────────────────
-- Stores the secret access codes that artist_manager and stampede_producer
-- candidates must enter during signup. Only super_admin can read or update.
create table if not exists public.privileged_role_keys (
  role        text        primary key
                          check (role in ('artist_manager', 'stampede_producer')),
  secret_key  text        not null,
  updated_by  uuid        references public.profiles(id) on delete set null,
  updated_at  timestamptz default now()
);

alter table public.privileged_role_keys enable row level security;

-- Only super_admin may select or modify role keys
create policy "role_keys_superadmin_all" on public.privileged_role_keys
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_super_admin = true
    )
  );

-- Seed placeholder keys — super_admin MUST change these before onboarding live users
insert into public.privileged_role_keys (role, secret_key) values
  ('artist_manager',    'CHANGE_ME_artist_manager'),
  ('stampede_producer', 'CHANGE_ME_stampede_producer')
on conflict (role) do nothing;
