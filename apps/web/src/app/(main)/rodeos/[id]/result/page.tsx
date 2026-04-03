'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Trophy,
  Coins,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ChevronRight,
  Music2,
  Users,
  Star,
  Archive,
  Swords,
  TrendingUp,
} from 'lucide-react'
import Button from '@/components/ui/Button'

// ── Types ─────────────────────────────────────────────────────

interface Circle {
  id: string
  name: string
  member_count: number
}

interface EntrySong {
  id: string
  song_id: string
  label: 'studio' | 'live' | null
  circle_songs: { id: string; title: string; artist: string } | null
}

interface Entry {
  id: string
  circle_id: string | null
  artist_id: string | null
  credits_contributed: number
  circles: Circle | null
  profiles: { id: string; display_name: string } | null
  rodeo_entry_songs: EntrySong[]
}

interface SongResult {
  id: string
  entry_id: string
  song_id: string
  circle_member_votes: number
  general_public_votes: number
  weighted_score: number
}

interface RodeoResult {
  id: string
  winner_circle_id: string | null
  winner_artist_id: string | null
  circle_member_votes: number
  general_public_votes: number
  finalized_at: string | null
  rodeo_song_results: SongResult[]
}

interface CreditPool {
  total: number
  platform_fee_pct: number
  distribution_rules: Array<{ recipient: string; percentage: number }>
}

interface Rodeo {
  id: string
  title: string
  type: string
  status: string
  start_date: string | null
  end_date: string | null
  created_by_circle: string | null
  rodeo_entries: Entry[]
  credit_pools: CreditPool | null
  rodeo_results: RodeoResult | null
  is_creator: boolean
  is_winning_circle_board: boolean
}

// ── Helpers ───────────────────────────────────────────────────

