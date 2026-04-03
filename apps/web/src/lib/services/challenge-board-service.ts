// ============================================================
// Stampede — ChallengeBoardService
// Superfan board approval layer for Circle-vs-Circle challenges.
//
// Flow:
//   1. submitProposal()   — board/founder submits a challenge proposal
//   2. castBoardVote()    — board members vote: approve | hold | decline
//   3. Auto-resolve       — majority triggers outcome:
//        approve → challengeCircle() fires, status becomes 'sent'
//        hold    → queued for next board session
//        decline → initiator notified via board_comment
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { RodeoService } from './rodeo-service'

// ── Error ─────────────────────────────────────────────────────

class BoardError extends Error {
  constructor(message: string, public code: string, public status: number = 400) {
    super(message)
    this.name = 'BoardError'
  }
}

type Result<T> = { data: T; error: null } | { data: null; error: BoardError }

// ── Input types ───────────────────────────────────────────────

export interface SubmitProposalInput {
  circle_id: string
  target_circle_id: string
  title: string
  description?: string
  credit_buy_in: number
  song_ids: string[]
  song_labels?: Record<string, 'studio' | 'live'>
  end_date?: string
}

export interface CastVoteInput {
  proposal_id: string
  vote: 'approve' | 'hold' | 'decline'
  comment?: string
}

// ── Service ───────────────────────────────────────────────────

