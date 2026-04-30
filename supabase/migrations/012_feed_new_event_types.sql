-- ============================================================
-- Stampede — Expand feed event types: song_added, member_joined
-- Migration: 012_feed_new_event_types.sql
-- Run in Supabase SQL Editor
-- ============================================================

-- Postgres requires dropping + re-adding the CHECK constraint to alter it.
alter table public.circle_rodeo_events
  drop constraint if exists circle_rodeo_events_event_type_check;

alter table public.circle_rodeo_events
  add constraint circle_rodeo_events_event_type_check
  check (event_type in (
    'challenge_sent',
    'challenge_received',
    'challenge_accepted',
    'challenge_declined',
    'rodeo_opened',
    'vote_milestone',
    'result_posted',
    'artist_promoted',
    'credits_distributed',
    'budget_reset',
    'board_approval_pending',
    'nomination_passed',
    'nomination_inducted',
    'song_added',
    'member_joined'
  ));
