import { createClient } from '@/lib/supabase/server'
import { ActivityFeedService } from './activity-feed-service'

// Nomination slots per subscription tier per period
export const NOMINATION_SLOTS: Record<
  string,
  { young_buck: number; rising_star: number }
> = {
  free:     { young_buck: 1, rising_star: 2 },
  fan:      { young_buck: 2, rising_star: 4 },
  superfan: { young_buck: 5, rising_star: 10 },
  artist:   { young_buck: 7, rising_star: 15 },
  producer: { young_buck: 7, rising_star: 15 },
}

export interface NominationBudget {
  id: string
  user_id: string
  circle_id: string
  period_start: string
  period_end: string
  young_buck_slots: number
  rising_star_slots: number
  young_buck_used: number
  rising_star_used: number
}

export interface Nomination {
  id: string
  circle_id: string
  nominated_by: string
  artist_name: string
  tier_target: 'young_buck' | 'core'
  circle_artist_id: string | null
  status: 'pending_vote' | 'passed' | 'board_review' | 'approved' | 'declined' | 'held'
  message: string | null
  budget_id: string | null
  votes_for: number
  votes_against: number
  vote_threshold: number
  inducted_at: string | null
  created_at: string
  updated_at: string
}

function currentPeriod(): { start: Date; end: Date } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  return { start, end }
}

