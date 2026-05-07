-- ── Artist Stables ────────────────────────────────────────────────────────────
-- Each artist_manager gets one Stable: their artist's official presence.

create table public.stables (
  id            uuid primary key default gen_random_uuid(),
  manager_id    uuid not null references public.profiles(id) on delete cascade,
  artist_name   text not null,
  slug          text not null unique,           -- URL-safe handle, auto-derived from artist_name
  bio           text,
  avatar_url    text,
  banner_url    text,
  genres        text[],
  location      text,
  -- Social links (external, excluding Stampede)
  instagram_url   text,
  twitter_url     text,
  tiktok_url      text,
  spotify_url     text,
  apple_music_url text,
  youtube_url     text,
  website_url     text,
  -- Virtual concert
  next_concert_at    timestamptz,
  concert_stream_url text,
  -- Visibility
  is_published boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- One stable per manager
create unique index stables_manager_idx on public.stables(manager_id);

-- ── Followers ────────────────────────────────────────────────────────────────
create table public.stable_followers (
  stable_id   uuid not null references public.stables(id) on delete cascade,
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_at timestamptz not null default now(),
  primary key (stable_id, follower_id)
);

-- ── Song Catalog ─────────────────────────────────────────────────────────────
create table public.stable_songs (
  id               uuid primary key default gen_random_uuid(),
  stable_id        uuid not null references public.stables(id) on delete cascade,
  title            text not null,
  artist           text not null,
  album            text,
  release_year     int,
  cover_url        text,
  audio_preview_url text,
  spotify_url      text,
  apple_music_url  text,
  is_published     boolean not null default true,
  created_at       timestamptz not null default now()
);

create index stable_songs_stable_idx on public.stable_songs(stable_id);

-- ── Song Ratings ─────────────────────────────────────────────────────────────
create table public.stable_song_ratings (
  song_id   uuid not null references public.stable_songs(id) on delete cascade,
  rater_id  uuid not null references public.profiles(id) on delete cascade,
  rating    int  not null check (rating between 1 and 5),
  rated_at  timestamptz not null default now(),
  primary key (song_id, rater_id)
);

-- ── Social Posts ──────────────────────────────────────────────────────────────
create table public.stable_posts (
  id         uuid primary key default gen_random_uuid(),
  stable_id  uuid not null references public.stables(id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 1000),
  media_url  text,
  media_type text check (media_type in ('image', 'video')),
  created_at timestamptz not null default now()
);

create index stable_posts_stable_idx on public.stable_posts(stable_id, created_at desc);

-- ── Merchandise ───────────────────────────────────────────────────────────────
create table public.stable_merchandise (
  id           uuid primary key default gen_random_uuid(),
  stable_id    uuid not null references public.stables(id) on delete cascade,
  name         text not null,
  description  text,
  price_cents  int  not null check (price_cents > 0),
  image_url    text,
  category     text not null default 'other'
               check (category in ('t-shirt','hoodie','poster','vinyl','hat','accessory','other')),
  sizes        text[],          -- e.g. ['S','M','L','XL'] for clothing
  is_available boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.stables            enable row level security;
alter table public.stable_followers   enable row level security;
alter table public.stable_songs       enable row level security;
alter table public.stable_song_ratings enable row level security;
alter table public.stable_posts       enable row level security;
alter table public.stable_merchandise enable row level security;

-- Stables: published ones or own stable visible
create policy "stables_select" on public.stables for select to authenticated
  using (is_published = true or manager_id = auth.uid());

create policy "stables_insert" on public.stables for insert to authenticated
  with check (manager_id = auth.uid());

create policy "stables_update" on public.stables for update to authenticated
  using (manager_id = auth.uid());

-- Followers: all auth users can see; users manage their own
create policy "stable_followers_select" on public.stable_followers for select to authenticated
  using (true);

create policy "stable_followers_insert" on public.stable_followers for insert to authenticated
  with check (follower_id = auth.uid());

create policy "stable_followers_delete" on public.stable_followers for delete to authenticated
  using (follower_id = auth.uid());

-- Songs: readable if stable is published or own stable
create policy "stable_songs_select" on public.stable_songs for select to authenticated
  using (
    exists (
      select 1 from public.stables s
      where s.id = stable_id and (s.is_published = true or s.manager_id = auth.uid())
    )
  );

create policy "stable_songs_insert" on public.stable_songs for insert to authenticated
  with check (
    exists (select 1 from public.stables s where s.id = stable_id and s.manager_id = auth.uid())
  );

create policy "stable_songs_update" on public.stable_songs for update to authenticated
  using (
    exists (select 1 from public.stables s where s.id = stable_id and s.manager_id = auth.uid())
  );

create policy "stable_songs_delete" on public.stable_songs for delete to authenticated
  using (
    exists (select 1 from public.stables s where s.id = stable_id and s.manager_id = auth.uid())
  );

-- Ratings: all auth users can read/write their own
create policy "stable_song_ratings_select" on public.stable_song_ratings for select to authenticated
  using (true);

create policy "stable_song_ratings_upsert" on public.stable_song_ratings for insert to authenticated
  with check (rater_id = auth.uid());

create policy "stable_song_ratings_update" on public.stable_song_ratings for update to authenticated
  using (rater_id = auth.uid());

-- Posts: readable if stable published or own
create policy "stable_posts_select" on public.stable_posts for select to authenticated
  using (
    exists (
      select 1 from public.stables s
      where s.id = stable_id and (s.is_published = true or s.manager_id = auth.uid())
    )
  );

create policy "stable_posts_insert" on public.stable_posts for insert to authenticated
  with check (
    exists (select 1 from public.stables s where s.id = stable_id and s.manager_id = auth.uid())
  );

create policy "stable_posts_delete" on public.stable_posts for delete to authenticated
  using (
    exists (select 1 from public.stables s where s.id = stable_id and s.manager_id = auth.uid())
  );

-- Merch: readable if published or own; manager mutates
create policy "stable_merchandise_select" on public.stable_merchandise for select to authenticated
  using (
    exists (
      select 1 from public.stables s
      where s.id = stable_id and (s.is_published = true or s.manager_id = auth.uid())
    )
  );

create policy "stable_merchandise_insert" on public.stable_merchandise for insert to authenticated
  with check (
    exists (select 1 from public.stables s where s.id = stable_id and s.manager_id = auth.uid())
  );

create policy "stable_merchandise_update" on public.stable_merchandise for update to authenticated
  using (
    exists (select 1 from public.stables s where s.id = stable_id and s.manager_id = auth.uid())
  );

create policy "stable_merchandise_delete" on public.stable_merchandise for delete to authenticated
  using (
    exists (select 1 from public.stables s where s.id = stable_id and s.manager_id = auth.uid())
  );
