// ============================================================
// Stampede — Rodeo Type Definitions
// Mirrors the database schema from migration 004_rodeos.sql
// ============================================================

// ── Enums ─────────────────────────────────────────────────────

export type RodeoType = 'showdown' | 'whale' | 'grassroots' | 'artist_vs_artist'

export type RodeoStatus = 'pending' | 'open' | 'voting' | 'closed' | 'archived'

export type RodeoEntryStatus = 'pending' | 'confirmed' | 'withdrawn'

export type VoterType = 'circle_member' | 'general_public'

export type SongLabel = 'studio' | 'live'

export type DistributionRecipient =
  | 'winning_artist'
  | 'songwriter'
  | 'band'
  | 'young_bucks'
  | 'core_artists'
  | 'users'

export type CreditDistributionRecipient = DistributionRecipient | 'platform'

// ── Core Models ───────────────────────────────────────────────

export interface Rodeo {
  id: string
  type: RodeoType
  status: RodeoStatus
  title: string
  description: string | null
  start_date: string | null   // ISO 8601 timestamptz
  end_date: string | null
  league_id: string | null
  created_by: string | null   // profiles.id
  created_by_circle: string | null // circles.id
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface CreditPool {
  id: string
  rodeo_id: string
  sponsor_credits: number
  circle_credits: number
  artist_credits: number
  user_backed_credits: number
  total: number               // computed column
  platform_fee_pct: number
  created_at: string
}

export interface DistributionRule {
  id: string
  credit_pool_id: string
  recipient: DistributionRecipient
  percentage: number
  created_at: string
}

export interface RodeoEntry {
  id: string
  rodeo_id: string
  circle_id: string | null    // null for artist_vs_artist
  artist_id: string | null    // null for circle-based types
  internal_vote_passed: boolean
  credits_contributed: number
  status: RodeoEntryStatus
  created_at: string
  updated_at: string
}

export interface RodeoEntrySong {
  id: string
  entry_id: string
  song_id: string             // references circle_songs.id
  label: SongLabel | null
  locked: boolean
  created_at: string
}

export interface RodeoVote {
  id: string
  rodeo_id: string
  voter_id: string            // profiles.id
  song_id: string             // circle_songs.id
  target_entry_id: string     // rodeo_entries.id
  voter_type: VoterType
  weight: number
  created_at: string
}

export interface RodeoResult {
  id: string
  rodeo_id: string
  winner_circle_id: string | null
  winner_artist_id: string | null
  circle_member_votes: number
  general_public_votes: number
  archived_to_circle_history: boolean
  finalized_at: string | null
  created_at: string
}

export interface RodeoSongResult {
  id: string
  result_id: string
  song_id: string
  entry_id: string
  total_votes: number
  weighted_score: number
  circle_member_votes: number
  general_public_votes: number
  created_at: string
}

export interface RodeoCreditDistribution {
  id: string
  result_id: string
  recipient_user_id: string | null
  recipient_type: CreditDistributionRecipient
  amount: number
  created_at: string
}

// ── Joined / Expanded Types ───────────────────────────────────
// Used when fetching rodeos with related data

export interface RodeoWithPool extends Rodeo {
  credit_pools: CreditPool | null
}

export interface RodeoEntryWithSongs extends RodeoEntry {
  rodeo_entry_songs: (RodeoEntrySong & {
    circle_songs: { id: string; title: string; artist: string } | null
  })[]
  circles: { id: string; name: string; member_count: number } | null
  profiles: { id: string; display_name: string; avatar_url: string | null } | null
}

export interface RodeoDetail extends Rodeo {
  credit_pools: CreditPool & {
    distribution_rules: DistributionRule[]
  }
  rodeo_entries: RodeoEntryWithSongs[]
  rodeo_results: (RodeoResult & {
    rodeo_song_results: RodeoSongResult[]
    rodeo_credit_distributions: RodeoCreditDistribution[]
  }) | null
}

export interface RodeoFeedItem {
  id: string
  type: RodeoType
  status: RodeoStatus
  title: string
  description: string | null
  start_date: string | null
  end_date: string | null
  created_at: string
  credit_pools: { total: number } | null
  rodeo_entries: Array<{
    id: string
    status: RodeoEntryStatus
    circles: { id: string; name: string } | null
    profiles: { id: string; display_name: string } | null
  }>
}

// ── Vote Breakdown ────────────────────────────────────────────

export interface VoteBreakdown {
  circle_member_votes: number
  general_public_votes: number
}

export interface SongScorecard {
  song_id: string
  title: string
  artist: string
  entry_id: string
  entry_name: string          // circle name or artist name
  total_votes: number
  weighted_score: number
  circle_member_votes: number
  general_public_votes: number
}
