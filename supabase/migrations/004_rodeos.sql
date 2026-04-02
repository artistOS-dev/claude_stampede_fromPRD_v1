-- ============================================================
-- Stampede — Rodeos Data Layer
-- Migration: 004_rodeos.sql
-- Run in Supabase SQL Editor
-- ============================================================

-- ── TABLES ────────────────────────────────────────────────────

-- Main rodeo event
create table public.rodeos (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('showdown', 'whale', 'grassroots', 'artist_vs_artist')),
  status text not null check (status in ('pending', 'open', 'voting', 'closed', 'archived')) default 'pending',
  title text not null,
  description text,
  start_date timestamptz,
  end_date timestamptz,
  league_id uuid,                                       -- nullable, for future leagues feature
  created_by uuid references public.profiles(id) on delete set null,
  created_by_circle uuid references public.circles(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Credit pool attached to a rodeo (1:1)
create table public.credit_pools (
  id uuid primary key default gen_random_uuid(),
  rodeo_id uuid references public.rodeos(id) on delete cascade not null unique,
  sponsor_credits numeric(12,2) default 0,
  circle_credits numeric(12,2) default 0,
  artist_credits numeric(12,2) default 0,
  user_backed_credits numeric(12,2) default 0,
  total numeric(12,2) generated always as (
    sponsor_credits + circle_credits + artist_credits + user_backed_credits
  ) stored,
  platform_fee_pct numeric(5,2) default 10.00,          -- percentage taken by platform
  created_at timestamptz default now()
);

-- How credits are distributed after a rodeo resolves
create table public.distribution_rules (
  id uuid primary key default gen_random_uuid(),
  credit_pool_id uuid references public.credit_pools(id) on delete cascade not null,
  recipient text not null check (recipient in (
    'winning_artist', 'songwriter', 'band', 'young_bucks', 'core_artists', 'users'
  )),
  percentage numeric(5,2) not null check (percentage >= 0 and percentage <= 100),
  created_at timestamptz default now()
);

-- A Circle's or artist's entry into a rodeo
create table public.rodeo_entries (
  id uuid primary key default gen_random_uuid(),
  rodeo_id uuid references public.rodeos(id) on delete cascade not null,
  circle_id uuid references public.circles(id) on delete set null,       -- null for artist_vs_artist
  artist_id uuid references public.profiles(id) on delete set null,      -- null for circle-based types
  internal_vote_passed boolean default false,
  credits_contributed numeric(12,2) default 0,
  status text not null check (status in ('pending', 'confirmed', 'withdrawn')) default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Songs locked into a rodeo entry (references existing circle_songs)
create table public.rodeo_entry_songs (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid references public.rodeo_entries(id) on delete cascade not null,
  song_id uuid references public.circle_songs(id) on delete cascade not null,
  label text check (label in ('studio', 'live')),
  locked boolean default false,
  created_at timestamptz default now(),
  unique(entry_id, song_id)
);

-- Individual votes cast during a rodeo
create table public.rodeo_votes (
  id uuid primary key default gen_random_uuid(),
  rodeo_id uuid references public.rodeos(id) on delete cascade not null,
  voter_id uuid references public.profiles(id) on delete cascade not null,
  song_id uuid references public.circle_songs(id) on delete cascade not null,
  target_entry_id uuid references public.rodeo_entries(id) on delete cascade not null,
  voter_type text not null check (voter_type in ('circle_member', 'general_public')),
  weight numeric(5,2) default 1.00,
  created_at timestamptz default now(),
  unique(rodeo_id, voter_id, song_id)                   -- one vote per user per song per rodeo
);

-- Final result after a rodeo closes
create table public.rodeo_results (
  id uuid primary key default gen_random_uuid(),
  rodeo_id uuid references public.rodeos(id) on delete cascade not null unique,
  winner_circle_id uuid references public.circles(id) on delete set null,
  winner_artist_id uuid references public.profiles(id) on delete set null,
  circle_member_votes integer default 0,
  general_public_votes integer default 0,
  archived_to_circle_history boolean default false,
  finalized_at timestamptz,
  created_at timestamptz default now()
);

-- Per-song scores within a rodeo result
create table public.rodeo_song_results (
  id uuid primary key default gen_random_uuid(),
  result_id uuid references public.rodeo_results(id) on delete cascade not null,
  song_id uuid references public.circle_songs(id) on delete cascade not null,
  entry_id uuid references public.rodeo_entries(id) on delete cascade not null,
  total_votes integer default 0,
  weighted_score numeric(10,2) default 0,
  circle_member_votes integer default 0,
  general_public_votes integer default 0,
  created_at timestamptz default now()
);

-- Actual credit payouts after resolution
create table public.rodeo_credit_distributions (
  id uuid primary key default gen_random_uuid(),
  result_id uuid references public.rodeo_results(id) on delete cascade not null,
  recipient_user_id uuid references public.profiles(id) on delete set null,
  recipient_type text not null check (recipient_type in (
    'winning_artist', 'songwriter', 'band', 'young_bucks', 'core_artists', 'users', 'platform'
  )),
  amount numeric(12,2) not null default 0,
  created_at timestamptz default now()
);

-- ── TRIGGERS ──────────────────────────────────────────────────

-- updated_at for rodeos
create trigger on_rodeo_updated
  before update on public.rodeos
  for each row execute procedure public.handle_updated_at();

-- updated_at for rodeo_entries
create trigger on_rodeo_entry_updated
  before update on public.rodeo_entries
  for each row execute procedure public.handle_updated_at();

-- Auto-calculate vote tallies on rodeo_results when votes change
create or replace function public.handle_rodeo_vote_tally()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_rodeo_id uuid;
begin
  v_rodeo_id := coalesce(new.rodeo_id, old.rodeo_id);

  update public.rodeo_results
  set
    circle_member_votes = (
      select count(*) from public.rodeo_votes
      where rodeo_id = v_rodeo_id and voter_type = 'circle_member'
    ),
    general_public_votes = (
      select count(*) from public.rodeo_votes
      where rodeo_id = v_rodeo_id and voter_type = 'general_public'
    )
  where rodeo_id = v_rodeo_id;

  return coalesce(new, old);
end;
$$;

create trigger on_rodeo_vote_change
  after insert or update or delete on public.rodeo_votes
  for each row execute procedure public.handle_rodeo_vote_tally();

-- ── ROW LEVEL SECURITY ───────────────────────────────────────

alter table public.rodeos                    enable row level security;
alter table public.credit_pools              enable row level security;
alter table public.distribution_rules        enable row level security;
alter table public.rodeo_entries             enable row level security;
alter table public.rodeo_entry_songs         enable row level security;
alter table public.rodeo_votes               enable row level security;
alter table public.rodeo_results             enable row level security;
alter table public.rodeo_song_results        enable row level security;
alter table public.rodeo_credit_distributions enable row level security;

-- ── rodeos ──

-- Anyone can browse rodeos
create policy "rodeos: public read"
  on public.rodeos for select using (true);

-- Authenticated users can create rodeos
create policy "rodeos: authenticated create"
  on public.rodeos for insert
  with check (auth.role() = 'authenticated');

-- Creator or service role can update (status transitions, archiving)
create policy "rodeos: creator can update"
  on public.rodeos for update
  using (auth.uid() = created_by or auth.role() = 'service_role')
  with check (auth.uid() = created_by or auth.role() = 'service_role');

-- ── credit_pools ──

create policy "credit_pools: public read"
  on public.credit_pools for select using (true);

create policy "credit_pools: authenticated create"
  on public.credit_pools for insert
  with check (auth.role() = 'authenticated');

create policy "credit_pools: service role update"
  on public.credit_pools for update
  using (auth.role() = 'service_role' or auth.role() = 'authenticated');

-- ── distribution_rules ──

create policy "distribution_rules: public read"
  on public.distribution_rules for select using (true);

create policy "distribution_rules: authenticated create"
  on public.distribution_rules for insert
  with check (auth.role() = 'authenticated');

-- ── rodeo_entries ──

create policy "rodeo_entries: public read"
  on public.rodeo_entries for select using (true);

-- Circle members or the artist themselves can create entries
create policy "rodeo_entries: authenticated create"
  on public.rodeo_entries for insert
  with check (auth.role() = 'authenticated');

create policy "rodeo_entries: entry owner can update"
  on public.rodeo_entries for update
  using (
    auth.uid() = artist_id
    or auth.role() = 'service_role'
    or exists (
      select 1 from public.circle_members
      where circle_id = rodeo_entries.circle_id
        and user_id = auth.uid()
        and role in ('board', 'founder')
        and status = 'active'
    )
  );

-- ── rodeo_entry_songs ──

create policy "rodeo_entry_songs: public read"
  on public.rodeo_entry_songs for select using (true);

create policy "rodeo_entry_songs: authenticated create"
  on public.rodeo_entry_songs for insert
  with check (auth.role() = 'authenticated');

-- ── rodeo_votes ──

-- Authenticated users can read all votes (transparency)
create policy "rodeo_votes: authenticated read"
  on public.rodeo_votes for select
  using (auth.role() = 'authenticated');

-- Authenticated users can cast votes (subscription check done in API)
create policy "rodeo_votes: authenticated vote"
  on public.rodeo_votes for insert
  with check (auth.uid() = voter_id and auth.role() = 'authenticated');

-- Users can update their own vote
create policy "rodeo_votes: user can update own"
  on public.rodeo_votes for update
  using (auth.uid() = voter_id)
  with check (auth.uid() = voter_id);

-- ── rodeo_results ──

create policy "rodeo_results: public read"
  on public.rodeo_results for select using (true);

create policy "rodeo_results: service role write"
  on public.rodeo_results for insert
  with check (auth.role() = 'service_role' or auth.role() = 'authenticated');

create policy "rodeo_results: service role update"
  on public.rodeo_results for update
  using (auth.role() = 'service_role' or auth.role() = 'authenticated');

-- ── rodeo_song_results ──

create policy "rodeo_song_results: public read"
  on public.rodeo_song_results for select using (true);

create policy "rodeo_song_results: service role write"
  on public.rodeo_song_results for insert
  with check (auth.role() = 'service_role' or auth.role() = 'authenticated');

-- ── rodeo_credit_distributions ──

create policy "rodeo_credit_distributions: public read"
  on public.rodeo_credit_distributions for select using (true);

create policy "rodeo_credit_distributions: service role write"
  on public.rodeo_credit_distributions for insert
  with check (auth.role() = 'service_role' or auth.role() = 'authenticated');

-- ── INDEXES ───────────────────────────────────────────────────

create index idx_rodeos_status on public.rodeos(status);
create index idx_rodeos_type on public.rodeos(type);
create index idx_rodeo_entries_rodeo on public.rodeo_entries(rodeo_id);
create index idx_rodeo_votes_rodeo on public.rodeo_votes(rodeo_id);
create index idx_rodeo_votes_voter on public.rodeo_votes(voter_id);
create index idx_rodeo_results_rodeo on public.rodeo_results(rodeo_id);

-- ── DEFAULT DISTRIBUTION RULES HELPER ─────────────────────────

-- Call this after creating a credit_pool to seed the default 45/45/10 split
create or replace function public.seed_default_distribution(p_credit_pool_id uuid)
returns void language plpgsql as $$
begin
  insert into public.distribution_rules (credit_pool_id, recipient, percentage) values
    (p_credit_pool_id, 'winning_artist', 25),
    (p_credit_pool_id, 'songwriter', 10),
    (p_credit_pool_id, 'band', 10),
    (p_credit_pool_id, 'core_artists', 25),
    (p_credit_pool_id, 'young_bucks', 20),
    (p_credit_pool_id, 'users', 10);
end;
$$;
