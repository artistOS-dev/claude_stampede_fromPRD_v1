-- ============================================================
-- Stampede — Delete all test rodeo + circle data
-- Run in: Supabase Dashboard → SQL Editor
--
-- What gets deleted:
--   Rodeos (+ cascades):
--     rodeo_rankings, rodeo_results, rodeo_song_results,
--     rodeo_credit_distributions, credit_pools, distribution_rules,
--     rodeo_entries, rodeo_entry_songs, rodeo_votes
--   Circles (+ cascades):
--     circle_members, circle_invites, circle_songs, song_ratings,
--     circle_artists, circle_rodeo_events, challenge_proposals,
--     challenge_proposal_songs, challenge_proposal_votes,
--     nomination_budgets, nominations, nomination_votes
--
-- What is preserved:
--   profiles, auth.users (accounts stay intact)
-- ============================================================

begin;

-- 1. Orphaned feed events that reference rodeos (SET NULL on delete, not CASCADE)
--    Delete them before rodeos so no dangling NULL rodeo_id rows remain.
delete from public.circle_rodeo_events;

-- 2. challenge_proposals.rodeo_id has no ON DELETE rule (defaults to RESTRICT).
--    Null it out before deleting rodeos, then the proposals are wiped by the
--    circles cascade in step 4.
update public.challenge_proposals set rodeo_id = null where rodeo_id is not null;

-- 3. Delete all rodeos — cascades to:
--    credit_pools → distribution_rules
--    rodeo_entries → rodeo_entry_songs, rodeo_votes
--    rodeo_results → rodeo_song_results, rodeo_credit_distributions
--    rodeo_rankings
delete from public.rodeos;

-- 4. Delete all circles — cascades to:
--    circle_members, circle_invites, circle_songs → song_ratings,
--    circle_artists, challenge_proposals → challenge_proposal_songs,
--    challenge_proposal_votes, nomination_budgets, nominations → nomination_votes
delete from public.circles;

commit;

-- ── Verification ─────────────────────────────────────────────
select
  (select count(*) from public.rodeos)                   as rodeos,
  (select count(*) from public.circles)                  as circles,
  (select count(*) from public.rodeo_rankings)           as rodeo_rankings,
  (select count(*) from public.rodeo_entries)            as rodeo_entries,
  (select count(*) from public.rodeo_results)            as rodeo_results,
  (select count(*) from public.credit_pools)             as credit_pools,
  (select count(*) from public.challenge_proposals)      as challenge_proposals,
  (select count(*) from public.circle_rodeo_events)      as feed_events,
  (select count(*) from public.nominations)              as nominations,
  (select count(*) from public.circle_songs)             as circle_songs,
  (select count(*) from public.profiles)                 as profiles_preserved;
