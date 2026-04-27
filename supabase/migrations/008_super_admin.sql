-- ── Migration 008: Super Admin ──────────────────────────────────
-- Adds is_super_admin flag and grants those users read access to
-- everything on the platform regardless of circle membership.

-- 1. Column
alter table public.profiles
  add column if not exists is_super_admin boolean not null default false;

-- 2. Security-definer helper — runs as the table owner so it can
--    read profiles without hitting RLS on that table itself.
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
as $$
  select coalesce(
    (select is_super_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- 3. RLS bypass policies for tables restricted by circle membership

-- circle_songs (currently: members-only)
do $$ begin
  create policy "circle_songs: super admin read all"
    on public.circle_songs for select
    using (public.is_super_admin());
exception when duplicate_object then null;
end $$;

-- circle_artists
do $$ begin
  create policy "circle_artists: super admin read all"
    on public.circle_artists for select
    using (public.is_super_admin());
exception when duplicate_object then null;
end $$;

-- nominations
do $$ begin
  create policy "nominations: super admin read all"
    on public.nominations for select
    using (public.is_super_admin());
exception when duplicate_object then null;
end $$;

-- nomination_budgets
do $$ begin
  create policy "nomination_budgets: super admin read all"
    on public.nomination_budgets for select
    using (public.is_super_admin());
exception when duplicate_object then null;
end $$;

-- circle_rodeo_events (feed)
do $$ begin
  create policy "circle_rodeo_events: super admin read all"
    on public.circle_rodeo_events for select
    using (public.is_super_admin());
exception when duplicate_object then null;
end $$;

-- challenge_proposals
do $$ begin
  create policy "challenge_proposals: super admin read all"
    on public.challenge_proposals for select
    using (public.is_super_admin());
exception when duplicate_object then null;
end $$;

-- profiles (super admins can see all user profiles)
do $$ begin
  create policy "profiles: super admin read all"
    on public.profiles for select
    using (public.is_super_admin());
exception when duplicate_object then null;
end $$;
