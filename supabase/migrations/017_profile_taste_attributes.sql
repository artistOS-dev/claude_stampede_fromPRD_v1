-- Add taste profile attributes to profiles table
-- These drive circle/genre matching and user similarity scoring

alter table public.profiles
  add column if not exists favorite_genres     text[]  default '{}',
  add column if not exists favorite_artist_ids text[]  default '{}',
  add column if not exists favorite_artist_names text[] default '{}';
