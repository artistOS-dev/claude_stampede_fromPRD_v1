-- Add Apple Music URL to circle_songs so imported tracks carry their Apple Music link.
alter table public.circle_songs
  add column if not exists apple_music_url text;
