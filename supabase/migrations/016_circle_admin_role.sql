-- ============================================================
-- Migration 016: Circle admin role
-- Adds 'admin' role to circle_members (same powers as founder).
-- Superadmins are automatically admins in every circle.
-- ============================================================

-- 1. Widen the role constraint
alter table public.circle_members
  drop constraint if exists circle_members_role_check;

alter table public.circle_members
  add constraint circle_members_role_check
  check (role in ('member', 'board', 'founder', 'admin'));

-- 2. Re-create RLS policies that referenced ('board','founder') only
--    to also include 'admin'.

-- rodeo_entries (from migration 004)
drop policy if exists "rodeo_entries: entry owner can update" on public.rodeo_entries;
create policy "rodeo_entries: entry owner can update"
  on public.rodeo_entries for update
  using (
    auth.uid() = artist_id
    or auth.role() = 'service_role'
    or exists (
      select 1 from public.circle_members
      where circle_id = rodeo_entries.circle_id
        and user_id = auth.uid()
        and role in ('board', 'founder', 'admin')
        and status = 'active'
    )
  );

-- challenge_proposals (from migration 005)
drop policy if exists "challenge_proposals: board/founder can insert" on public.challenge_proposals;
create policy "challenge_proposals: board/founder can insert"
  on public.challenge_proposals for insert
  with check (
    exists (
      select 1 from public.circle_members cm
      where cm.user_id = auth.uid()
        and cm.circle_id = challenge_proposals.circle_id
        and cm.status = 'active'
        and cm.role in ('board', 'founder', 'admin')
    )
  );

drop policy if exists "challenge_proposals: board/founder can update own circle" on public.challenge_proposals;
create policy "challenge_proposals: board/founder can update own circle"
  on public.challenge_proposals for update
  using (
    exists (
      select 1 from public.circle_members cm
      where cm.user_id = auth.uid()
        and cm.circle_id = challenge_proposals.circle_id
        and cm.status = 'active'
        and cm.role in ('board', 'founder', 'admin')
    )
  );

-- challenge_proposal_songs (from migration 005)
drop policy if exists "proposal_songs: board/founder insert" on public.challenge_proposal_songs;
create policy "proposal_songs: board/founder insert"
  on public.challenge_proposal_songs for insert
  with check (
    exists (
      select 1
      from public.challenge_proposals cp
      join public.circle_members cm on cm.circle_id = cp.circle_id
      where cp.id = challenge_proposal_songs.proposal_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
        and cm.role in ('board', 'founder', 'admin')
    )
  );

-- challenge_proposal_votes (from migration 005)
drop policy if exists "proposal_votes: board/founder read" on public.challenge_proposal_votes;
create policy "proposal_votes: board/founder read"
  on public.challenge_proposal_votes for select
  using (
    exists (
      select 1
      from public.challenge_proposals cp
      join public.circle_members cm on cm.circle_id = cp.circle_id
      where cp.id = challenge_proposal_votes.proposal_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
        and cm.role in ('board', 'founder', 'admin')
    )
  );

drop policy if exists "proposal_votes: board/founder insert/update own vote" on public.challenge_proposal_votes;
create policy "proposal_votes: board/founder insert/update own vote"
  on public.challenge_proposal_votes for insert
  with check (
    voter_id = auth.uid()
    and exists (
      select 1
      from public.challenge_proposals cp
      join public.circle_members cm on cm.circle_id = cp.circle_id
      where cp.id = challenge_proposal_votes.proposal_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
        and cm.role in ('board', 'founder', 'admin')
    )
  );

-- nomination_budgets (from migration 006)
drop policy if exists "nomination_budgets: board reads circle" on public.nomination_budgets;
create policy "nomination_budgets: board reads circle"
  on public.nomination_budgets for select
  using (
    exists (
      select 1 from public.circle_members cm
      where cm.circle_id = nomination_budgets.circle_id
        and cm.user_id = auth.uid()
        and cm.role in ('board', 'founder', 'admin')
    )
  );

-- circle_rodeo_events (from migration 006)
drop policy if exists "circle_rodeo_events: board reads all" on public.circle_rodeo_events;
create policy "circle_rodeo_events: board reads all"
  on public.circle_rodeo_events for select
  using (
    exists (
      select 1 from public.circle_members cm
      where cm.circle_id = circle_rodeo_events.circle_id
        and cm.user_id = auth.uid()
        and cm.role in ('board', 'founder', 'admin')
    )
  );

-- 3. Trigger: when a new circle is created, auto-add all superadmins
--    as 'admin' members (skip the creator — they become 'founder' via the API).
create or replace function public.add_superadmins_to_new_circle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.circle_members (circle_id, user_id, role, status)
  select new.id, p.id, 'admin', 'active'
  from public.profiles p
  where p.is_super_admin = true
    and p.id is distinct from new.created_by
  on conflict (circle_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_add_superadmins_to_new_circle on public.circles;
create trigger trg_add_superadmins_to_new_circle
  after insert on public.circles
  for each row execute function public.add_superadmins_to_new_circle();

-- 4. Trigger: when is_super_admin flips to true, add that user as 'admin'
--    in every existing circle (without demoting an existing founder).
create or replace function public.sync_superadmin_to_circles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_super_admin = true and (old.is_super_admin is null or old.is_super_admin = false) then
    insert into public.circle_members (circle_id, user_id, role, status)
    select c.id, new.id, 'admin', 'active'
    from public.circles c
    on conflict (circle_id, user_id) do update
      set role = 'admin', status = 'active'
      where circle_members.role not in ('founder');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_superadmin_to_circles on public.profiles;
create trigger trg_sync_superadmin_to_circles
  after update of is_super_admin on public.profiles
  for each row execute function public.sync_superadmin_to_circles();

-- 5. Backfill: existing superadmins become 'admin' in all circles
--    they don't already own as founder.
insert into public.circle_members (circle_id, user_id, role, status)
select c.id, p.id, 'admin', 'active'
from public.circles c
cross join public.profiles p
where p.is_super_admin = true
on conflict (circle_id, user_id) do update
  set role = 'admin', status = 'active'
  where circle_members.role not in ('founder');
