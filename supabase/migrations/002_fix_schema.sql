-- ============================================================
-- Stampede — Fix Schema
-- Migration: 002_fix_schema.sql
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Allow authenticated users to insert their own profile row
--    (handles the case where the trigger didn't fire, e.g. the user was
--    created before this migration was first applied)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles: users can insert own profile'
  ) then
    execute $policy$
      create policy "profiles: users can insert own profile"
        on public.profiles for insert
        with check (auth.uid() = id)
    $policy$;
  end if;
end;
$$;

-- 2. Back-fill profile rows for any auth users who have none
--    (safe to re-run — does nothing if rows already exist)
insert into public.profiles (id, email)
select u.id, u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- 3. Add missing columns to circles that the application code expects
alter table public.circles
  add column if not exists slug text unique,
  add column if not exists cover_image_url text,
  add column if not exists personality_types text[] default '{}',
  add column if not exists avg_rating decimal(3,2) default 0.00;

-- 4. Copy existing data into new columns
update public.circles
set
  personality_types = personality_tags,
  avg_rating        = avg_song_rating
where personality_types = '{}' or avg_rating = 0.00;
