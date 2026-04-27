-- ── Migration 009: Superfan view-all access ──────────────────────
-- Superfan tier (and super admins) get read access to all circle
-- content regardless of circle membership.

-- 1. Helper function — true for super_admin OR superfan tier
create or replace function public.can_view_all()
returns boolean
language sql
security definer
stable
as $$
  select coalesce(
    (select is_super_admin or subscription_tier = 'superfan'
     from public.profiles where id = auth.uid()),
    false
  );
$$;

-- 2. SELECT bypass policies for circle-gated tables

-- circle_songs
do $$ begin
  create policy "circle_songs: superfan read all"
    on public.circle_songs for select
    using (public.can_view_all());
exception when duplicate_object then null;
end $$;

-- circle_artists
do $$ begin
  create policy "circle_artists: superfan read all"
    on public.circle_artists for select
    using (public.can_view_all());
exception when duplicate_object then null;
end $$;

-- nominations
do $$ begin
  create policy "nominations: superfan read all"
    on public.nominations for select
    using (public.can_view_all());
exception when duplicate_object then null;
end $$;

-- nomination_budgets
do $$ begin
  create policy "nomination_budgets: superfan read all"
    on public.nomination_budgets for select
    using (public.can_view_all());
exception when duplicate_object then null;
end $$;

-- circle_rodeo_events (feed)
do $$ begin
  create policy "circle_rodeo_events: superfan read all"
    on public.circle_rodeo_events for select
    using (public.can_view_all());
exception when duplicate_object then null;
end $$;

-- challenge_proposals
do $$ begin
  create policy "challenge_proposals: superfan read all"
    on public.challenge_proposals for select
    using (public.can_view_all());
exception when duplicate_object then null;
end $$;

-- profiles (superfan can see all user profiles)
do $$ begin
  create policy "profiles: superfan read all"
    on public.profiles for select
    using (public.can_view_all());
exception when duplicate_object then null;
end $$;
