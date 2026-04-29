'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Timer,
  Trophy,
  Coins,
  Flame,
  Users,
  Music,
  Star,
  CheckCircle2,
  Lock,
  Loader2,
  AlertCircle,
  ChevronRight,
  GripVertical,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────

interface Circle {
  id: string
  name: string
  member_count: number
}

interface ArtistProfile {
  id: string
  display_name: string
  avatar_url: string | null
}

interface EntrySong {
  id: string
  entry_id: string
  song_id: string
  label: 'studio' | 'live' | null
  locked: boolean
  circle_songs: { id: string; title: string; artist: string } | null
}

interface Entry {
  id: string
  rodeo_id: string
  circle_id: string | null
  artist_id: string | null
  internal_vote_passed: boolean
  credits_contributed: number
  status: 'pending' | 'confirmed' | 'withdrawn'
  circles: Circle | null
  profiles: ArtistProfile | null
  rodeo_entry_songs: EntrySong[]
}

interface CreditPool {
  id: string
  sponsor_credits: number
  circle_credits: number
  artist_credits: number
  user_backed_credits: number
  total: number
  platform_fee_pct: number
  distribution_rules: Array<{
    id: string
    recipient: string
    percentage: number
  }>
}

interface RodeoResult {
  id: string
  winner_circle_id: string | null
  winner_artist_id: string | null
  circle_member_votes: number
  general_public_votes: number
  finalized_at: string | null
  rodeo_song_results: Array<{
    id: string
    song_id: string
    entry_id: string
    total_votes: number
    weighted_score: number
    circle_member_votes: number
    general_public_votes: number
  }>
}

interface RodeoDetail {
  id: string
  type: string
  status: string
  title: string
  description: string | null
  start_date: string | null
  end_date: string | null
  created_at: string
  credit_pools: CreditPool | null
  rodeo_entries: Entry[]
  rodeo_results: RodeoResult | null
}

interface MyVote {
  song_id: string
  target_entry_id: string
  voter_type: string
}

// ── Constants ─────────────────────────────────────────────────

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  showdown:       { bg: 'bg-red-950/30',    text: 'text-red-400',    border: 'border-red-800',    label: 'Showdown' },
  whale:          { bg: 'bg-teal-950/30',   text: 'text-teal-400',   border: 'border-teal-800',   label: 'Whale' },
  grassroots:     { bg: 'bg-green-950/30',  text: 'text-green-400',  border: 'border-green-800',  label: 'Grassroots' },
  artist_vs_artist: { bg: 'bg-amber-950/30', text: 'text-amber-400', border: 'border-amber-800', label: 'Artist vs Artist' },
}

const STATUS_STYLES: Record<string, { dot: string; label: string }> = {
  pending: { dot: 'bg-yellow-400',              label: 'Pending' },
  open:    { dot: 'bg-teal-400',                label: 'Open' },
  voting:  { dot: 'bg-green-400 animate-pulse', label: 'Voting Live' },
  closed:  { dot: 'bg-stone-500',                label: 'Closed' },
  archived:{ dot: 'bg-stone-600',                label: 'Archived' },
}

const RECIPIENT_LABELS: Record<string, string> = {
  winning_artist: 'Winning Artist',
  songwriter:     'Songwriters',
  band:           'Band',
  young_bucks:    'Young Bucks',
  core_artists:   'Core Artists',
  users:          'Voters',
  platform:       'Platform',
}

// ── Helpers ───────────────────────────────────────────────────

function formatCredits(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(0)
}

function getCountdown(endDate: string | null): string | null {
  if (!endDate) return null
  const diff = new Date(endDate).getTime() - Date.now()
  if (diff <= 0) return 'Ended'
  const days  = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  const mins  = Math.floor((diff % 3_600_000) / 60_000)
  if (days > 0)  return `${days}d ${hours}h remaining`
  if (hours > 0) return `${hours}h ${mins}m remaining`
  return `${mins}m remaining`
}

function entryDisplayName(entry: Entry): string {
  return entry.circles?.name ?? entry.profiles?.display_name ?? 'Unknown'
}

// ── Main page ─────────────────────────────────────────────────

