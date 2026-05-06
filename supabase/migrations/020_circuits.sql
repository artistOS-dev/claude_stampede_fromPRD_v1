-- ============================================================
-- Circuits — tournament brackets for live festival competitions
-- Artist managers register artists; members vote on duels.
-- Bracket advances round by round until a champion is crowned.
-- ============================================================

-- ── Tables ───────────────────────────────────────────────────

create table public.circuits (
  id                     uuid        primary key default gen_random_uuid(),
  title                  text        not null,
  description            text,
  event_name             text,
  event_date             date,
  cover_image_url        text,
  status                 text        not null default 'draft'
    check (status in ('draft', 'open', 'active', 'complete')),
  max_artists            int         not null default 8
    check (max_artists in (4, 8, 16, 32)),
  current_round          int         not null default 0,
  voting_hours_per_round int         not null default 24
    check (voting_hours_per_round between 1 and 168),
  created_by             uuid        references public.profiles(id) on delete set null,
  winner_participant_id  uuid,        -- back-ref; FK added below
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
);

-- One row per artist competing in a circuit
create table public.circuit_participants (
  id                uuid        primary key default gen_random_uuid(),
  circuit_id        uuid        not null references public.circuits(id) on delete cascade,
  artist_manager_id uuid        not null references public.profiles(id) on delete cascade,
  artist_name       text        not null,
  artist_image_url  text,
  seed              int,
  status            text        not null default 'active'
    check (status in ('active', 'eliminated', 'champion')),
  created_at        timestamptz default now(),
  unique (circuit_id, artist_manager_id)
);

alter table public.circuits add constraint circuits_winner_fk
  foreign key (winner_participant_id)
  references public.circuit_participants(id) on delete set null;

-- Individual bracket matchups
create table public.circuit_duels (
  id                    uuid        primary key default gen_random_uuid(),
  circuit_id            uuid        not null references public.circuits(id) on delete cascade,
  round_number          int         not null,
  position              int         not null,   -- 1-indexed within the round
  participant_left_id   uuid        references public.circuit_participants(id) on delete set null,
  participant_right_id  uuid        references public.circuit_participants(id) on delete set null,
  song_left_id          uuid        references public.circle_songs(id) on delete set null,
  song_right_id         uuid        references public.circle_songs(id) on delete set null,
  status                text        not null default 'pending'
    check (status in ('pending', 'song_selection', 'voting', 'complete')),
  winner_participant_id uuid        references public.circuit_participants(id) on delete set null,
  voting_starts_at      timestamptz,
  voting_ends_at        timestamptz,
  created_at            timestamptz default now(),
  unique (circuit_id, round_number, position)
);

-- One vote per member per duel
create table public.circuit_duel_votes (
  id                    uuid        primary key default gen_random_uuid(),
  circuit_duel_id       uuid        not null references public.circuit_duels(id)       on delete cascade,
  voter_id              uuid        not null references public.profiles(id)             on delete cascade,
  chosen_participant_id uuid        not null references public.circuit_participants(id) on delete cascade,
  created_at            timestamptz default now(),
  unique (circuit_duel_id, voter_id)
);

-- ── Indexes ──────────────────────────────────────────────────

create index circuit_participants_circuit_idx on public.circuit_participants(circuit_id);
create index circuit_duels_circuit_idx        on public.circuit_duels(circuit_id);
create index circuit_duel_votes_duel_idx      on public.circuit_duel_votes(circuit_duel_id);
create index circuit_duel_votes_voter_idx     on public.circuit_duel_votes(voter_id);

-- ── RLS ──────────────────────────────────────────────────────

alter table public.circuits             enable row level security;
alter table public.circuit_participants enable row level security;
alter table public.circuit_duels        enable row level security;
alter table public.circuit_duel_votes   enable row level security;

-- Circuits: auth users read non-draft; producers+admins manage all
create policy "circuits_read_public" on public.circuits for select
  using (auth.uid() is not null and status != 'draft');
create policy "circuits_admin_all" on public.circuits for all
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and (role = 'stampede_producer' or is_super_admin = true)
  ));

-- Participants: all auth users read; artist_managers insert their own
create policy "cp_read"   on public.circuit_participants for select using (auth.uid() is not null);
create policy "cp_insert" on public.circuit_participants for insert
  with check (
    artist_manager_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'artist_manager')
  );

-- Duels: all auth users read; mutations via service role only (managed server-side)
create policy "cd_read" on public.circuit_duels for select using (auth.uid() is not null);

-- Votes: all read; users insert and delete their own
create policy "cdv_read"   on public.circuit_duel_votes for select using (auth.uid() is not null);
create policy "cdv_insert" on public.circuit_duel_votes for insert with check (voter_id = auth.uid());
create policy "cdv_delete" on public.circuit_duel_votes for delete  using  (voter_id = auth.uid());

-- ── updated_at trigger ────────────────────────────────────────

create or replace function public.touch_circuits_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_circuits_updated_at
  before update on public.circuits
  for each row execute function public.touch_circuits_updated_at();
