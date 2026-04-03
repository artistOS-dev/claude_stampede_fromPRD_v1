-- ============================================================
-- Migration: 005_board_challenge_proposals.sql
-- Superfan board approval gating for Circle-vs-Circle challenges
-- ============================================================

-- Reuse updated_at trigger from prior migrations
-- (trigger function set_updated_at already exists)

-- ── challenge_proposals ──────────────────────────────────────
-- A proposal to challenge another Circle, submitted by a board/founder
-- member and requiring majority board approval before sending.

create table if not exists public.challenge_proposals (
  id                 uuid primary key default gen_random_uuid(),
  circle_id          uuid not null references public.circles(id) on delete cascade,
  target_circle_id   uuid not null references public.circles(id) on delete cascade,
  initiated_by       uuid not null references public.profiles(id) on delete cascade,
  title              text not null,
  description        text,
  credit_buy_in      integer not null check (credit_buy_in > 0),
  end_date           timestamptz,
  -- pending → approved/held/declined → (if approved) sent
  status             text not null default 'pending'
                       check (status in ('pending', 'approved', 'held', 'declined', 'sent')),
  board_comment      text,           -- populated on hold/decline by the board
  rodeo_id           uuid references public.rodeos(id), -- set when status = 'sent'
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create trigger set_updated_at_challenge_proposals
  before update on public.challenge_proposals
  for each row execute function public.set_updated_at();

-- ── challenge_proposal_songs ─────────────────────────────────
-- Songs the challenging Circle wants to field (chosen at proposal time).

create table if not exists public.challenge_proposal_songs (
  id            uuid primary key default gen_random_uuid(),
  proposal_id   uuid not null references public.challenge_proposals(id) on delete cascade,
  song_id       uuid not null references public.circle_songs(id) on delete cascade,
  label         text check (label in ('studio', 'live')),
  created_at    timestamptz default now()
);

-- ── challenge_proposal_votes ─────────────────────────────────
-- One vote per board/founder member per proposal.

create table if not exists public.challenge_proposal_votes (
  id           uuid primary key default gen_random_uuid(),
  proposal_id  uuid not null references public.challenge_proposals(id) on delete cascade,
  voter_id     uuid not null references public.profiles(id) on delete cascade,
  vote         text not null check (vote in ('approve', 'hold', 'decline')),
  comment      text,
  created_at   timestamptz default now(),
  unique (proposal_id, voter_id)
);

-- ── Indexes ──────────────────────────────────────────────────

create index if not exists idx_challenge_proposals_circle
  on public.challenge_proposals(circle_id);

create index if not exists idx_challenge_proposals_status
  on public.challenge_proposals(status);

create index if not exists idx_challenge_proposal_votes_proposal
  on public.challenge_proposal_votes(proposal_id);

-- ── RLS ──────────────────────────────────────────────────────

alter table public.challenge_proposals      enable row level security;
alter table public.challenge_proposal_songs enable row level security;
alter table public.challenge_proposal_votes enable row level security;

-- challenge_proposals: visible to members of either circle involved

create policy "challenge_proposals: circle members can read"
  on public.challenge_proposals for select
  using (
    exists (
      select 1 from public.circle_members cm
      where cm.user_id = auth.uid()
        and cm.status = 'active'
        and cm.circle_id in (challenge_proposals.circle_id, challenge_proposals.target_circle_id)
    )
  );

create policy "challenge_proposals: board/founder can insert"
  on public.challenge_proposals for insert
  with check (
    exists (
      select 1 from public.circle_members cm
      where cm.user_id = auth.uid()
        and cm.circle_id = challenge_proposals.circle_id
        and cm.status = 'active'
        and cm.role in ('board', 'founder')
    )
  );

create policy "challenge_proposals: board/founder can update own circle"
  on public.challenge_proposals for update
  using (
    exists (
      select 1 from public.circle_members cm
      where cm.user_id = auth.uid()
        and cm.circle_id = challenge_proposals.circle_id
        and cm.status = 'active'
        and cm.role in ('board', 'founder')
    )
  );

-- challenge_proposal_songs: readable by circle members, writable by board

create policy "proposal_songs: circle members read"
  on public.challenge_proposal_songs for select
  using (
    exists (
      select 1
      from public.challenge_proposals cp
      join public.circle_members cm on cm.circle_id = cp.circle_id
      where cp.id = challenge_proposal_songs.proposal_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
    )
  );

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
        and cm.role in ('board', 'founder')
    )
  );

-- challenge_proposal_votes: board/founder of the challenging circle only

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
        and cm.role in ('board', 'founder')
    )
  );

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
        and cm.role in ('board', 'founder')
    )
  );

create policy "proposal_votes: voter can update own vote while pending"
  on public.challenge_proposal_votes for update
  using (
    voter_id = auth.uid()
    and exists (
      select 1 from public.challenge_proposals cp
      where cp.id = challenge_proposal_votes.proposal_id
        and cp.status = 'pending'
    )
  );
