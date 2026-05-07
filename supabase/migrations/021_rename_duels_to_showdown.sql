-- ============================================================
-- Rename "Song Duels" feature to "Showdown"
-- Renames tables, indexes, and RLS policies.
-- ============================================================

-- Rename tables
alter table public.song_duels       rename to song_showdowns;
alter table public.song_duel_votes  rename to song_showdown_votes;

-- Rename indexes
alter index if exists song_duels_status_idx      rename to song_showdowns_status_idx;
alter index if exists song_duels_end_date_idx    rename to song_showdowns_end_date_idx;
alter index if exists song_duel_votes_duel_idx   rename to song_showdown_votes_duel_idx;
alter index if exists song_duel_votes_voter_idx  rename to song_showdown_votes_voter_idx;

-- Recreate RLS policies under new names on song_showdowns
drop policy if exists "duels_read_public"           on public.song_showdowns;
drop policy if exists "duels_superadmin_all"        on public.song_showdowns;
drop policy if exists "duels_insert_authenticated"  on public.song_showdowns;

create policy "showdowns_read_public" on public.song_showdowns
  for select using (
    auth.uid() is not null
    and status in ('active', 'closed')
  );

create policy "showdowns_superadmin_all" on public.song_showdowns
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_super_admin = true
    )
  );

create policy "showdowns_insert_authenticated" on public.song_showdowns
  for insert with check (auth.uid() is not null and auth.uid() = created_by);

-- Recreate RLS policies on song_showdown_votes
drop policy if exists "duel_votes_insert_own"  on public.song_showdown_votes;
drop policy if exists "duel_votes_select_own"  on public.song_showdown_votes;

create policy "showdown_votes_insert_own" on public.song_showdown_votes
  for insert with check (auth.uid() = voter_id);

create policy "showdown_votes_select_own" on public.song_showdown_votes
  for select using (auth.uid() = voter_id);