export default function RodeoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [rodeo, setRodeo] = useState<RodeoDetail | null>(null)
  const [myVotes, setMyVotes] = useState<MyVote[]>([])
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Per-entry song order (drag-to-reorder, keyed by entry id)
  const [songOrders, setSongOrders] = useState<Record<string, EntrySong[]>>({})

  // Per-song voting state { [song_id]: 'idle' | 'voting' | 'voted' | 'error' }
  const [voteStates, setVoteStates] = useState<Record<string, 'idle' | 'voting' | 'voted' | 'error'>>({})
  const [voteError, setVoteError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setFetchError(null)
    try {
      const res = await fetch(`/api/rodeos/${id}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      setRodeo(json.rodeo)
      setMyVotes(json.myVotes ?? [])
      setIsSubscribed(json.isSubscribed ?? false)

      // Initialise per-entry song order from API data
      const orders: Record<string, EntrySong[]> = {}
      for (const entry of (json.rodeo?.rodeo_entries ?? []) as Entry[]) {
        orders[entry.id] = [...(entry.rodeo_entry_songs ?? [])]
      }
      setSongOrders(orders)

      // Pre-populate voteStates with already-cast votes
      const initial: Record<string, 'idle' | 'voting' | 'voted' | 'error'> = {}
      for (const v of (json.myVotes ?? []) as MyVote[]) {
        initial[v.song_id] = 'voted'
      }
      setVoteStates(initial)
    } catch {
      setFetchError('Could not load rodeo details.')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const castVote = useCallback(async (song_id: string, target_entry_id: string) => {
    setVoteError(null)
    setVoteStates((prev) => ({ ...prev, [song_id]: 'voting' }))
    try {
      const res = await fetch(`/api/rodeos/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song_id, target_entry_id }),
      })
      const json = await res.json()
      if (!res.ok) {
        setVoteStates((prev) => ({ ...prev, [song_id]: 'error' }))
        setVoteError(json.error ?? 'Vote failed')
        return
      }
      setVoteStates((prev) => ({ ...prev, [song_id]: 'voted' }))
      // Refresh tallies without full reload
      load()
    } catch {
      setVoteStates((prev) => ({ ...prev, [song_id]: 'error' }))
      setVoteError('Network error. Please try again.')
    }
  }, [id, load])

  const reorderSongs = useCallback((entryId: string, fromIndex: number, toIndex: number) => {
    setSongOrders((prev) => {
      const songs = [...(prev[entryId] ?? [])]
      const [moved] = songs.splice(fromIndex, 1)
      songs.splice(toIndex, 0, moved)
      return { ...prev, [entryId]: songs }
    })
  }, [])

  // ── Render states ────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    )
  }

  if (fetchError || !rodeo) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-200"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="bg-red-950/30 border border-red-800 rounded-xl p-6 text-center text-red-400">
          {fetchError ?? 'Rodeo not found.'}
        </div>
      </div>
    )
  }

  const typeStyle   = TYPE_COLORS[rodeo.type]   ?? TYPE_COLORS.showdown
  const statusStyle = STATUS_STYLES[rodeo.status] ?? STATUS_STYLES.pending
  const countdown   = getCountdown(rodeo.end_date)
  const isVoting    = rodeo.status === 'voting'
  const isFinished  = rodeo.status === 'closed' || rodeo.status === 'archived'
  const pool        = rodeo.credit_pools
  const result      = rodeo.rodeo_results
  const entries     = (rodeo.rodeo_entries ?? []).filter((e) => e.status !== 'withdrawn')

  const totalVotes  = result
    ? (result.circle_member_votes ?? 0) + (result.general_public_votes ?? 0)
    : 0

  // Build song→score lookup for finished/voting rodeos
  const songScores = new Map<string, { total_votes: number; weighted_score: number; circle_member_votes: number; general_public_votes: number }>()
  if (result?.rodeo_song_results) {
    for (const sr of result.rodeo_song_results) {
      songScores.set(sr.song_id, sr)
    }
  }

  // Current standing: vote-weighted scores if available, else avg-rating × count fallback
  const entryScores = entries.map((e) => {
    const songs = songOrders[e.id] ?? e.rodeo_entry_songs ?? []
    let score = 0
    for (const es of songs) {
      const voteScore = songScores.get(es.song_id)?.weighted_score
      if (voteScore !== undefined) score += voteScore
    }
    return { entry: e, score }
  })
  const hasAnyScore = entryScores.some((x) => x.score > 0)
  const leadingEntry = hasAnyScore && entryScores.length >= 2
    ? [...entryScores].sort((a, b) => b.score - a.score)[0]
    : null

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Back */}
      <button
        type="button"
        onClick={() => router.push('/rodeos')}
        className="flex items-center gap-2 text-sm text-stone-500 hover:text-amber-400 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Rodeo Feed
      </button>

      {/* ── Header ──────────────────────────────────────────── */}
      <div className={`rounded-2xl border p-6 ${typeStyle.bg} ${typeStyle.border}`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            {/* Type + status badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full bg-stone-900/80 ${typeStyle.text}`}>
                {typeStyle.label}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-stone-400">
                <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
                {statusStyle.label}
              </span>
            </div>

            <h1 className={`text-2xl font-bold font-display ${typeStyle.text}`}>{rodeo.title}</h1>

            {rodeo.description && (
              <p className="text-sm text-stone-400 max-w-lg">{rodeo.description}</p>
            )}
          </div>

          {/* Countdown */}
          {isVoting && countdown && (
            <div className="flex items-center gap-2 bg-stone-900/70 rounded-xl px-4 py-3 text-amber-400 font-semibold shrink-0">
              <Timer className="w-5 h-5" />
              <span className="text-sm">{countdown}</span>
            </div>
          )}
        </div>

        {/* Matchup row */}
        {entries.length >= 2 && (
          <div className="mt-5 pt-4 border-t border-stone-700/50 space-y-3">
            {/* VS chips */}
            <div className="flex items-center gap-3 flex-wrap">
              <EntryChip
                entry={entries[0]}
                isWinner={result?.winner_circle_id === entries[0].circle_id || result?.winner_artist_id === entries[0].artist_id}
                isLeading={leadingEntry?.entry.id === entries[0].id}
              />
              <span className="text-sm font-bold text-stone-500 shrink-0">VS</span>
              <EntryChip
                entry={entries[1]}
                isWinner={result?.winner_circle_id === entries[1].circle_id || result?.winner_artist_id === entries[1].artist_id}
                isLeading={leadingEntry?.entry.id === entries[1].id}
              />
              {isVoting && (
                <button
                  type="button"
                  onClick={() => router.push(`/rodeos/${rodeo.id}/vote`)}
                  className="ml-auto flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                >
                  <span className="w-2 h-2 rounded-full bg-stone-900 animate-pulse" />
                  Vote Now
                </button>
              )}
              {isFinished && (
                <button
                  type="button"
                  onClick={() => router.push(`/rodeos/${rodeo.id}/result`)}
                  className="ml-auto flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  View Result
                </button>
              )}
            </div>

            {/* Current standing score bars */}
            {hasAnyScore && (
              <div className="space-y-1.5">
                {[...entryScores].sort((a, b) => b.score - a.score).map(({ entry: e, score }, rank) => {
                  const maxScore = Math.max(...entryScores.map((x) => x.score), 1)
                  const pct = (score / maxScore) * 100
                  const isTop = rank === 0
                  return (
                    <div key={e.id}>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <div className="flex items-center gap-1.5">
                          {isTop && <Flame className="w-3.5 h-3.5 text-amber-400" />}
                          <span className={`font-semibold truncate max-w-[160px] ${isTop ? 'text-white' : 'text-stone-500'}`}>
                            {entryDisplayName(e)}
                          </span>
                          {isTop && <span className="text-amber-400 font-bold text-[10px] uppercase tracking-wide">Leading</span>}
                        </div>
                        <span className="tabular-nums font-bold text-stone-300 ml-2">{score.toFixed(1)}</span>
                      </div>
                      <div className="h-1.5 bg-stone-900/50 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isTop ? 'bg-amber-500' : 'bg-stone-600'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
                <div className="text-[10px] text-stone-600 text-right">
                  based on votes
                </div>
              </div>
            )}
          </div>
        )}
        {entries.length === 1 && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-stone-700/50 text-sm text-stone-500">
            <Users className="w-4 h-4" />
            {entryDisplayName(entries[0])}
            <span className="text-stone-600 ml-1">— awaiting challenger</span>
          </div>
        )}
      </div>

      {/* ── Vote error banner ───────────────────────────────── */}
      {voteError && (
        <div className="flex items-center gap-3 bg-red-950/30 border border-red-800 rounded-xl p-4 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {voteError}
          <button
            type="button"
            className="ml-auto text-xs underline"
            onClick={() => setVoteError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Vote tallies (show when voting or finished) ─────── */}
      {(isVoting || isFinished) && result && (
        <VoteTallies
          circleMemberVotes={result.circle_member_votes}
          generalPublicVotes={result.general_public_votes}
          total={totalVotes}
          entries={entries}
          songScores={songScores}
        />
      )}

      {/* ── Songs on the Line ───────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="font-bold text-white text-lg flex items-center gap-2">
          <Music className="w-5 h-5 text-amber-400" />
          Songs on the Line
        </h2>

        {entries.length === 0 && (
          <p className="text-sm text-stone-500">No entries yet.</p>
        )}

        {/* Combined list during voting/finished; per-entry during pending (drag-reorder) */}
        {(isVoting || isFinished) && (
          <CombinedSongsCard
            entries={entries}
            isVoting={isVoting}
            isSubscribed={isSubscribed}
            myVotes={myVotes}
            voteStates={voteStates}
            songScores={songScores}
            songOrders={songOrders}
            onVote={castVote}
          />
        )}
        {!isVoting && !isFinished && entries.map((entry: Entry) => (
          <EntrySongsCard
            key={entry.id}
            entry={entry}
            isVoting={false}
            isSubscribed={isSubscribed}
            myVotes={myVotes}
            voteStates={voteStates}
            songScores={songScores}
            isFinished={false}
            songOrders={songOrders}
            onVote={castVote}
            onReorder={reorderSongs}
          />
        ))}
      </div>

      {/* ── Credit pool breakdown ────────────────────────────── */}
      {pool && (
        <CreditPoolSection pool={pool} isFinished={isFinished} result={result} />
      )}

      {/* ── Circle history links ─────────────────────────────── */}
      {entries.some((e) => e.circles) && (
        <div className="bg-stone-900 rounded-2xl border border-stone-700 p-5">
          <h2 className="font-bold text-white mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            Circle Rodeo History
          </h2>
          <div className="space-y-2">
            {entries
              .filter((e) => e.circles)
              .map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => router.push(`/circles/${e.circle_id}`)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-stone-950 hover:bg-amber-950/20 rounded-xl transition-colors group text-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-900/30 flex items-center justify-center">
                      <Users className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-white group-hover:text-amber-300">
                        {e.circles!.name}
                      </div>
                      <div className="text-xs text-stone-600">
                        {e.circles!.member_count ?? 0} members · View all rodeos
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-700 group-hover:text-amber-400 transition-colors" />
                </button>
              ))}
          </div>
        </div>
      )}

    </div>
  )
}

// ── EntryChip ─────────────────────────────────────────────────

function EntryChip({ entry, isWinner, isLeading }: { entry: Entry; isWinner: boolean; isLeading?: boolean }) {
  const name = entryDisplayName(entry)
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
      isWinner
        ? 'bg-yellow-950/30 border-yellow-700'
        : isLeading
        ? 'bg-amber-900/30 border-amber-700'
        : 'bg-stone-900/60 border-transparent'
    }`}>
      {isWinner && <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />}
      {!isWinner && isLeading && <Flame className="w-3.5 h-3.5 text-amber-400" />}
      <span className={`text-sm font-semibold truncate max-w-[140px] ${
        isWinner ? 'text-yellow-300' : isLeading ? 'text-amber-200' : 'text-stone-100'
      }`}>
        {name}
      </span>
    </div>
  )
}

// ── VoteTallies ───────────────────────────────────────────────

function VoteTallies({
  circleMemberVotes,
  generalPublicVotes,
  total,
  entries,
  songScores,
}: {
  circleMemberVotes: number
  generalPublicVotes: number
  total: number
  entries: Entry[]
  songScores: Map<string, { total_votes: number; weighted_score: number; circle_member_votes: number; general_public_votes: number }>
}) {
  // Build per-entry vote totals from song results
  const entryTotals = new Map<string, number>()
  entries.forEach((e) => {
    let sum = 0
    e.rodeo_entry_songs.forEach((es) => {
      sum += songScores.get(es.song_id)?.weighted_score ?? 0
    })
    entryTotals.set(e.id, sum)
  })

  const maxScore = Math.max(0, ...Array.from(entryTotals.values()))

  return (
    <div className="bg-stone-900 rounded-2xl border border-stone-700 p-5 space-y-4">
      <h2 className="font-bold text-white flex items-center gap-2">
        <Flame className="w-5 h-5 text-amber-400" />
        Live Vote Tallies
      </h2>

      {/* Voter breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-amber-950/30 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-amber-400">{circleMemberVotes}</div>
          <div className="text-xs text-amber-400 mt-0.5">Circle Member Votes</div>
          <div className="text-xs text-amber-400">(2× weighted)</div>
        </div>
        <div className="bg-teal-950/30 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-teal-400">{generalPublicVotes}</div>
          <div className="text-xs text-teal-400 mt-0.5">General Public Votes</div>
          <div className="text-xs text-teal-400">(1× weighted)</div>
        </div>
      </div>

      {/* Per-entry score bars */}
      {entries.length > 0 && (
        <div className="space-y-3 pt-1">
          {entries.map((e) => {
            const score = entryTotals.get(e.id) ?? 0
            const pct = maxScore > 0 ? (score / maxScore) * 100 : 0
            return (
              <div key={e.id}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium text-stone-300 truncate">{entryDisplayName(e)}</span>
                  <span className="font-bold text-white tabular-nums ml-2">{score.toFixed(1)}</span>
                </div>
                <div className="h-2 bg-stone-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
          <div className="text-xs text-stone-600 text-right">{total} total votes</div>
        </div>
      )}
    </div>
  )
}

// ── EntrySongsCard ────────────────────────────────────────────

function EntrySongsCard({
  entry,
  isVoting,
  isSubscribed,
  myVotes,
  voteStates,
  songScores,
  isFinished,
  songOrders,
  onVote,
  onReorder,
}: {
  entry: Entry
  isVoting: boolean
  isSubscribed: boolean
  myVotes: MyVote[]
  voteStates: Record<string, 'idle' | 'voting' | 'voted' | 'error'>
  songScores: Map<string, { total_votes: number; weighted_score: number; circle_member_votes: number; general_public_votes: number }>
  isFinished: boolean
  songOrders: Record<string, EntrySong[]>
  onVote: (song_id: string, entry_id: string) => void
  onReorder: (entryId: string, fromIndex: number, toIndex: number) => void
}) {
  const name = entryDisplayName(entry)
  const songs = songOrders[entry.id] ?? entry.rodeo_entry_songs ?? []

  // ── Drag state ───────────────────────────────────────────────
  const [dragIndex, setDragIndex]   = useState<number | null>(null)
  const [dropIndex, setDropIndex]   = useState<number | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const listRef      = useRef<HTMLUListElement>(null)
  const dragStartY   = useRef(0)
  const itemHeights  = useRef<number[]>([])

  const startDrag = (e: React.PointerEvent<HTMLButtonElement>, index: number) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStartY.current = e.clientY
    // Snapshot actual item heights so shift math is pixel-perfect
    if (listRef.current) {
      itemHeights.current = Array.from(listRef.current.children).map(
        (c) => (c as HTMLElement).offsetHeight
      )
    }
    setDragIndex(index)
    setDropIndex(index)
    setDragOffset(0)
  }

  const moveDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragIndex === null) return
    setDragOffset(e.clientY - dragStartY.current)
    if (!listRef.current) return
    // Compute drop target from raw DOM rects (items haven't physically moved)
    const items = Array.from(listRef.current.children) as HTMLElement[]
    let newDrop = songs.length - 1
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect()
      if (e.clientY < rect.top + rect.height / 2) { newDrop = i; break }
    }
    if (newDrop !== dropIndex) setDropIndex(newDrop)
  }

  const endDrag = () => {
    if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
      onReorder(entry.id, dragIndex, dropIndex)
    }
    setDragIndex(null)
    setDropIndex(null)
    setDragOffset(0)
  }

  // How much should item at `index` shift to make room for the drag?
  const getShift = (index: number): number => {
    if (dragIndex === null || dropIndex === null || index === dragIndex) return 0
    const h = itemHeights.current[dragIndex] ?? 72
    if (dragIndex < dropIndex) {
      // Dragging down — items between drag+1..drop shift up
      if (index > dragIndex && index <= dropIndex) return -h
    } else {
      // Dragging up — items between drop..drag-1 shift down
      if (index >= dropIndex && index < dragIndex) return h
    }
    return 0
  }

  const isDragging = dragIndex !== null

  return (
    <div className="bg-stone-900 rounded-2xl border border-stone-700 overflow-hidden">
      {/* Entry header */}
      <div className="flex items-center gap-3 px-5 py-3 bg-stone-950 border-b border-stone-800">
        <div className="w-7 h-7 rounded-full bg-amber-900/30 flex items-center justify-center shrink-0">
          <Users className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <span className="font-semibold text-stone-100">{name}</span>
        <div className="ml-auto flex items-center gap-2">
          {songs.length > 1 && (
            <span className="flex items-center gap-1 text-xs text-stone-500 bg-stone-800 px-2 py-0.5 rounded-full">
              <GripVertical className="w-3 h-3" />
              drag to rank
            </span>
          )}
          <span className="text-xs text-stone-600">
            {songs.length} song{songs.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Songs list */}
      {songs.length === 0 ? (
        <div className="px-5 py-4 text-sm text-stone-600">No songs added yet.</div>
      ) : (
        <ul
          ref={listRef}
          className="flex flex-col gap-1.5 p-2"
          style={{ userSelect: isDragging ? 'none' : 'auto' }}
        >
          {songs.map((es, index) => {
            const song       = es.circle_songs
            const voteState  = voteStates[es.song_id] ?? 'idle'
            const hasVoted   = voteState === 'voted' || myVotes.some((v) => v.song_id === es.song_id)
            const songResult = songScores.get(es.song_id)
            const isThis     = dragIndex === index
            const shift      = getShift(index)

            // Rank badge: dragged item shows where it will land
            const displayRank = isThis && dropIndex !== null ? dropIndex + 1 : index + 1

            return (
              <li
                key={es.id}
                style={{
                  transform: isThis
                    ? `translateY(${dragOffset}px) scale(1.03)`
                    : `translateY(${shift}px)`,
                  transition: isThis ? 'box-shadow 150ms, border-color 150ms' : 'transform 180ms cubic-bezier(0.2,0,0,1)',
                  zIndex: isThis ? 50 : 'auto',
                  position: 'relative',
                  boxShadow: isThis
                    ? '0 16px 48px rgba(0,0,0,0.7), 0 0 0 2px rgba(236,72,153,0.5)'
                    : undefined,
                }}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl border transition-colors ${
                  isThis
                    ? 'bg-stone-700 border-amber-500/60 cursor-grabbing'
                    : 'bg-stone-800/60 border-stone-700 hover:bg-stone-800 hover:border-stone-600'
                }`}
              >
                {/* Drag grip */}
                <button
                  type="button"
                  className="touch-none cursor-grab active:cursor-grabbing shrink-0 select-none rounded-md p-1 text-stone-500 hover:text-amber-400 hover:bg-amber-950/30 transition-colors"
                  onPointerDown={(e) => startDrag(e, index)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  title="Drag to reorder"
                >
                  <GripVertical className="w-5 h-5" />
                </button>

                {/* Rank badge — shows live target position while dragging */}
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 tabular-nums transition-colors ${
                  displayRank === 1
                    ? 'bg-amber-500 text-white'
                    : displayRank === 2
                    ? 'bg-stone-600 text-stone-200'
                    : 'bg-stone-700 text-stone-500'
                }`}>
                  {displayRank}
                </span>

                {/* Icon */}
                <div className="w-8 h-8 rounded-lg bg-amber-950/20 flex items-center justify-center shrink-0">
                  <Music className="w-4 h-4 text-amber-400" />
                </div>

                {/* Song info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white truncate">
                      {song?.title ?? 'Untitled'}
                    </span>
                    {es.label && <SongLabelBadge label={es.label} />}
                    {es.locked && <Lock className="w-3 h-3 text-stone-600" />}
                  </div>
                  <div className="text-xs text-stone-500 truncate mt-0.5">
                    {song?.artist ?? 'Unknown artist'}
                  </div>

                  {/* Song score (finished) */}
                  {isFinished && songResult && (
                    <div className="text-xs text-stone-600 mt-0.5 tabular-nums">
                      {songResult.total_votes} votes · {songResult.weighted_score.toFixed(1)} pts
                    </div>
                  )}
                </div>

                {/* Vote button */}
                {isVoting && (
                  <VoteButton
                    state={voteState}
                    isSubscribed={isSubscribed}
                    hasVoted={hasVoted}
                    onClick={() => onVote(es.song_id, entry.id)}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ── SongLabelBadge ────────────────────────────────────────────

function SongLabelBadge({ label }: { label: 'studio' | 'live' }) {
  if (label === 'live') {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded bg-red-900/30 text-red-400 font-medium">
        Live
      </span>
    )
  }
  return (
    <span className="text-xs px-1.5 py-0.5 rounded bg-stone-800 text-stone-500 font-medium">
      Studio
    </span>
  )
}

// ── CombinedSongsCard ─────────────────────────────────────────
// Shows all songs from all entries in a single interleaved list
// with a per-circle colour badge. Used during voting/finished.

const COMBINED_COLORS = [
  { badge: 'bg-amber-900/40 text-amber-300 border-amber-700', dot: 'bg-amber-400' },
  { badge: 'bg-teal-900/40 text-teal-300 border-teal-700',   dot: 'bg-teal-400'  },
]

type SongWithMeta = EntrySong & { entryName: string; entryIdx: number; entryId: string; circleId: string | null }

function CombinedSongsCard({
  entries,
  isVoting,
  isSubscribed,
  myVotes,
  voteStates,
  songScores,
  songOrders,
  onVote,
}: {
  entries: Entry[]
  isVoting: boolean
  isSubscribed: boolean
  myVotes: MyVote[]
  voteStates: Record<string, 'idle' | 'voting' | 'voted' | 'error'>
  songScores: Map<string, { total_votes: number; weighted_score: number; circle_member_votes: number; general_public_votes: number }>
  songOrders: Record<string, EntrySong[]>
  onVote: (song_id: string, entry_id: string) => void
}) {
  // Interleave: e0[0], e1[0], e0[1], e1[1], …
  const combined: SongWithMeta[] = []
  const maxLen = Math.max(...entries.map((e) => (songOrders[e.id] ?? e.rodeo_entry_songs ?? []).length), 0)
  for (let i = 0; i < maxLen; i++) {
    for (let j = 0; j < entries.length; j++) {
      const songs = songOrders[entries[j].id] ?? entries[j].rodeo_entry_songs ?? []
      const es = songs[i]
      if (es) {
        combined.push({
          ...es,
          entryName: entryDisplayName(entries[j]),
          entryIdx: j,
          entryId: entries[j].id,
          circleId: entries[j].circle_id,
        })
      }
    }
  }

  return (
    <div className="bg-stone-900 rounded-2xl border border-stone-700 overflow-hidden">
      {combined.length === 0 && (
        <div className="px-5 py-4 text-sm text-stone-600">No songs added yet.</div>
      )}
      <ul className="flex flex-col divide-y divide-stone-800">
        {combined.map((es) => {
          const song       = es.circle_songs
          const voteState  = voteStates[es.song_id] ?? 'idle'
          const hasVoted   = voteState === 'voted' || myVotes.some((v) => v.song_id === es.song_id)
          const songResult = songScores.get(es.song_id)
          const color      = COMBINED_COLORS[es.entryIdx % COMBINED_COLORS.length]

          return (
            <li key={es.id} className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-950/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Music className="w-4 h-4 text-amber-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-white text-sm">{song?.title ?? 'Unknown'}</span>
                    {es.label && <SongLabelBadge label={es.label} />}
                    {es.locked && <span title="Locked"><Lock className="w-3 h-3 text-stone-600" /></span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <p className="text-xs text-stone-600">{song?.artist ?? ''}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${color.badge}`}>
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${color.dot}`} />
                      {es.entryName}
                    </span>
                  </div>
                </div>

                {isVoting && (
                  <div className="shrink-0">
                    <VoteButton
                      state={voteState}
                      isSubscribed={isSubscribed}
                      hasVoted={hasVoted}
                      onClick={() => onVote(es.song_id, es.entryId)}
                    />
                  </div>
                )}
              </div>

              {/* Per-song score bar */}
              {songResult && (
                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center justify-between text-xs text-stone-600">
                    <span>{songResult.total_votes} votes</span>
                    <span className="tabular-nums font-medium text-stone-400">{songResult.weighted_score.toFixed(1)} pts</span>
                  </div>
                  <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, songResult.weighted_score * 10)}%` }}
                    />
                  </div>
                </div>
              )}

            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── VoteButton ────────────────────────────────────────────────

