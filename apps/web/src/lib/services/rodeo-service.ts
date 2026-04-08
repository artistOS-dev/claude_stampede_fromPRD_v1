// ============================================================
// Stampede — RodeoService
// Server-side service layer implementing all rodeo business rules
// from specs/rodeos-spec.md
// ============================================================

import { createClient } from '@/lib/supabase/server'
import type {
  RodeoType,
  RodeoStatus,
  VoterType,
  SongLabel,
} from '@/lib/types/rodeo'

// ── Error helper ──────────────────────────────────────────────

class RodeoError extends Error {
  constructor(message: string, public code: string, public status: number = 400) {
    super(message)
    this.name = 'RodeoError'
  }
}

// ── Types for service inputs ──────────────────────────────────

interface CreateRodeoInput {
  type: RodeoType
  title: string
  description?: string
  start_date?: string
  end_date?: string
}

interface ChallengeCircleInput {
  challenger_circle_id: string
  target_circle_id: string
  title: string
  description?: string
  credit_buy_in: number       // each circle contributes this amount
  song_ids: string[]          // songs from the challenger's circle
  song_labels?: Record<string, SongLabel>
  start_date?: string
  end_date?: string
}

interface AcceptChallengeInput {
  rodeo_id: string
  song_ids: string[]
  song_labels?: Record<string, SongLabel>
}

interface CastVoteInput {
  rodeo_id: string
  song_id: string
  target_entry_id: string
}

type ServiceResult<T> = { data: T; error: null } | { data: null; error: RodeoError }

// ── Service ───────────────────────────────────────────────────

/**
 * RodeoService enforces all business rules from specs/rodeos-spec.md.
 *
 * Key invariants:
 * - Both Circles must contribute equal credits (no exceptions)
 * - Songs are locked once internal vote passes (no substitutions)
 * - Subscription required to vote
 * - General public voters receive granted credits
 * - Platform fee deducted before prize distribution
 * - Rodeo history is permanent (no edits/deletes after archive)
 */
