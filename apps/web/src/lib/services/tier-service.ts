import { createClient } from '@/lib/supabase/server'
import { ActivityFeedService } from './activity-feed-service'

export type ArtistTier = 'rising_star' | 'young_buck' | 'core' | 'legacy'

export interface TierCheckResult {
  artist_id: string
  artist_name: string
  current_tier: ArtistTier
  promotion_eligible: boolean
  reason: string
}

// Win thresholds for promotion eligibility
const YOUNG_BUCK_WINS_REQUIRED = 2
const INACTIVE_PERIODS_THRESHOLD = 3

export const TierService = {
  // ── RODEO RESULT → TIER UPDATE ────────────────────────────────

  async updateTierFromRodeoResult(params: {
    circle_id: string
    rodeo_id: string
    winning_circle_id: string | null
    // artist names from the winning entry's songs
    winning_artist_names: string[]
  }): Promise<void> {
    const supabase = await createClient()

    for (const artistName of params.winning_artist_names) {
      const { data: ca } = await supabase
        .from('circle_artists')
        .select('*')
        .eq('circle_id', params.circle_id)
        .eq('artist_name', artistName)
        .maybeSingle()

      if (!ca) continue

      const newWins = (ca.rodeo_wins ?? 0) + 1
      const newApps = (ca.rodeo_appearances ?? 0) + 1

      let promotionEligible = ca.promotion_eligible ?? false

      // Young Buck with 2+ wins → eligible for Core promotion
      if (ca.tier === 'young_buck' && newWins >= YOUNG_BUCK_WINS_REQUIRED) {
        promotionEligible = true
      }

      await supabase
        .from('circle_artists')
        .update({
          rodeo_wins: newWins,
          rodeo_appearances: newApps,
          promotion_eligible: promotionEligible,
        })
        .eq('id', ca.id)

      if (promotionEligible && !ca.promotion_eligible) {
        await ActivityFeedService.log({
          circle_id: params.circle_id,
          event_type: 'artist_promoted',
          rodeo_id: params.rodeo_id,
          payload: {
            artist_name: artistName,
            current_tier: ca.tier,
            eligible_for: 'core',
            rodeo_wins: newWins,
            action: 'promotion_eligible',
          },
        })
      }
    }

    // Also bump appearances for all participating artists (win or loss)
  },

  async recordAppearance(params: {
    circle_id: string
    artist_names: string[]
  }): Promise<void> {
    const supabase = await createClient()

    for (const artistName of params.artist_names) {
      const { data: ca } = await supabase
        .from('circle_artists')
        .select('id, rodeo_appearances')
        .eq('circle_id', params.circle_id)
        .eq('artist_name', artistName)
        .maybeSingle()

      if (!ca) continue

      await supabase
        .from('circle_artists')
        .update({ rodeo_appearances: (ca.rodeo_appearances ?? 0) + 1 })
        .eq('id', ca.id)
    }
  },

  // ── INACTIVITY CHECK ──────────────────────────────────────────

  async flagInactiveArtists(circle_id: string): Promise<TierCheckResult[]> {
    const supabase = await createClient()

    const { data: artists } = await supabase
      .from('circle_artists')
      .select('*')
      .eq('circle_id', circle_id)
      .eq('tier', 'core')

    if (!artists) return []

    const flagged: TierCheckResult[] = []

    for (const ca of artists) {
      if ((ca.inactive_periods ?? 0) >= INACTIVE_PERIODS_THRESHOLD) {
        flagged.push({
          artist_id: ca.id,
          artist_name: ca.artist_name,
          current_tier: ca.tier as ArtistTier,
          promotion_eligible: false,
          reason: `Inactive for ${ca.inactive_periods} periods — eligible for Legacy Ring review`,
        })

        // Log board-only event
        await ActivityFeedService.log({
          circle_id,
          event_type: 'board_approval_pending',
          payload: {
            artist_name: ca.artist_name,
            action: 'inactivity_flag',
            inactive_periods: ca.inactive_periods,
          },
          board_only: true,
        })
      }
    }

    return flagged
  },

  // ── MOVE TO LEGACY RING ───────────────────────────────────────

  async moveToLegacy(params: {
    circle_artist_id: string
    board_user_id: string
    circle_id: string
    artist_name: string
  }): Promise<{ error: string | null }> {
    const supabase = await createClient()

    const { error } = await supabase
      .from('circle_artists')
      .update({ tier: 'legacy', promotion_eligible: false })
      .eq('id', params.circle_artist_id)

    if (error) return { error: error.message }

    await ActivityFeedService.log({
      circle_id: params.circle_id,
      event_type: 'artist_promoted',
      actor_id: params.board_user_id,
      payload: {
        artist_name: params.artist_name,
        action: 'moved_to_legacy',
        new_tier: 'legacy',
      },
    })

    return { error: null }
  },

  // ── CHECK PROMOTION ELIGIBILITY ───────────────────────────────

  async checkPromotionEligibility(circle_id: string): Promise<TierCheckResult[]> {
    const supabase = await createClient()

    const { data: artists } = await supabase
      .from('circle_artists')
      .select('*')
      .eq('circle_id', circle_id)
      .eq('promotion_eligible', true)
      .neq('tier', 'legacy')

    if (!artists) return []

    return artists.map((ca) => ({
      artist_id: ca.id,
      artist_name: ca.artist_name,
      current_tier: ca.tier as ArtistTier,
      promotion_eligible: true,
      reason:
        ca.tier === 'young_buck'
          ? `${ca.rodeo_wins} rodeo wins — eligible for Core promotion vote`
          : `Strong nomination ratings — eligible for Young Buck promotion vote`,
    }))
  },

  // ── INCREMENT INACTIVE PERIODS (call at period boundary) ──────

  async incrementInactivePeriods(circle_id: string): Promise<void> {
    const supabase = await createClient()

    // Get all core artists and check if they participated in last period's rodeos
    // For now, increment inactive_periods for all core artists with 0 appearances
    // In production, compare against rodeo_appearances delta per period
    const { data: artists } = await supabase
      .from('circle_artists')
      .select('id, inactive_periods, rodeo_appearances')
      .eq('circle_id', circle_id)
      .eq('tier', 'core')

    if (!artists) return

    for (const ca of artists) {
      if ((ca.rodeo_appearances ?? 0) === 0) {
        await supabase
          .from('circle_artists')
          .update({ inactive_periods: (ca.inactive_periods ?? 0) + 1 })
          .eq('id', ca.id)
      }
    }
  },
}
