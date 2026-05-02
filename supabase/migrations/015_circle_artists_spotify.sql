-- Add Spotify metadata columns to circle_artists
alter table public.circle_artists
  add column if not exists spotify_url text,
  add column if not exists spotify_image_url text;