function formatCredits(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(0)
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

const TYPE_LABELS: Record<string, string> = {
  showdown: 'Showdown',
  whale: 'Whale',
  grassroots: 'Grassroots',
  artist_vs_artist: 'Artist vs Artist',
}

// ── Component ─────────────────────────────────────────────────

export default function RodeoResultPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [rodeo, setRodeo] = useState<Rodeo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [archived, setArchived] = useState(false)
  const [archiveError, setArchiveError] = useState<string | null>(null)

  const loadRodeo = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/rodeos/${id}`)
      if (!res.ok) throw new Error('Failed to load rodeo')
      const data: { rodeo: Rodeo } = await res.json()
      setRodeo(data.rodeo)
      setArchived(data.rodeo.status === 'archived')
    } catch {
      setError('Could not load rodeo result.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadRodeo() }, [loadRodeo])

  const handleArchive = async () => {
    setArchiving(true)
    setArchiveError(null)
    try {
      // Step 1: finalize result
      const finalRes = await fetch(`/api/rodeos/${id}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'finalize' }),
      })
      if (!finalRes.ok) {
        const d = await finalRes.json()
        throw new Error(d.error ?? 'Failed to finalize result')
      }
      // Step 2: write to circle history
      const archiveRes = await fetch(`/api/rodeos/${id}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive' }),
      })
      if (!archiveRes.ok) {
        const d = await archiveRes.json()
        throw new Error(d.error ?? 'Failed to archive')
      }
      setArchived(true)
      loadRodeo()
    } catch (err) {
      setArchiveError(err instanceof Error ? err.message : 'Archive failed')
    } finally {
      setArchiving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        <p className="text-gray-500">Loading result…</p>
      </div>
    )
  }

  if (error || !rodeo) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-orange-600">
          <ArrowLeft className="w-4 h-4" />Back
        </button>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700">{error ?? 'Rodeo not found.'}</p>
        </div>
      </div>
    )
  }

  const result = rodeo.rodeo_results
  const pool = rodeo.credit_pools
  const entries = rodeo.rodeo_entries ?? []

  // Determine winner entry
  const winnerEntry = result
    ? entries.find(
        (e) =>
          (result.winner_circle_id && e.circle_id === result.winner_circle_id) ||
          (result.winner_artist_id && e.artist_id === result.winner_artist_id)
      )
    : null

  // Build score map
  const scoresByEntry = new Map<string, number>()
  if (result?.rodeo_song_results) {
    for (const sr of result.rodeo_song_results) {
      scoresByEntry.set(sr.entry_id, (scoresByEntry.get(sr.entry_id) ?? 0) + sr.weighted_score)
    }
  }

  const sortedEntries = [...entries].sort(
    (a, b) => (scoresByEntry.get(b.id) ?? 0) - (scoresByEntry.get(a.id) ?? 0)
  )

  // Credit distribution
  const platformFeeMultiplier = pool ? 1 - pool.platform_fee_pct / 100 : 0.9
  const afterFee = pool ? pool.total * platformFeeMultiplier : 0
  const platformFee = pool ? pool.total * (pool.platform_fee_pct / 100) : 0

  const distributions = pool?.distribution_rules ?? []

  return (
    <div className="space-y-6 pb-12">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.push(`/rodeos/${id}`)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-orange-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Rodeo
      </button>

      {/* Header */}
      <div className="bg-gradient-to-br from-orange-500 to-amber-400 rounded-3xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold bg-white/20 px-2.5 py-1 rounded-full">
            {TYPE_LABELS[rodeo.type] ?? rodeo.type}
          </span>
          {archived && (
            <span className="text-xs font-semibold bg-white/20 px-2.5 py-1 rounded-full flex items-center gap-1">
              <Archive className="w-3 h-3" />Archived
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold mt-2 mb-1">{rodeo.title}</h1>
        <p className="text-white/80 text-sm">Final Result</p>
        {result?.finalized_at && (
          <p className="text-white/60 text-xs mt-1">Finalized {formatDate(result.finalized_at)}</p>
        )}
      </div>

      {/* Winner reveal */}
      {result && (
        <div className="bg-white border-2 border-yellow-300 rounded-3xl p-6 shadow-md text-center">
          <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-3">
            <Trophy className="w-8 h-8 text-yellow-500" />
          </div>
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Winner</p>
          {winnerEntry ? (
            <h2 className="text-2xl font-bold text-gray-900">
              {winnerEntry.circles?.name ?? winnerEntry.profiles?.display_name ?? 'Unknown'}
            </h2>
          ) : (
            <h2 className="text-2xl font-bold text-gray-900">Draw</h2>
          )}
          <div className="mt-4 flex justify-center gap-6 text-sm text-gray-500">
            <span><span className="font-bold text-gray-900">{result.circle_member_votes}</span> circle votes</span>
            <span><span className="font-bold text-gray-900">{result.general_public_votes}</span> public votes</span>
          </div>
        </div>
      )}

      {!result && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
          <p className="text-yellow-800 text-sm">This rodeo hasn&#39;t been finalized yet.</p>
        </div>
      )}

      {/* Scorecard */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Star className="w-5 h-5 text-orange-500" />
          Scorecard
        </h2>
        {sortedEntries.map((entry, i) => {
          const isWinner = winnerEntry?.id === entry.id
          const score = scoresByEntry.get(entry.id) ?? 0
          const entryName = entry.circles?.name ?? entry.profiles?.display_name ?? `Entry ${i + 1}`
          const songResults = result?.rodeo_song_results.filter((sr) => sr.entry_id === entry.id) ?? []

          return (
            <div
              key={entry.id}
              className={`bg-white border rounded-2xl p-5 shadow-sm ${isWinner ? 'border-yellow-300 ring-2 ring-yellow-200' : 'border-gray-200'}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {isWinner && <Trophy className="w-4 h-4 text-yellow-500 flex-shrink-0" />}
                  <h3 className="font-bold text-gray-900">{entryName}</h3>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-orange-600">{score.toFixed(1)}</div>
                  <div className="text-xs text-gray-400">weighted score</div>
                </div>
              </div>

              {/* Songs with scores */}
              {entry.rodeo_entry_songs.length > 0 && (
                <div className="space-y-2 mt-3 pt-3 border-t border-gray-100">
                  {entry.rodeo_entry_songs.map((es) => {
                    const sr = songResults.find((r) => r.song_id === es.song_id)
                    return (
                      <div key={es.id} className="flex items-center gap-2 text-sm">
                        <Music2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="flex-1 text-gray-700 truncate">
                          {es.circle_songs?.title ?? 'Unknown'}{' '}
                          <span className="text-gray-400">— {es.circle_songs?.artist}</span>
                        </span>
                        {es.label && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${es.label === 'live' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                            {es.label}
                          </span>
                        )}
                        {sr && (
                          <span className="text-xs text-gray-500 flex-shrink-0">
                            {sr.circle_member_votes + sr.general_public_votes} votes
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Credit distribution breakdown */}
      {pool && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
            <Coins className="w-5 h-5 text-orange-500" />
            Credit Distribution
          </h2>

          {/* Pool total */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
            <span className="text-sm text-gray-600">Total Pool</span>
            <span className="text-xl font-bold text-gray-900">{formatCredits(pool.total)}</span>
          </div>

          {/* Platform fee */}
          <div className="flex items-center justify-between text-sm mb-3 text-gray-500">
            <span>Platform Fee ({pool.platform_fee_pct}%)</span>
            <span className="font-medium">− {formatCredits(platformFee)}</span>
          </div>

          <div className="flex items-center justify-between text-sm mb-4 pb-4 border-b border-gray-100 font-semibold text-gray-800">
            <span>After Fee</span>
            <span>{formatCredits(afterFee)}</span>
          </div>

          {/* Distribution rules */}
          <div className="space-y-2">
            {distributions.map((rule, i) => {
              const amount = afterFee * (rule.percentage / 100)
              const recipientLabels: Record<string, string> = {
                winning_artist: '🎤 Winning Artist',
                songwriter: '✍️ Songwriter',
                band: '🎸 Band',
                young_bucks: '⭐ Young Bucks',
                core_artists: '🏆 Core Artists',
                users: '👥 General Backers',
              }
              return (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{recipientLabels[rule.recipient] ?? rule.recipient}</span>
                  <div className="text-right">
                    <span className="font-semibold text-gray-900">{formatCredits(amount)}</span>
                    <span className="text-gray-400 text-xs ml-1">({rule.percentage}%)</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 45/45/10 summary if no rules defined */}
          {distributions.length === 0 && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700">🎤 Artists + Songwriters</span>
                <span className="font-semibold">{formatCredits(afterFee * 0.45)} <span className="text-gray-400 text-xs">(45%)</span></span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">⭐ Core + Young Buck members</span>
                <span className="font-semibold">{formatCredits(afterFee * 0.45)} <span className="text-gray-400 text-xs">(45%)</span></span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">👥 General Backers</span>
                <span className="font-semibold">{formatCredits(afterFee * 0.10)} <span className="text-gray-400 text-xs">(10%)</span></span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Archive confirmation */}
      <div className={`border rounded-2xl p-5 ${archived ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
        <div className="flex items-center gap-3 mb-2">
          {archived ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          ) : (
            <Archive className="w-5 h-5 text-gray-500 flex-shrink-0" />
          )}
          <h3 className="font-semibold text-gray-900">
            {archived ? 'Archived to Circle History' : 'Archive Rodeo'}
          </h3>
        </div>
        {archived ? (
          <p className="text-sm text-green-700 ml-8">
            This rodeo has been permanently archived to both circles&#39; timelines.
          </p>
        ) : (
          <>
            <p className="text-sm text-gray-600 ml-8 mb-4">
              Archive this result to both circles&#39; timelines. This is permanent and cannot be undone.
            </p>
            {(rodeo.is_creator || rodeo.is_winning_circle_board) && (
              <>
                {archiveError && (
                  <p className="text-sm text-red-600 ml-8 mb-3">{archiveError}</p>
                )}
                <div className="ml-8">
                  <Button
                    variant="primary"
                    loading={archiving}
                    onClick={handleArchive}
                  >
                    <Archive className="w-4 h-4" />
                    Finalize &amp; Archive
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Post-win CTAs */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-gray-900">What&#39;s Next?</h2>
        <button
          type="button"
          onClick={() => router.push('/rodeos/challenge')}
          className="w-full bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-4 hover:border-orange-300 hover:shadow-md transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-200 transition-colors">
            <Swords className="w-5 h-5 text-orange-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">Challenge Another Circle</p>
            <p className="text-sm text-gray-500">Start a new Circle-vs-Circle Showdown</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-orange-500 transition-colors" />
        </button>

        {rodeo.created_by_circle && (
          <button
            type="button"
            onClick={() => router.push(`/circles/${rodeo.created_by_circle}`)}
            className="w-full bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-4 hover:border-orange-300 hover:shadow-md transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-200 transition-colors">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">View Circle Rodeo History</p>
              <p className="text-sm text-gray-500">See the full timeline for your circle</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-orange-500 transition-colors" />
          </button>
        )}

        <button
          type="button"
          onClick={() => router.push('/rodeos')}
          className="w-full bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-4 hover:border-orange-300 hover:shadow-md transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 group-hover:bg-green-200 transition-colors">
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">Browse All Rodeos</p>
            <p className="text-sm text-gray-500">Find upcoming events to enter</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-orange-500 transition-colors" />
        </button>
      </div>
    </div>
  )
}