export const NominationService = {
  // ── BUDGET ────────────────────────────────────────────────────

  async getOrCreateBudget(
    user_id: string,
    circle_id: string
  ): Promise<NominationBudget | null> {
    const supabase = await createClient()
    const { start, end } = currentPeriod()

    // Try to fetch existing
    const { data: existing } = await supabase
      .from('nomination_budgets')
      .select('*')
      .eq('user_id', user_id)
      .eq('circle_id', circle_id)
      .eq('period_start', start.toISOString())
      .maybeSingle()

    if (existing) return existing as NominationBudget

    // Get user subscription tier
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user_id)
      .single()

    const tier = (profile?.subscription_tier ?? 'free') as string
    const slots = NOMINATION_SLOTS[tier] ?? NOMINATION_SLOTS['free']

    const { data: created, error } = await supabase
      .from('nomination_budgets')
      .insert({
        user_id,
        circle_id,
        period_start: start.toISOString(),
        period_end: end.toISOString(),
        young_buck_slots: slots.young_buck,
        rising_star_slots: slots.rising_star,
        young_buck_used: 0,
        rising_star_used: 0,
      })
      .select()
      .single()

    if (error) {
      console.error('[NominationService.getOrCreateBudget]', error.message)
      return null
    }
    return created as NominationBudget
  },

  async getBudget(user_id: string, circle_id: string): Promise<NominationBudget | null> {
    return this.getOrCreateBudget(user_id, circle_id)
  },

  // ── SUBMIT NOMINATION ─────────────────────────────────────────

  async submitNomination(params: {
    user_id: string
    circle_id: string
    artist_name: string
    tier_target: 'young_buck' | 'core'
    circle_artist_id?: string
    message?: string
  }): Promise<{ nomination: Nomination | null; error: string | null }> {
    const supabase = await createClient()

    // Verify user is a circle member
    const { data: membership } = await supabase
      .from('circle_members')
      .select('id')
      .eq('circle_id', params.circle_id)
      .eq('user_id', params.user_id)
      .maybeSingle()

    if (!membership) {
      return { nomination: null, error: 'Not a circle member' }
    }

    // Check and consume budget slot
    const budget = await this.getOrCreateBudget(params.user_id, params.circle_id)
    if (!budget) return { nomination: null, error: 'Could not load budget' }

    const slotKey =
      params.tier_target === 'young_buck' ? 'young_buck' : 'rising_star'

    const used = slotKey === 'young_buck' ? budget.young_buck_used : budget.rising_star_used
    const total = slotKey === 'young_buck' ? budget.young_buck_slots : budget.rising_star_slots

    if (used >= total) {
      return {
        nomination: null,
        error: `No ${slotKey.replace('_', ' ')} nomination slots remaining this period`,
      }
    }

    // Consume slot
    const updateKey =
      slotKey === 'young_buck' ? 'young_buck_used' : 'rising_star_used'
    const { error: budgetError } = await supabase
      .from('nomination_budgets')
      .update({ [updateKey]: used + 1 })
      .eq('id', budget.id)

    if (budgetError) return { nomination: null, error: budgetError.message }

    // Create nomination
    const { data: nomination, error: nomError } = await supabase
      .from('nominations')
      .insert({
        circle_id: params.circle_id,
        nominated_by: params.user_id,
        artist_name: params.artist_name,
        tier_target: params.tier_target,
        circle_artist_id: params.circle_artist_id ?? null,
        message: params.message ?? null,
        budget_id: budget.id,
        status: 'pending_vote',
      })
      .select()
      .single()

    if (nomError) return { nomination: null, error: nomError.message }

    // Log to feed
    await ActivityFeedService.log({
      circle_id: params.circle_id,
      event_type: 'nomination_passed',
      nomination_id: nomination.id,
      actor_id: params.user_id,
      payload: {
        artist_name: params.artist_name,
        tier_target: params.tier_target,
        action: 'submitted',
      },
    })

    return { nomination: nomination as Nomination, error: null }
  },

  // ── CAST VOTE ─────────────────────────────────────────────────

  async castNominationVote(params: {
    nomination_id: string
    voter_id: string
    vote: 'for' | 'against'
  }): Promise<{ resolved: boolean; status: string; error: string | null }> {
    const supabase = await createClient()

    // Fetch nomination
    const { data: nom } = await supabase
      .from('nominations')
      .select('*')
      .eq('id', params.nomination_id)
      .single()

    if (!nom) return { resolved: false, status: '', error: 'Nomination not found' }
    if (nom.status !== 'pending_vote') {
      return { resolved: false, status: nom.status, error: 'Voting is closed' }
    }

    // Verify voter is circle member
    const { data: membership } = await supabase
      .from('circle_members')
      .select('id')
      .eq('circle_id', nom.circle_id)
      .eq('user_id', params.voter_id)
      .maybeSingle()

    if (!membership) return { resolved: false, status: '', error: 'Not a circle member' }

    // Insert vote (unique constraint handles duplicate votes)
    const { error: voteError } = await supabase.from('nomination_votes').insert({
      nomination_id: params.nomination_id,
      voter_id: params.voter_id,
      vote: params.vote,
    })

    if (voteError) {
      if (voteError.code === '23505') {
        return { resolved: false, status: nom.status, error: 'Already voted' }
      }
      return { resolved: false, status: '', error: voteError.message }
    }

    // Recompute vote tally
    const { count: forCount } = await supabase
      .from('nomination_votes')
      .select('*', { count: 'exact', head: true })
      .eq('nomination_id', params.nomination_id)
      .eq('vote', 'for')

    const { count: againstCount } = await supabase
      .from('nomination_votes')
      .select('*', { count: 'exact', head: true })
      .eq('nomination_id', params.nomination_id)
      .eq('vote', 'against')

    const votes_for = forCount ?? 0
    const votes_against = againstCount ?? 0
    const total = votes_for + votes_against

    await supabase
      .from('nominations')
      .update({ votes_for, votes_against })
      .eq('id', params.nomination_id)

    // Get total circle member count to check threshold
    const { count: memberCount } = await supabase
      .from('circle_members')
      .select('*', { count: 'exact', head: true })
      .eq('circle_id', nom.circle_id)

    const totalMembers = memberCount ?? 1
    const participation = (total / totalMembers) * 100
    const forPct = total > 0 ? (votes_for / total) * 100 : 0

    // Threshold: >50% of members voted AND >50% of votes are 'for'
    if (participation >= 50 && forPct > nom.vote_threshold) {
      await supabase
        .from('nominations')
        .update({ status: 'passed' })
        .eq('id', params.nomination_id)

      // Notify board
      await ActivityFeedService.log({
        circle_id: nom.circle_id,
        event_type: 'nomination_passed',
        nomination_id: nom.id,
        payload: { artist_name: nom.artist_name, votes_for, votes_against },
        board_only: true,
      })

      return { resolved: true, status: 'passed', error: null }
    }

    return { resolved: false, status: 'pending_vote', error: null }
  },

  // ── ADVANCE TO BOARD / INDUCT ─────────────────────────────────

  async advanceToBoard(nomination_id: string, board_user_id: string): Promise<boolean> {
    const supabase = await createClient()
    const { error } = await supabase
      .from('nominations')
      .update({ status: 'board_review' })
      .eq('id', nomination_id)
      .eq('status', 'passed')
    return !error
  },

  async induct(params: {
    nomination_id: string
    board_user_id: string
  }): Promise<{ error: string | null }> {
    const supabase = await createClient()

    const { data: nom } = await supabase
      .from('nominations')
      .select('*')
      .eq('id', params.nomination_id)
      .single()

    if (!nom) return { error: 'Nomination not found' }

    const now = new Date().toISOString()

    // Update nomination status
    await supabase
      .from('nominations')
      .update({
        status: 'approved',
        board_decided_by: params.board_user_id,
        board_decided_at: now,
        inducted_at: now,
      })
      .eq('id', params.nomination_id)

    if (nom.tier_target === 'young_buck') {
      // Create new circle_artist with young_buck tier
      const { data: existing } = await supabase
        .from('circle_artists')
        .select('id')
        .eq('circle_id', nom.circle_id)
        .eq('artist_name', nom.artist_name)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('circle_artists')
          .update({ tier: 'young_buck', inducted_at: now })
          .eq('id', existing.id)
      } else {
        await supabase.from('circle_artists').insert({
          circle_id: nom.circle_id,
          artist_name: nom.artist_name,
          tier: 'young_buck',
          inducted_at: now,
        })
      }
    } else if (nom.tier_target === 'core' && nom.circle_artist_id) {
      await supabase
        .from('circle_artists')
        .update({ tier: 'core', inducted_at: now, promotion_eligible: false })
        .eq('id', nom.circle_artist_id)
    }

    await ActivityFeedService.log({
      circle_id: nom.circle_id,
      event_type: 'nomination_inducted',
      nomination_id: nom.id,
      actor_id: params.board_user_id,
      payload: {
        artist_name: nom.artist_name,
        tier: nom.tier_target,
      },
    })

    return { error: null }
  },

  // ── LIST NOMINATIONS ──────────────────────────────────────────

  async listNominations(circle_id: string): Promise<Nomination[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('nominations')
      .select('*')
      .eq('circle_id', circle_id)
      .order('created_at', { ascending: false })

    if (error) return []
    return (data ?? []) as Nomination[]
  },
}