export const RodeoService = {

  // ────────────────────────────────────────────────────────────
  // createRodeo — generic rodeo creation (whale, grassroots, etc.)
  // ────────────────────────────────────────────────────────────
  async createRodeo(input: CreateRodeoInput): Promise<ServiceResult<{ rodeo_id: string; credit_pool_id: string }>> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: new RodeoError('Unauthorized', 'UNAUTHORIZED', 401) }

    // Insert rodeo
    const { data: rodeo, error: rodeoErr } = await supabase
      .from('rodeos')
      .insert({
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        start_date: input.start_date ?? null,
        end_date: input.end_date ?? null,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (rodeoErr || !rodeo) {
      return { data: null, error: new RodeoError(rodeoErr?.message ?? 'Failed to create rodeo', 'CREATE_FAILED', 500) }
    }

    // Create credit pool
    const { data: pool, error: poolErr } = await supabase
      .from('credit_pools')
      .insert({ rodeo_id: rodeo.id })
      .select('id')
      .single()

    if (poolErr || !pool) {
      return { data: null, error: new RodeoError(poolErr?.message ?? 'Failed to create credit pool', 'POOL_FAILED', 500) }
    }

    // Seed default distribution rules (45/45/10 split)
    await supabase.rpc('seed_default_distribution', { p_credit_pool_id: pool.id })

    return { data: { rodeo_id: rodeo.id, credit_pool_id: pool.id }, error: null }
  },

  // ────────────────────────────────────────────────────────────
  // challengeCircle — Circle-vs-Circle Showdown initiation
  // Spec: Step 1-3 of Showdown workflow
  // Rule: Both Circles must contribute equal credits
  // ────────────────────────────────────────────────────────────
  async challengeCircle(input: ChallengeCircleInput): Promise<ServiceResult<{ rodeo_id: string }>> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: new RodeoError('Unauthorized', 'UNAUTHORIZED', 401) }

    // Validate: challenger cannot challenge their own circle
    if (input.challenger_circle_id === input.target_circle_id) {
      return { data: null, error: new RodeoError('A circle cannot challenge itself', 'SELF_CHALLENGE') }
    }

    // Validate: user must be board or founder of the challenging circle
    const { data: membership } = await supabase
      .from('circle_members')
      .select('role')
      .eq('circle_id', input.challenger_circle_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!membership || !['board', 'founder'].includes(membership.role)) {
      return { data: null, error: new RodeoError('Only board members or founders can initiate challenges', 'NOT_AUTHORIZED', 403) }
    }

    // Validate: credit buy-in must be positive
    if (input.credit_buy_in <= 0) {
      return { data: null, error: new RodeoError('Credit buy-in must be greater than zero', 'INVALID_BUY_IN') }
    }

    // Validate: at least one song
    if (!input.song_ids.length) {
      return { data: null, error: new RodeoError('At least one song is required', 'NO_SONGS') }
    }

    // Validate: songs belong to the challenger's circle
    const { data: validSongs } = await supabase
      .from('circle_songs')
      .select('id')
      .eq('circle_id', input.challenger_circle_id)
      .in('id', input.song_ids)

    if (!validSongs || validSongs.length !== input.song_ids.length) {
      return { data: null, error: new RodeoError('All songs must belong to the challenging circle', 'INVALID_SONGS') }
    }

    // Validate: target circle exists
    const { data: targetCircle } = await supabase
      .from('circles')
      .select('id')
      .eq('id', input.target_circle_id)
      .single()

    if (!targetCircle) {
      return { data: null, error: new RodeoError('Target circle not found', 'TARGET_NOT_FOUND', 404) }
    }

    // Create the rodeo
    const { data: rodeo, error: rodeoErr } = await supabase
      .from('rodeos')
      .insert({
        type: 'showdown' as const,
        status: 'pending' as const,
        title: input.title,
        description: input.description ?? null,
        start_date: input.start_date ?? null,
        end_date: input.end_date ?? null,
        created_by: user.id,
        created_by_circle: input.challenger_circle_id,
      })
      .select('id')
      .single()

    if (rodeoErr || !rodeo) {
      return { data: null, error: new RodeoError(rodeoErr?.message ?? 'Failed to create rodeo', 'CREATE_FAILED', 500) }
    }

    // Create credit pool with the challenger's buy-in
    // circle_credits starts at the challenger's contribution;
    // it doubles when the target accepts
    const { data: pool, error: poolErr } = await supabase
      .from('credit_pools')
      .insert({
        rodeo_id: rodeo.id,
        circle_credits: input.credit_buy_in,
      })
      .select('id')
      .single()

    if (poolErr || !pool) {
      return { data: null, error: new RodeoError('Failed to create credit pool', 'POOL_FAILED', 500) }
    }

    await supabase.rpc('seed_default_distribution', { p_credit_pool_id: pool.id })

    // Create challenger's entry
    const { data: entry, error: entryErr } = await supabase
      .from('rodeo_entries')
      .insert({
        rodeo_id: rodeo.id,
        circle_id: input.challenger_circle_id,
        credits_contributed: input.credit_buy_in,
        status: 'confirmed' as const,
        internal_vote_passed: true,
      })
      .select('id')
      .single()

    if (entryErr || !entry) {
      return { data: null, error: new RodeoError('Failed to create entry', 'ENTRY_FAILED', 500) }
    }

    // Attach songs to the entry
    const entrySongs = input.song_ids.map((song_id) => ({
      entry_id: entry.id,
      song_id,
      label: input.song_labels?.[song_id] ?? null,
      locked: true,     // songs lock on challenge creation
    }))

    const { error: songsErr } = await supabase
      .from('rodeo_entry_songs')
      .insert(entrySongs)

    if (songsErr) {
      return { data: null, error: new RodeoError('Failed to attach songs', 'SONGS_FAILED', 500) }
    }

    // Create a pending entry for the target circle
    const { error: targetEntryErr } = await supabase
      .from('rodeo_entries')
      .insert({
        rodeo_id: rodeo.id,
        circle_id: input.target_circle_id,
        credits_contributed: 0,      // set to equal amount on accept
        status: 'pending' as const,
        internal_vote_passed: false,
      })

    if (targetEntryErr) {
      return { data: null, error: new RodeoError('Failed to create target entry', 'TARGET_ENTRY_FAILED', 500) }
    }

    return { data: { rodeo_id: rodeo.id }, error: null }
  },

  // ────────────────────────────────────────────────────────────
  // acceptChallenge — Target Circle accepts
  // Spec: Step 4 — they field songs + contribute equal credits
  // Rule: Credits must match the challenger's contribution exactly
  // ────────────────────────────────────────────────────────────
  async acceptChallenge(input: AcceptChallengeInput): Promise<ServiceResult<{ entry_id: string }>> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: new RodeoError('Unauthorized', 'UNAUTHORIZED', 401) }

    // Fetch the rodeo
    const { data: rodeo } = await supabase
      .from('rodeos')
      .select('id, status, type')
      .eq('id', input.rodeo_id)
      .single()

    if (!rodeo) {
      return { data: null, error: new RodeoError('Rodeo not found', 'NOT_FOUND', 404) }
    }

    if (rodeo.status !== 'pending') {
      return { data: null, error: new RodeoError('This rodeo is no longer accepting entries', 'NOT_PENDING') }
    }

    // Find the target's pending entry
    const { data: targetEntry } = await supabase
      .from('rodeo_entries')
      .select('id, circle_id, status')
      .eq('rodeo_id', input.rodeo_id)
      .eq('status', 'pending')
      .single()

    if (!targetEntry) {
      return { data: null, error: new RodeoError('No pending entry found for this rodeo', 'NO_PENDING_ENTRY') }
    }

    // Validate: user must be board or founder of the target circle
    const { data: membership } = await supabase
      .from('circle_members')
      .select('role')
      .eq('circle_id', targetEntry.circle_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!membership || !['board', 'founder'].includes(membership.role)) {
      return { data: null, error: new RodeoError('Only board members or founders can accept challenges', 'NOT_AUTHORIZED', 403) }
    }

    // At least one song required
    if (!input.song_ids.length) {
      return { data: null, error: new RodeoError('At least one song is required', 'NO_SONGS') }
    }

    // Validate songs belong to the target circle
    const { data: validSongs } = await supabase
      .from('circle_songs')
      .select('id')
      .eq('circle_id', targetEntry.circle_id)
      .in('id', input.song_ids)

    if (!validSongs || validSongs.length !== input.song_ids.length) {
      return { data: null, error: new RodeoError('All songs must belong to your circle', 'INVALID_SONGS') }
    }

    // Get the challenger's credit contribution to enforce equal buy-in
    const { data: challengerEntry } = await supabase
      .from('rodeo_entries')
      .select('credits_contributed')
      .eq('rodeo_id', input.rodeo_id)
      .eq('status', 'confirmed')
      .single()

    if (!challengerEntry) {
      return { data: null, error: new RodeoError('Challenger entry not found', 'CHALLENGER_NOT_FOUND', 500) }
    }

    const equalCredits = challengerEntry.credits_contributed

    // Update the target entry: confirm + match credits
    const { error: updateErr } = await supabase
      .from('rodeo_entries')
      .update({
        status: 'confirmed',
        internal_vote_passed: true,
        credits_contributed: equalCredits,
      })
      .eq('id', targetEntry.id)

    if (updateErr) {
      return { data: null, error: new RodeoError('Failed to confirm entry', 'UPDATE_FAILED', 500) }
    }

    // Attach songs (locked immediately)
    const entrySongs = input.song_ids.map((song_id) => ({
      entry_id: targetEntry.id,
      song_id,
      label: input.song_labels?.[song_id] ?? null,
      locked: true,
    }))

    const { error: songsErr } = await supabase
      .from('rodeo_entry_songs')
      .insert(entrySongs)

    if (songsErr) {
      return { data: null, error: new RodeoError('Failed to attach songs', 'SONGS_FAILED', 500) }
    }

    // Update credit pool: double the circle_credits (both sides now in)
    const { error: poolErr } = await supabase
      .from('credit_pools')
      .update({ circle_credits: equalCredits * 2 })
      .eq('rodeo_id', input.rodeo_id)

    if (poolErr) {
      return { data: null, error: new RodeoError('Failed to update credit pool', 'POOL_UPDATE_FAILED', 500) }
    }

    return { data: { entry_id: targetEntry.id }, error: null }
  },

  // ────────────────────────────────────────────────────────────
  // declineChallenge — Target Circle declines
  // Spec: Step 4 — board votes to decline
  // ────────────────────────────────────────────────────────────
  async declineChallenge(rodeo_id: string): Promise<ServiceResult<{ success: true }>> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: new RodeoError('Unauthorized', 'UNAUTHORIZED', 401) }

    // Fetch the pending entry
    const { data: targetEntry } = await supabase
      .from('rodeo_entries')
      .select('id, circle_id')
      .eq('rodeo_id', rodeo_id)
      .eq('status', 'pending')
      .single()

    if (!targetEntry) {
      return { data: null, error: new RodeoError('No pending entry to decline', 'NO_PENDING_ENTRY') }
    }

    // Validate: user must be board or founder
    const { data: membership } = await supabase
      .from('circle_members')
      .select('role')
      .eq('circle_id', targetEntry.circle_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!membership || !['board', 'founder'].includes(membership.role)) {
      return { data: null, error: new RodeoError('Only board members or founders can decline challenges', 'NOT_AUTHORIZED', 403) }
    }

    // Withdraw the entry
    const { error: withdrawErr } = await supabase
      .from('rodeo_entries')
      .update({ status: 'withdrawn' })
      .eq('id', targetEntry.id)

    if (withdrawErr) {
      return { data: null, error: new RodeoError('Failed to withdraw entry', 'WITHDRAW_FAILED', 500) }
    }

    // Close the rodeo — challenge was declined
    const { error: closeErr } = await supabase
      .from('rodeos')
      .update({ status: 'closed' })
      .eq('id', rodeo_id)
      .eq('status', 'pending')

    if (closeErr) {
      return { data: null, error: new RodeoError('Failed to close rodeo', 'CLOSE_FAILED', 500) }
    }

    return { data: { success: true }, error: null }
  },

  // ────────────────────────────────────────────────────────────
  // lockSongs — Lock songs after internal vote passes
  // Spec: "Songs are locked once the internal vote passes — no substitutions"
  // ────────────────────────────────────────────────────────────
  async lockSongs(entry_id: string): Promise<ServiceResult<{ success: true }>> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: new RodeoError('Unauthorized', 'UNAUTHORIZED', 401) }

    // Fetch the entry
    const { data: entry } = await supabase
      .from('rodeo_entries')
      .select('id, circle_id, artist_id, internal_vote_passed')
      .eq('id', entry_id)
      .single()

    if (!entry) {
      return { data: null, error: new RodeoError('Entry not found', 'NOT_FOUND', 404) }
    }

    // Already locked
    if (entry.internal_vote_passed) {
      return { data: null, error: new RodeoError('Songs are already locked for this entry', 'ALREADY_LOCKED') }
    }

    // Validate: user must be board/founder of the entry's circle, or the artist
    if (entry.circle_id) {
      const { data: membership } = await supabase
        .from('circle_members')
        .select('role')
        .eq('circle_id', entry.circle_id)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()

      if (!membership || !['board', 'founder'].includes(membership.role)) {
        return { data: null, error: new RodeoError('Not authorized to lock songs', 'NOT_AUTHORIZED', 403) }
      }
    } else if (entry.artist_id && entry.artist_id !== user.id) {
      return { data: null, error: new RodeoError('Only the artist can lock their songs', 'NOT_AUTHORIZED', 403) }
    }

    // Mark internal vote as passed
    const { error: entryErr } = await supabase
      .from('rodeo_entries')
      .update({ internal_vote_passed: true, status: 'confirmed' })
      .eq('id', entry_id)

    if (entryErr) {
      return { data: null, error: new RodeoError('Failed to update entry', 'UPDATE_FAILED', 500) }
    }

    // Lock all songs on this entry
    const { error: lockErr } = await supabase
      .from('rodeo_entry_songs')
      .update({ locked: true })
      .eq('entry_id', entry_id)

    if (lockErr) {
      return { data: null, error: new RodeoError('Failed to lock songs', 'LOCK_FAILED', 500) }
    }

    return { data: { success: true }, error: null }
  },

  // ────────────────────────────────────────────────────────────
  // openRodeo — Transition from pending → open (voting window)
  // Spec: Step 6 — countdown goes live
  // Precondition: all entries must be confirmed
  // ────────────────────────────────────────────────────────────
  async openRodeo(rodeo_id: string): Promise<ServiceResult<{ success: true }>> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: new RodeoError('Unauthorized', 'UNAUTHORIZED', 401) }

    // Fetch rodeo
    const { data: rodeo } = await supabase
      .from('rodeos')
      .select('id, status, created_by')
      .eq('id', rodeo_id)
      .single()

    if (!rodeo) {
      return { data: null, error: new RodeoError('Rodeo not found', 'NOT_FOUND', 404) }
    }

    if (rodeo.status !== 'pending') {
      return { data: null, error: new RodeoError(`Cannot open a rodeo with status "${rodeo.status}"`, 'INVALID_STATUS') }
    }

    if (rodeo.created_by !== user.id) {
      return { data: null, error: new RodeoError('Only the rodeo creator can open it', 'NOT_AUTHORIZED', 403) }
    }

    // All entries must be confirmed (no pending/withdrawn)
    const { data: entries } = await supabase
      .from('rodeo_entries')
      .select('id, status, internal_vote_passed')
      .eq('rodeo_id', rodeo_id)

    if (!entries || entries.length < 2) {
      return { data: null, error: new RodeoError('At least two confirmed entries are required', 'NOT_ENOUGH_ENTRIES') }
    }

    const unconfirmed = entries.filter((e) => e.status !== 'confirmed')
    if (unconfirmed.length > 0) {
      return { data: null, error: new RodeoError('All entries must be confirmed before opening', 'ENTRIES_NOT_CONFIRMED') }
    }

    const unlocked = entries.filter((e) => !e.internal_vote_passed)
    if (unlocked.length > 0) {
      return { data: null, error: new RodeoError('All entries must have passed their internal vote', 'VOTES_NOT_PASSED') }
    }

    // Transition to voting
    const { error: updateErr } = await supabase
      .from('rodeos')
      .update({ status: 'voting', start_date: new Date().toISOString() })
      .eq('id', rodeo_id)

    if (updateErr) {
      return { data: null, error: new RodeoError('Failed to open rodeo', 'UPDATE_FAILED', 500) }
    }

    // Create a placeholder result row (vote tallies auto-update via trigger)
    await supabase.from('rodeo_results').insert({ rodeo_id })

    return { data: { success: true }, error: null }
  },

  // ────────────────────────────────────────────────────────────
  // castVote — A user votes on a song in a rodeo
  // Spec: Step 7 — subscription required; circle member vs public
  // Rule: one vote per user per song per rodeo
  // ────────────────────────────────────────────────────────────
  async castVote(input: CastVoteInput): Promise<ServiceResult<{ vote_id: string }>> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: new RodeoError('Unauthorized', 'UNAUTHORIZED', 401) }

    // Fetch rodeo — must be in voting status
    const { data: rodeo } = await supabase
      .from('rodeos')
      .select('id, status')
      .eq('id', input.rodeo_id)
      .single()

    if (!rodeo) {
      return { data: null, error: new RodeoError('Rodeo not found', 'NOT_FOUND', 404) }
    }

    if (rodeo.status !== 'voting') {
      return { data: null, error: new RodeoError('Voting is not open for this rodeo', 'NOT_VOTING') }
    }

    // Subscription check — free tier cannot vote (per spec: "subscription required")
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return { data: null, error: new RodeoError('Profile not found', 'PROFILE_NOT_FOUND', 404) }
    }

    if (profile.subscription_tier === 'free') {
      return { data: null, error: new RodeoError('A paid subscription is required to vote in rodeos', 'SUBSCRIPTION_REQUIRED', 403) }
    }

    // Determine voter type: check if user is a member of any circle in this rodeo
    const { data: rodeoCircles } = await supabase
      .from('rodeo_entries')
      .select('circle_id')
      .eq('rodeo_id', input.rodeo_id)
      .not('circle_id', 'is', null)

    const circleIds = (rodeoCircles ?? []).map((e) => e.circle_id).filter(Boolean) as string[]

    let voterType: VoterType = 'general_public'
    let weight = 1.0

    if (circleIds.length > 0) {
      const { data: membership } = await supabase
        .from('circle_members')
        .select('circle_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .in('circle_id', circleIds)
        .limit(1)
        .maybeSingle()

      if (membership) {
        voterType = 'circle_member'
        weight = 2.0   // circle members carry more weight (spec: "higher weight")
      }
    }

    // Insert the vote (unique constraint on rodeo_id, voter_id, song_id handles dupes)
    const { data: vote, error: voteErr } = await supabase
      .from('rodeo_votes')
      .upsert(
        {
          rodeo_id: input.rodeo_id,
          voter_id: user.id,
          song_id: input.song_id,
          target_entry_id: input.target_entry_id,
          voter_type: voterType,
          weight,
        },
        { onConflict: 'rodeo_id,voter_id,song_id' }
      )
      .select('id')
      .single()

    if (voteErr || !vote) {
      return { data: null, error: new RodeoError(voteErr?.message ?? 'Failed to cast vote', 'VOTE_FAILED', 500) }
    }

    return { data: { vote_id: vote.id }, error: null }
  },

  // ────────────────────────────────────────────────────────────
  // closeRodeo — End voting, compute results, distribute credits
  // Spec: Steps 8-9 — scorecard, credit flow, archive
  // Rule: platform fee deducted before distribution
  // Rule: rodeo history is permanent
  // ────────────────────────────────────────────────────────────
  async closeRodeo(rodeo_id: string): Promise<ServiceResult<{ result_id: string }>> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: new RodeoError('Unauthorized', 'UNAUTHORIZED', 401) }

    // Fetch rodeo
    const { data: rodeo } = await supabase
      .from('rodeos')
      .select('id, status, created_by')
      .eq('id', rodeo_id)
      .single()

    if (!rodeo) {
      return { data: null, error: new RodeoError('Rodeo not found', 'NOT_FOUND', 404) }
    }

    if (rodeo.status !== 'voting') {
      return { data: null, error: new RodeoError(`Cannot close a rodeo with status "${rodeo.status}"`, 'INVALID_STATUS') }
    }

    if (rodeo.created_by !== user.id) {
      return { data: null, error: new RodeoError('Only the rodeo creator can close it', 'NOT_AUTHORIZED', 403) }
    }

    // ── Compute per-song scores ──

    const { data: entries } = await supabase
      .from('rodeo_entries')
      .select('id, circle_id, artist_id')
      .eq('rodeo_id', rodeo_id)
      .eq('status', 'confirmed')

    if (!entries || entries.length === 0) {
      return { data: null, error: new RodeoError('No confirmed entries', 'NO_ENTRIES') }
    }

    // Get all votes for this rodeo
    const { data: votes } = await supabase
      .from('rodeo_votes')
      .select('song_id, target_entry_id, voter_type, weight')
      .eq('rodeo_id', rodeo_id)

    // Tally scores per entry
    const entryScores = new Map<string, number>()
    const songScores = new Map<string, {
      entry_id: string
      total_votes: number
      weighted_score: number
      circle_member_votes: number
      general_public_votes: number
    }>()

    for (const vote of (votes ?? [])) {
      // Per-song stats
      const key = vote.song_id
      const existing = songScores.get(key) ?? {
        entry_id: vote.target_entry_id,
        total_votes: 0,
        weighted_score: 0,
        circle_member_votes: 0,
        general_public_votes: 0,
      }
      existing.total_votes++
      existing.weighted_score += vote.weight
      if (vote.voter_type === 'circle_member') existing.circle_member_votes++
      else existing.general_public_votes++
      songScores.set(key, existing)

      // Per-entry total
      const entryTotal = entryScores.get(vote.target_entry_id) ?? 0
      entryScores.set(vote.target_entry_id, entryTotal + vote.weight)
    }

    // Determine the winner (highest weighted score)
    let winnerId: string | null = null
    let highScore = -1
    Array.from(entryScores.entries()).forEach(([entryId, score]) => {
      if (score > highScore) {
        highScore = score
        winnerId = entryId
      }
    })

    const winnerEntry = entries.find((e) => e.id === winnerId)

    // Upsert the result row (trigger may have already created it in openRodeo)
    const { data: result, error: resultErr } = await supabase
      .from('rodeo_results')
      .upsert(
        {
          rodeo_id,
          winner_circle_id: winnerEntry?.circle_id ?? null,
          winner_artist_id: winnerEntry?.artist_id ?? null,
          circle_member_votes: (votes ?? []).filter((v) => v.voter_type === 'circle_member').length,
          general_public_votes: (votes ?? []).filter((v) => v.voter_type === 'general_public').length,
          archived_to_circle_history: true,
          finalized_at: new Date().toISOString(),
        },
        { onConflict: 'rodeo_id' }
      )
      .select('id')
      .single()

    if (resultErr || !result) {
      return { data: null, error: new RodeoError('Failed to finalize result', 'RESULT_FAILED', 500) }
    }

    // Insert per-song results
    const songResultRows = Array.from(songScores.entries()).map(([song_id, s]) => ({
      result_id: result.id,
      song_id,
      entry_id: s.entry_id,
      total_votes: s.total_votes,
      weighted_score: s.weighted_score,
      circle_member_votes: s.circle_member_votes,
      general_public_votes: s.general_public_votes,
    }))

    if (songResultRows.length > 0) {
      await supabase.from('rodeo_song_results').insert(songResultRows)
    }

    // ── Credit distribution ──

    const { data: pool } = await supabase
      .from('credit_pools')
      .select('id, total, platform_fee_pct')
      .eq('rodeo_id', rodeo_id)
      .single()

    if (pool && pool.total > 0) {
      const platformAmount = (pool.total * pool.platform_fee_pct) / 100
      const distributable = pool.total - platformAmount

      // Fetch distribution rules
      const { data: rules } = await supabase
        .from('distribution_rules')
        .select('recipient, percentage')
        .eq('credit_pool_id', pool.id)

      const distributions: Array<{
        result_id: string
        recipient_type: string
        amount: number
        recipient_user_id: string | null
      }> = []

      // Platform fee
      distributions.push({
        result_id: result.id,
        recipient_type: 'platform',
        amount: platformAmount,
        recipient_user_id: null,
      })

      // Per-rule distributions
      for (const rule of (rules ?? [])) {
        const amount = (distributable * rule.percentage) / 100
        if (amount > 0) {
          distributions.push({
            result_id: result.id,
            recipient_type: rule.recipient,
            amount,
            recipient_user_id: null,   // resolved to actual users in a future settlement step
          })
        }
      }

      if (distributions.length > 0) {
        await supabase.from('rodeo_credit_distributions').insert(distributions)
      }
    }

    // Transition rodeo to closed
    const { error: closeErr } = await supabase
      .from('rodeos')
      .update({
        status: 'closed' as RodeoStatus,
        end_date: new Date().toISOString(),
      })
      .eq('id', rodeo_id)

    if (closeErr) {
      return { data: null, error: new RodeoError('Failed to close rodeo', 'CLOSE_FAILED', 500) }
    }

    return { data: { result_id: result.id }, error: null }
  },

  // ────────────────────────────────────────────────────────────
  // archiveRodeo — Permanently archive a closed rodeo
  // Spec: Step 9 — "Rodeo history is permanent"
  // ────────────────────────────────────────────────────────────
  async archiveRodeo(rodeo_id: string): Promise<ServiceResult<{ success: true }>> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: new RodeoError('Unauthorized', 'UNAUTHORIZED', 401) }

    const { data: rodeo } = await supabase
      .from('rodeos')
      .select('id, status, created_by')
      .eq('id', rodeo_id)
      .single()

    if (!rodeo) {
      return { data: null, error: new RodeoError('Rodeo not found', 'NOT_FOUND', 404) }
    }

    if (rodeo.status !== 'closed') {
      return { data: null, error: new RodeoError('Only closed rodeos can be archived', 'INVALID_STATUS') }
    }

    const { error } = await supabase
      .from('rodeos')
      .update({ status: 'archived', archived_at: new Date().toISOString() })
      .eq('id', rodeo_id)

    if (error) {
      return { data: null, error: new RodeoError('Failed to archive rodeo', 'ARCHIVE_FAILED', 500) }
    }

    return { data: { success: true }, error: null }
  },

  // ────────────────────────────────────────────────────────────
  // getRodeo — Fetch a single rodeo with all related data
  // ────────────────────────────────────────────────────────────
  async getRodeo(rodeo_id: string) {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('rodeos')
      .select(`
        *,
        credit_pools(*, distribution_rules(*)),
        rodeo_entries(
          *,
          circles(id, name, member_count),
          profiles!rodeo_entries_artist_id_fkey(id, display_name, avatar_url),
          rodeo_entry_songs(*, circle_songs(id, title, artist, avg_rating, rating_count))
        ),
        rodeo_results(
          *,
          rodeo_song_results(*),
          rodeo_credit_distributions(*)
        )
      `)
      .eq('id', rodeo_id)
      .single()

    return { data, error }
  },

  // ────────────────────────────────────────────────────────────
  // listRodeos — Feed of rodeos with optional filters
  // ────────────────────────────────────────────────────────────
  async listRodeos(filters?: { status?: RodeoStatus; type?: RodeoType; limit?: number }) {
    const supabase = createClient()

    let query = supabase
      .from('rodeos')
      .select(`
        id, type, status, title, description, start_date, end_date, created_at,
        credit_pools(total),
        rodeo_entries(
          id, status,
          circles(id, name),
          profiles!rodeo_entries_artist_id_fkey(id, display_name)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(filters?.limit ?? 20)

    if (filters?.status) query = query.eq('status', filters.status)
    if (filters?.type) query = query.eq('type', filters.type)

    return await query
  },
}