export const ChallengeBoardService = {

  // ────────────────────────────────────────────────────────────
  // submitProposal — board/founder creates a challenge proposal
  // that requires majority board approval before sending.
  // ────────────────────────────────────────────────────────────
  async submitProposal(input: SubmitProposalInput): Promise<Result<{ proposal_id: string }>> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: new BoardError('Unauthorized', 'UNAUTHORIZED', 401) }

    // Confirm user is board/founder of the challenging circle
    const { data: membership } = await supabase
      .from('circle_members')
      .select('role')
      .eq('circle_id', input.circle_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!membership || !['board', 'founder'].includes(membership.role)) {
      return { data: null, error: new BoardError('Only board members or founders can submit challenge proposals', 'NOT_AUTHORIZED', 403) }
    }

    if (input.circle_id === input.target_circle_id) {
      return { data: null, error: new BoardError('A circle cannot challenge itself', 'SELF_CHALLENGE') }
    }

    if (!input.song_ids.length) {
      return { data: null, error: new BoardError('At least one song is required', 'NO_SONGS') }
    }

    // Validate songs belong to this circle
    const { data: validSongs } = await supabase
      .from('circle_songs')
      .select('id')
      .eq('circle_id', input.circle_id)
      .in('id', input.song_ids)

    if (!validSongs || validSongs.length !== input.song_ids.length) {
      return { data: null, error: new BoardError('All songs must belong to the challenging circle', 'INVALID_SONGS') }
    }

    // Create the proposal
    const { data: proposal, error: propErr } = await supabase
      .from('challenge_proposals')
      .insert({
        circle_id: input.circle_id,
        target_circle_id: input.target_circle_id,
        initiated_by: user.id,
        title: input.title,
        description: input.description ?? null,
        credit_buy_in: input.credit_buy_in,
        end_date: input.end_date ?? null,
        status: 'pending',
      })
      .select('id')
      .single()

    if (propErr || !proposal) {
      return { data: null, error: new BoardError('Failed to create proposal', 'CREATE_FAILED', 500) }
    }

    // Attach songs
    const songRows = input.song_ids.map((song_id) => ({
      proposal_id: proposal.id,
      song_id,
      label: input.song_labels?.[song_id] ?? null,
    }))

    const { error: songsErr } = await supabase
      .from('challenge_proposal_songs')
      .insert(songRows)

    if (songsErr) {
      return { data: null, error: new BoardError('Failed to attach songs', 'SONGS_FAILED', 500) }
    }

    return { data: { proposal_id: proposal.id }, error: null }
  },

  // ────────────────────────────────────────────────────────────
  // castBoardVote — a board/founder member votes on a proposal.
  // After each vote, checks if majority is reached and auto-resolves.
  //
  // Majority rule:
  //   - Any option with > 50% of total board seats → wins
  //   - If all board members voted and no majority → default to 'held'
  // ────────────────────────────────────────────────────────────
  async castBoardVote(input: CastVoteInput): Promise<Result<{ resolved: boolean; outcome: string | null }>> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: new BoardError('Unauthorized', 'UNAUTHORIZED', 401) }

    // Fetch the proposal
    const { data: proposal } = await supabase
      .from('challenge_proposals')
      .select('id, circle_id, target_circle_id, title, description, credit_buy_in, end_date, status, initiated_by')
      .eq('id', input.proposal_id)
      .single()

    if (!proposal) {
      return { data: null, error: new BoardError('Proposal not found', 'NOT_FOUND', 404) }
    }

    if (proposal.status !== 'pending') {
      return { data: null, error: new BoardError(`Proposal is already ${proposal.status}`, 'NOT_PENDING') }
    }

    // Confirm voter is board/founder of the challenging circle
    const { data: membership } = await supabase
      .from('circle_members')
      .select('role')
      .eq('circle_id', proposal.circle_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!membership || !['board', 'founder'].includes(membership.role)) {
      return { data: null, error: new BoardError('Only board members or founders can vote on proposals', 'NOT_AUTHORIZED', 403) }
    }

    // Upsert vote (board member can change their vote while still pending)
    const { error: voteErr } = await supabase
      .from('challenge_proposal_votes')
      .upsert(
        {
          proposal_id: input.proposal_id,
          voter_id: user.id,
          vote: input.vote,
          comment: input.comment ?? null,
        },
        { onConflict: 'proposal_id,voter_id' }
      )

    if (voteErr) {
      return { data: null, error: new BoardError('Failed to record vote', 'VOTE_FAILED', 500) }
    }

    // ── Check majority ──────────────────────────────────────

    // Total board seats in this circle
    const { data: boardMembers } = await supabase
      .from('circle_members')
      .select('user_id')
      .eq('circle_id', proposal.circle_id)
      .eq('status', 'active')
      .in('role', ['board', 'founder'])

    const totalSeats = boardMembers?.length ?? 1

    // Current vote tally
    const { data: allVotes } = await supabase
      .from('challenge_proposal_votes')
      .select('vote, comment')
      .eq('proposal_id', input.proposal_id)

    const tally = { approve: 0, hold: 0, decline: 0 }
    let declineComment: string | null = null

    for (const v of (allVotes ?? [])) {
      tally[v.vote as keyof typeof tally]++
      if (v.vote === 'decline' && v.comment) declineComment = v.comment
    }

    const totalVotesCast = tally.approve + tally.hold + tally.decline
    const majority = Math.floor(totalSeats / 2) + 1 // strict majority

    let outcome: 'approved' | 'held' | 'declined' | null = null

    if (tally.approve >= majority) {
      outcome = 'approved'
    } else if (tally.decline >= majority) {
      outcome = 'declined'
    } else if (tally.hold >= majority) {
      outcome = 'held'
    } else if (totalVotesCast >= totalSeats) {
      // All board members voted, no majority → default to held
      outcome = 'held'
    }

    if (!outcome) {
      // No majority yet — just record the vote
      return { data: { resolved: false, outcome: null }, error: null }
    }

    // ── Resolve ─────────────────────────────────────────────

    if (outcome === 'approved') {
      // Fetch songs for this proposal
      const { data: proposalSongs } = await supabase
        .from('challenge_proposal_songs')
        .select('song_id, label')
        .eq('proposal_id', input.proposal_id)

      const songIds = (proposalSongs ?? []).map((s) => s.song_id)
      const songLabels = Object.fromEntries(
        (proposalSongs ?? [])
          .filter((s) => s.label)
          .map((s) => [s.song_id, s.label as 'studio' | 'live'])
      )

      // Fire the actual challenge
      const { data: challengeData, error: challengeErr } = await RodeoService.challengeCircle({
        challenger_circle_id: proposal.circle_id,
        target_circle_id: proposal.target_circle_id,
        title: proposal.title,
        description: proposal.description ?? undefined,
        credit_buy_in: proposal.credit_buy_in,
        song_ids: songIds,
        song_labels: songLabels,
        end_date: proposal.end_date ?? undefined,
      })

      if (challengeErr) {
        // Challenge failed — revert to pending so board can re-vote
        console.error('challengeCircle failed after approval:', challengeErr.message)
        return { data: null, error: new BoardError(`Challenge failed: ${challengeErr.message}`, 'CHALLENGE_FAILED', 500) }
      }

      // Mark proposal as sent, link rodeo_id
      await supabase
        .from('challenge_proposals')
        .update({ status: 'sent', rodeo_id: challengeData.rodeo_id })
        .eq('id', input.proposal_id)

      return { data: { resolved: true, outcome: 'sent' }, error: null }
    }

    // held or declined
    await supabase
      .from('challenge_proposals')
      .update({
        status: outcome === 'declined' ? 'declined' : 'held',
        board_comment: outcome === 'declined'
          ? (declineComment ?? input.comment ?? null)
          : (input.comment ?? null),
      })
      .eq('id', input.proposal_id)

    return { data: { resolved: true, outcome }, error: null }
  },

  // ────────────────────────────────────────────────────────────
  // listProposals — proposals for a circle, newest first
  // ────────────────────────────────────────────────────────────
  async listProposals(circle_id: string, status?: string) {
    const supabase = createClient()

    let query = supabase
      .from('challenge_proposals')
      .select(`
        id, title, description, status, credit_buy_in, end_date, board_comment, rodeo_id, created_at,
        initiated_by,
        profiles!challenge_proposals_initiated_by_fkey(display_name, avatar_url),
        circles!challenge_proposals_circle_id_fkey(id, name),
        target:circles!challenge_proposals_target_circle_id_fkey(id, name),
        challenge_proposal_songs(song_id, label, circle_songs(id, title, artist)),
        challenge_proposal_votes(vote, voter_id,
          profiles!challenge_proposal_votes_voter_id_fkey(display_name, avatar_url)
        )
      `)
      .eq('circle_id', circle_id)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    return supabase.from('challenge_proposals').select(`
      id, title, description, status, credit_buy_in, end_date, board_comment, rodeo_id, created_at,
      initiated_by,
      profiles!challenge_proposals_initiated_by_fkey(display_name, avatar_url),
      circles!challenge_proposals_circle_id_fkey(id, name),
      target:circles!challenge_proposals_target_circle_id_fkey(id, name),
      challenge_proposal_songs(song_id, label, circle_songs(id, title, artist)),
      challenge_proposal_votes(vote, voter_id,
        profiles!challenge_proposal_votes_voter_id_fkey(display_name, avatar_url)
      )
    `)
      .eq('circle_id', circle_id)
      .order('created_at', { ascending: false })
  },

  // ────────────────────────────────────────────────────────────
  // getBoardMembers — for tally context
  // ────────────────────────────────────────────────────────────
  async getBoardMembers(circle_id: string) {
    const supabase = createClient()
    return supabase
      .from('circle_members')
      .select('user_id, role, profiles(display_name, avatar_url)')
      .eq('circle_id', circle_id)
      .eq('status', 'active')
      .in('role', ['board', 'founder'])
  },
}
