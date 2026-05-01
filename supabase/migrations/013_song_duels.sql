-- ============================================================
-- Song Duels — two songs compete; users swipe to pick a winner.
-- Superadmins create/publish duels; all users can vote once.
-- ============================================================

-- ── Tables ────────────────────────────────────────────────────

create table public.song_duels (
  id             uuid        primary key default gen_random_uuid(),
  title          text        not null,
  description    text,
  song_left_id   uuid        not null references public.circle_songs(id),
  song_right_id  uuid        not null references public.circle_songs(id),
  status         text        not null default 'draft'
                               check (status in ('draft', 'active', 'closed')),
  end_date       timestamptz not null,
  winner_song_id uuid        references public.circle_songs(id),
  created_by     uuid        not null references public.profiles(id),
  created_at     timestamptz not null default now(),
  constraint duel_songs_must_differ check (song_left_id != song_right_id)
);

create table public.song_duel_votes (
  id             uuid        primary key default gen_random_uuid(),
  duel_id        uuid        not null references public.song_duels(id) on delete cascade,
  voter_id       uuid        not null references public.profiles(id),
  chosen_song_id uuid        not null references public.circle_songs(id),
  voted_at       timestamptz not null default now(),
  unique (duel_id, voter_id)
);

-- ── Indexes ───────────────────────────────────────────────────

create index song_duels_status_idx      on public.song_duels(status);
create index song_duels_end_date_idx    on public.song_duels(end_date);
create index song_duel_votes_duel_idx   on public.song_duel_votes(duel_id);
create index song_duel_votes_voter_idx  on public.song_duel_votes(voter_id);

-- ── RLS ───────────────────────────────────────────────────────

alter table public.song_duels      enable row level security;
alter table public.song_duel_votes enable row level security;

-- Any authenticated user may read active or closed duels
create policy "duels_read_public" on public.song_duels
  for select using (
    auth.uid() is not null
    and status in ('active', 'closed')
  );

-- Superadmins may read/write all duels (including drafts)
create policy "duels_superadmin_all" on public.song_duels
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_super_admin = true
    )
  );

-- Authenticated users may cast their own vote
create policy "duel_votes_insert_own" on public.song_duel_votes
  for insert with check (auth.uid() = voter_id);

-- Users may read their own votes
create policy "duel_votes_select_own" on public.song_duel_votes
  for select using (auth.uid() = voter_id);
