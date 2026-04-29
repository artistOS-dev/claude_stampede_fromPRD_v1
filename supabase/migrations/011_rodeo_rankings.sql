-- ============================================================
-- Stampede — Replace per-song votes with ranked ballot
-- Migration: 011_rodeo_rankings.sql
-- ============================================================

-- Drop old vote trigger and function (tied to rodeo_votes)
drop trigger if exists on_rodeo_vote_change on public.rodeo_votes;
drop function if exists public.handle_rodeo_vote_tally();

-- Drop the old votes table
drop table if exists public.rodeo_votes;

-- ── RANKING TABLE ─────────────────────────────────────────────
-- One row per song a voter includes in their ballot.
-- rank = 1 is highest preference. Voters rank a subset or all songs.
-- Resubmitting deletes and replaces all rows for (rodeo_id, voter_id).

create table public.rodeo_rankings (
  id           uuid primary key default gen_random_uuid(),
  rodeo_id     uuid references public.rodeos(id) on delete cascade not null,
  voter_id     uuid references public.profiles(id) on delete cascade not null,
  song_id      uuid references public.circle_songs(id) on delete cascade not null,
  rank         integer not null check (rank >= 1),
  submitted_at timestamptz default now(),
  unique(rodeo_id, voter_id, song_id)
);

alter table public.rodeo_rankings enable row level security;

-- Any authenticated user can view all rankings (full transparency)
create policy "rodeo_rankings: authenticated read"
  on public.rodeo_rankings for select
  using (auth.role() = 'authenticated');

-- Voters insert their own ranking rows
create policy "rodeo_rankings: voter insert"
  on public.rodeo_rankings for insert
  with check (auth.uid() = voter_id and auth.role() = 'authenticated');

-- Voters delete their own rows to resubmit
create policy "rodeo_rankings: voter delete own"
  on public.rodeo_rankings for delete
  using (auth.uid() = voter_id);

-- ── INDEXES ───────────────────────────────────────────────────

create index idx_rodeo_rankings_rodeo       on public.rodeo_rankings(rodeo_id);
create index idx_rodeo_rankings_voter       on public.rodeo_rankings(voter_id);
create index idx_rodeo_rankings_rodeo_voter on public.rodeo_rankings(rodeo_id, voter_id);
