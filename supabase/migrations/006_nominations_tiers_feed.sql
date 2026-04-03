-- ============================================================
-- Stampede — Nominations, Artist Tiers, Activity Feed
-- Migration: 006_nominations_tiers_feed.sql
-- Run in Supabase SQL Editor
-- ============================================================

-- ── ARTIST TIER on circle_artists ────────────────────────────

alter table public.circle_artists
  add column if not exists tier text not null
    check (tier in ('rising_star', 'young_buck', 'core', 'legacy'))
    default 'rising_star',
  add column if not exists inducted_at timestamptz,
  add column if not exists promotion_eligible boolean default false,
  add column if not exists rodeo_wins integer default 0,
  add column if not exists rodeo_appearances integer default 0,
  add column if not exists inactive_periods integer default 0,
  add column if not exists updated_at timestamptz default now();

-- ── NOMINATION BUDGETS ────────────────────────────────────────

-- One budget row per user per circle per period
create table public.nomination_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  circle_id uuid references public.circles(id) on delete cascade not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  young_buck_slots integer not null default 0,
  rising_star_slots integer not null default 0,
  young_buck_used integer not null default 0,
  rising_star_used integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, circle_id, period_start)
);

-- ── NOMINATIONS ───────────────────────────────────────────────

create table public.nominations (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid references public.circles(id) on delete cascade not null,
  nominated_by uuid references public.profiles(id) on delete set null,
  artist_name text not null,
  tier_target text not null check (tier_target in ('young_buck', 'core')),
  -- young_buck = new artist being nominated as Young Buck
  -- core       = existing Young Buck being promoted to Core
  circle_artist_id uuid references public.circle_artists(id) on delete set null,
  -- set when an existing circle_artist is promoted
  status text not null check (status in (
    'pending_vote',   -- waiting for Circle member votes
    'passed',         -- vote threshold met, moves to board
    'board_review',   -- board is deciding
    'approved',       -- board approved, artist inducted
    'declined',       -- board declined
    'held'            -- board held for future
  )) default 'pending_vote',
  message text,       -- nominator's pitch
  budget_id uuid references public.nomination_budgets(id) on delete set null,
  votes_for integer default 0,
  votes_against integer default 0,
  vote_threshold numeric(5,2) default 50.00, -- % required to pass
  board_decided_by uuid references public.profiles(id) on delete set null,
  board_decided_at timestamptz,
  inducted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── NOMINATION VOTES ──────────────────────────────────────────

create table public.nomination_votes (
  id uuid primary key default gen_random_uuid(),
  nomination_id uuid references public.nominations(id) on delete cascade not null,
  voter_id uuid references public.profiles(id) on delete cascade not null,
  vote text not null check (vote in ('for', 'against')),
  created_at timestamptz default now(),
  unique(nomination_id, voter_id)
);

-- ── CIRCLE RODEO EVENTS (activity feed) ──────────────────────

create table public.circle_rodeo_events (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid references public.circles(id) on delete cascade not null,
  rodeo_id uuid references public.rodeos(id) on delete set null,
  nomination_id uuid references public.nominations(id) on delete set null,
  event_type text not null check (event_type in (
    'challenge_sent',
    'challenge_received',
    'challenge_accepted',
    'challenge_declined',
    'rodeo_opened',
    'vote_milestone',      -- e.g. 50% participation
    'result_posted',
    'artist_promoted',
    'credits_distributed',
    'budget_reset',
    'board_approval_pending',
    'nomination_passed',
    'nomination_inducted'
  )),
  actor_id uuid references public.profiles(id) on delete set null,
  -- JSON payload for deep-link and display metadata
  payload jsonb default '{}',
  -- board-only visibility
  board_only boolean default false,
  created_at timestamptz default now()
);

-- ── TRIGGERS ─────────────────────────────────────────────────

-- Ensure updated_at trigger function exists (defined in migration 005)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger nomination_budgets_updated_at
  before update on public.nomination_budgets
  for each row execute procedure public.set_updated_at();

create trigger nominations_updated_at
  before update on public.nominations
  for each row execute procedure public.set_updated_at();

create trigger circle_artists_updated_at
  before update on public.circle_artists
  for each row execute procedure public.set_updated_at();

-- ── INDEXES ──────────────────────────────────────────────────

create index nomination_budgets_user_circle_idx on public.nomination_budgets(user_id, circle_id);
create index nominations_circle_status_idx on public.nominations(circle_id, status);
create index circle_rodeo_events_circle_idx on public.circle_rodeo_events(circle_id, created_at desc);
create index circle_rodeo_events_rodeo_idx on public.circle_rodeo_events(rodeo_id);

-- ── RLS ──────────────────────────────────────────────────────

alter table public.nomination_budgets   enable row level security;
alter table public.nominations          enable row level security;
alter table public.nomination_votes     enable row level security;
alter table public.circle_rodeo_events  enable row level security;

-- nomination_budgets: user can read own; board can read all for their circle
create policy "nomination_budgets: user reads own"
  on public.nomination_budgets for select
  using (user_id = auth.uid());

create policy "nomination_budgets: board reads circle"
  on public.nomination_budgets for select
  using (
    exists (
      select 1 from public.circle_members cm
      where cm.circle_id = nomination_budgets.circle_id
        and cm.user_id = auth.uid()
        and cm.role in ('board', 'founder')
    )
  );

create policy "nomination_budgets: service role full access"
  on public.nomination_budgets for all
  using (auth.role() = 'service_role');

-- nominations: circle members can read
create policy "nominations: circle members read"
  on public.nominations for select
  using (
    exists (
      select 1 from public.circle_members cm
      where cm.circle_id = nominations.circle_id
        and cm.user_id = auth.uid()
    )
  );

create policy "nominations: service role full access"
  on public.nominations for all
  using (auth.role() = 'service_role');

-- nomination_votes: circle members can read and insert their own
create policy "nomination_votes: circle members read"
  on public.nomination_votes for select
  using (
    exists (
      select 1 from public.nominations n
      join public.circle_members cm on cm.circle_id = n.circle_id
      where n.id = nomination_votes.nomination_id
        and cm.user_id = auth.uid()
    )
  );

create policy "nomination_votes: voter inserts own"
  on public.nomination_votes for insert
  with check (voter_id = auth.uid());

create policy "nomination_votes: service role full access"
  on public.nomination_votes for all
  using (auth.role() = 'service_role');

-- circle_rodeo_events: circle members read non-board-only events
create policy "circle_rodeo_events: members read"
  on public.circle_rodeo_events for select
  using (
    board_only = false
    and exists (
      select 1 from public.circle_members cm
      where cm.circle_id = circle_rodeo_events.circle_id
        and cm.user_id = auth.uid()
    )
  );

-- board members can see all events including board_only
create policy "circle_rodeo_events: board reads all"
  on public.circle_rodeo_events for select
  using (
    exists (
      select 1 from public.circle_members cm
      where cm.circle_id = circle_rodeo_events.circle_id
        and cm.user_id = auth.uid()
        and cm.role in ('board', 'founder')
    )
  );

create policy "circle_rodeo_events: service role full access"
  on public.circle_rodeo_events for all
  using (auth.role() = 'service_role');