function VoteButton({
  state,
  isSubscribed,
  hasVoted,
  onClick,
}: {
  state: 'idle' | 'voting' | 'voted' | 'error'
  isSubscribed: boolean
  hasVoted: boolean
  onClick: () => void
}) {
  if (!isSubscribed) {
    return (
      <button
        type="button"
        disabled
        title="A paid subscription is required to vote"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-800 text-stone-600 cursor-not-allowed"
      >
        <Lock className="w-3 h-3" />
        Vote
      </button>
    )
  }

  if (hasVoted || state === 'voted') {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-900/30 text-green-400">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Voted
      </div>
    )
  }

  if (state === 'voting') {
    return (
      <button type="button" disabled className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-900/30 text-amber-400">
        <Loader2 className="w-3 h-3 animate-spin" />
        Voting…
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 active:scale-95 transition-all"
    >
      <Star className="w-3 h-3" />
      Vote
    </button>
  )
}

// ── CreditPoolSection ─────────────────────────────────────────

function CreditPoolSection({
  pool,
  isFinished,
  result,
}: {
  pool: CreditPool
  isFinished: boolean
  result: RodeoResult | null
}) {
  const breakdown = [
    { label: 'Sponsor Credits',     value: pool.sponsor_credits,      color: 'bg-yellow-400' },
    { label: 'Circle Credits',      value: pool.circle_credits,       color: 'bg-amber-500' },
    { label: 'Artist Credits',      value: pool.artist_credits,       color: 'bg-amber-400' },
    { label: 'User-backed Credits', value: pool.user_backed_credits,  color: 'bg-teal-400' },
  ].filter((b) => b.value > 0)

  const net = pool.total * (1 - pool.platform_fee_pct / 100)

  return (
    <div className="bg-stone-900 rounded-2xl border border-stone-700 p-5 space-y-4">
      <h2 className="font-bold text-white flex items-center gap-2">
        <Coins className="w-5 h-5 text-yellow-400" />
        Credit Pool
      </h2>

      {/* Total */}
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-white">{formatCredits(pool.total)}</span>
        <span className="text-sm text-stone-600">total credits</span>
        {pool.platform_fee_pct > 0 && (
          <span className="ml-auto text-xs text-stone-600">
            {formatCredits(net)} after {pool.platform_fee_pct}% platform fee
          </span>
        )}
      </div>

      {/* Visual bar */}
      {breakdown.length > 0 && (
        <div className="h-3 flex rounded-full overflow-hidden gap-0.5">
          {breakdown.map((b) => (
            <div
              key={b.label}
              className={`${b.color} transition-all`}
              style={{ width: `${(b.value / pool.total) * 100}%` }}
              title={`${b.label}: ${formatCredits(b.value)}`}
            />
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2">
        {breakdown.map((b) => (
          <div key={b.label} className="flex items-center gap-2 text-sm">
            <div className={`w-2.5 h-2.5 rounded-sm ${b.color} shrink-0`} />
            <span className="text-stone-400 truncate">{b.label}</span>
            <span className="ml-auto font-medium text-stone-100 tabular-nums">{formatCredits(b.value)}</span>
          </div>
        ))}
      </div>

      {/* Distribution rules */}
      {pool.distribution_rules && pool.distribution_rules.length > 0 && (
        <div className="pt-3 border-t border-stone-800">
          <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
            Prize Distribution
          </div>
          <div className="space-y-1.5">
            {pool.distribution_rules.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-stone-400">{RECIPIENT_LABELS[r.recipient] ?? r.recipient}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-stone-800 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${r.percentage}%` }} />
                  </div>
                  <span className="text-xs font-medium text-stone-300 tabular-nums w-8 text-right">
                    {r.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actual distributions (finished) */}
      {isFinished && result && (
        <div className="pt-3 border-t border-stone-800">
          <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
            Credits Awarded
          </div>
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            Final results recorded
            {result.finalized_at && (
              <span className="text-stone-600 text-xs ml-auto">
                {new Date(result.finalized_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
