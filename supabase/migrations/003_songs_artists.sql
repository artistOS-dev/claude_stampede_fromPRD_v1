-- ============================================================
-- Stampede — Songs & Artists in Circles
-- Migration: 003_songs_artists.sql
-- ============================================================

-- Songs shared inside a circle
create table public.circle_songs (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid references public.circles(id) on delete cascade not null,
  shared_by uuid references public.profiles(id) on delete set null,
  title text not null,
  artist text not null,
  album text,
  spotify_url text,
  cover_url text,
  avg_rating decimal(3,2) default 0.00,
  rating_count integer default 0,
  created_at timestamptz default now()
);

-- One rating per user per song
create table public.song_ratings (
  id uuid primary key default gen_random_uuid(),
  song_id uuid references public.circle_songs(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  rating integer not null check (rating between 1 and 5),
  created_at timestamptz default now(),
  unique(song_id, user_id)
);

-- Favourite artists pinned to a circle
create table public.circle_artists (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid references public.circles(id) on delete cascade not null,
  added_by uuid references public.profiles(id) on delete set null,
  artist_name text not null,
  created_at timestamptz default now(),
  unique(circle_id, artist_name)
);

-- ── Triggers ──────────────────────────────────────────────────

-- Keep avg_rating / rating_count on circle_songs up to date
create or replace function public.handle_song_rating()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.circle_songs
  set
    avg_rating   = (select round(avg(rating)::numeric, 2) from public.song_ratings where song_id = coalesce(new.song_id, old.song_id)),
    rating_count = (select count(*)                        from public.song_ratings where song_id = coalesce(new.song_id, old.song_id))
  where id = coalesce(new.song_id, old.song_id);
  return coalesce(new, old);
end;
$$;

create trigger on_song_rating_change
  after insert or update or delete on public.song_ratings
  for each row execute procedure public.handle_song_rating();

-- ── RLS ───────────────────────────────────────────────────────

alter table public.circle_songs   enable row level security;
alter table public.song_ratings   enable row level security;
alter table public.circle_artists enable row level security;

-- circle_songs: circle members can read; authenticated users can insert
create policy "circle_songs: members can read"
  on public.circle_songs for select
  using (
    exists (
      select 1 from public.circle_members
      where circle_id = circle_songs.circle_id
        and user_id = auth.uid()
        and status = 'active'
    )
  );

create policy "circle_songs: members can add"
  on public.circle_songs for insert
  with check (
    auth.uid() = shared_by
    and exists (
      select 1 from public.circle_members
      where circle_id = circle_songs.circle_id
        and user_id = auth.uid()
        and status = 'active'
    )
  );

create policy "circle_songs: owner can delete"
  on public.circle_songs for delete
  using (auth.uid() = shared_by or auth.role() = 'service_role');

-- song_ratings: members can read/write their own ratings
create policy "song_ratings: members can read"
  on public.song_ratings for select
  using (auth.role() = 'authenticated');

create policy "song_ratings: users can rate"
  on public.song_ratings for insert
  with check (auth.uid() = user_id);

create policy "song_ratings: users can update own rating"
  on public.song_ratings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "song_ratings: users can delete own rating"
  on public.song_ratings for delete
  using (auth.uid() = user_id);

-- circle_artists: members can read; members can add/delete
create policy "circle_artists: members can read"
  on public.circle_artists for select
  using (
    exists (
      select 1 from public.circle_members
      where circle_id = circle_artists.circle_id
        and user_id = auth.uid()
        and status = 'active'
    )
  );

create policy "circle_artists: members can add"
  on public.circle_artists for insert
  with check (
    auth.uid() = added_by
    and exists (
      select 1 from public.circle_members
      where circle_id = circle_artists.circle_id
        and user_id = auth.uid()
        and status = 'active'
    )
  );

create policy "circle_artists: members can remove"
  on public.circle_artists for delete
  using (auth.uid() = added_by or auth.role() = 'service_role');
