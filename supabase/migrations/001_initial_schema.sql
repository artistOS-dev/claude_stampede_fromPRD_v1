-- ============================================================
-- Stampede — Initial Schema
-- Migration: 001_initial_schema.sql
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- Profiles table (extends auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text unique not null,
  display_name text unique,
  avatar_url text,
  role text check (role in ('fan', 'artist', 'producer')) default 'fan',
  subscription_tier text check (subscription_tier in ('free', 'fan', 'superfan', 'artist', 'producer')) default 'free',
  personality_types text[] default '{}',
  signup_step integer default 1,
  signup_completed_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Circles table
create table public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  core_artists text[] default '{}',
  member_count integer default 0,
  avg_song_rating decimal(3,2) default 0.00,
  max_members integer,
  is_paid boolean default false,
  required_tier text check (required_tier in ('free', 'fan', 'superfan', 'artist', 'producer')),
  created_by uuid references public.profiles(id),
  personality_tags text[] default '{}',
  image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Circle members
create table public.circle_members (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid references public.circles(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  status text check (status in ('active', 'pending', 'banned')) default 'active',
  role text check (role in ('member', 'board', 'founder')) default 'member',
  joined_at timestamptz default now(),
  unique(circle_id, user_id)
);

-- Invite links
create table public.circle_invites (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid references public.circles(id) on delete cascade not null,
  inviter_id uuid references public.profiles(id) on delete cascade not null,
  token text unique not null default encode(gen_random_bytes(16), 'hex'),
  uses_count integer default 0,
  max_uses integer,
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- 1. Auto-create a profile row when a new user signs up via Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Keep updated_at current on the profiles table
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_profile_updated
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger on_circle_updated
  before update on public.circles
  for each row execute procedure public.handle_updated_at();

-- 3. Keep member_count in sync on the circles table
create or replace function public.handle_circle_member_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') then
    update public.circles
    set member_count = member_count + 1
    where id = new.circle_id;
    return new;
  elsif (TG_OP = 'DELETE') then
    update public.circles
    set member_count = greatest(member_count - 1, 0)
    where id = old.circle_id;
    return old;
  end if;
end;
$$;

create trigger on_circle_member_insert
  after insert on public.circle_members
  for each row execute procedure public.handle_circle_member_count();

create trigger on_circle_member_delete
  after delete on public.circle_members
  for each row execute procedure public.handle_circle_member_count();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.circle_invites enable row level security;

-- ---- profiles ----

-- Users can read their own profile
create policy "profiles: users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Users can update their own profile
create policy "profiles: users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Service role can read all profiles (bypasses RLS by default,
-- but explicit policy for clarity)
create policy "profiles: service role full access"
  on public.profiles for all
  using (auth.role() = 'service_role');

-- ---- circles ----

-- Anyone (including anonymous) can read circles
create policy "circles: public read"
  on public.circles for select
  using (true);

-- Authenticated users can create circles
create policy "circles: authenticated users can create"
  on public.circles for insert
  with check (auth.role() = 'authenticated');

-- Only the creator (or service role) can update/delete a circle
create policy "circles: creator can update"
  on public.circles for update
  using (auth.uid() = created_by or auth.role() = 'service_role')
  with check (auth.uid() = created_by or auth.role() = 'service_role');

create policy "circles: creator can delete"
  on public.circles for delete
  using (auth.uid() = created_by or auth.role() = 'service_role');

-- ---- circle_members ----

-- Users can read their own memberships
create policy "circle_members: users can read own memberships"
  on public.circle_members for select
  using (auth.uid() = user_id);

-- Authenticated users can read any membership row (for member counts / lists)
create policy "circle_members: authenticated read"
  on public.circle_members for select
  using (auth.role() = 'authenticated');

-- Authenticated users can join a circle (insert their own row)
create policy "circle_members: users can join"
  on public.circle_members for insert
  with check (auth.uid() = user_id and auth.role() = 'authenticated');

-- Users can leave a circle (delete their own row); founders/boards via service role
create policy "circle_members: users can leave"
  on public.circle_members for delete
  using (auth.uid() = user_id or auth.role() = 'service_role');

-- Service role can manage all memberships (bans, role changes, etc.)
create policy "circle_members: service role full access"
  on public.circle_members for all
  using (auth.role() = 'service_role');

-- ---- circle_invites ----

-- Authenticated users can read invite tokens (e.g. to validate a link)
create policy "circle_invites: authenticated read"
  on public.circle_invites for select
  using (auth.role() = 'authenticated');

-- Authenticated users can create invite links for circles they belong to
create policy "circle_invites: members can create invites"
  on public.circle_invites for insert
  with check (
    auth.uid() = inviter_id
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.circle_members
      where circle_id = circle_invites.circle_id
        and user_id = auth.uid()
        and status = 'active'
    )
  );

-- Inviter or service role can delete their own invite links
create policy "circle_invites: inviter can delete"
  on public.circle_invites for delete
  using (auth.uid() = inviter_id or auth.role() = 'service_role');

-- Service role full access
create policy "circle_invites: service role full access"
  on public.circle_invites for all
  using (auth.role() = 'service_role');
