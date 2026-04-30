'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Timer,
  CheckCircle2,
  Lock,
  Loader2,
  AlertCircle,
  Music,
  ChevronUp,
  ChevronDown,
  Plus,
  X,
  Zap,
  Crown,
  Send,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────

interface SongTally {
  song_id: string
  entry_id: string
  title: string
  artist: string
  label: 'studio' | 'live' | null
  locked: boolean
  borda_score: number
  ranker_count: number
}

interface EntryTally {
  id: string
  name: string
  borda_score: number
  credits_contributed: number
  songs: SongTally[]
}

interface TallyData {
  entries: EntryTally[]
  total_borda: number
  total_rankers: number
  my_ranking: string[]
  is_subscribed: boolean
}

// ── Helpers ───────────────────────────────────────────────────

function getCountdown(endDate: string | null): string | null {
  if (!endDate) return null
  const diff = new Date(endDate).getTime() - Date.now()
  if (diff <= 0) return 'Ended'
  const days  = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  const mins  = Math.floor((diff % 3_600_000) / 60_000)
  const secs  = Math.floor((diff % 60_000) / 1_000)
  if (days > 0)  return `${days}d ${hours}h ${mins}m`
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`
  return `${mins}m ${secs}s`
}

// ── Loading skeleton ──────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-pulse">
      <div className="h-8 w-40 bg-stone-700 rounded" />
      <div className="h-32 bg-stone-700 rounded-2xl" />
      {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-stone-700 rounded-2xl" />)}
    </div>
  )
}

// ── Palette for circle colour coding ─────────────────────────

const ENTRY_COLORS = [
  { badge: 'bg-amber-900/40 text-amber-300 border-amber-700', dot: 'bg-amber-400' },
  { badge: 'bg-teal-900/40 text-teal-300 border-teal-700',   dot: 'bg-teal-400'  },
]

// ── Main page ─────────────────────────────────────────────────

export default function VotingPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [meta, setMeta]           = useState<{ title: string; end_date: string | null; status: string } | null>(null)
  const [tally, setTally]         = useState<TallyData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<string | null>(null)

  // Local ranking state — ordered song_ids in the voter's current ballot
  const [rankedIds, setRankedIds] = useState<string[]>([])
  // Whether the voter has submitted at least once this session
  const [submitted, setSubmitted]       = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError]   = useState<string | null>(null)

  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const initialised  = useRef(false)

  // ── Load tally ───────────────────────────────────────────

  const loadTally = useCallback(async () => {
    try {
      const res = await fetch(`/api/rodeos/${id}/tally`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        if (!initialised.current) setFetchError(json.error ?? `Error ${res.status} loading tally`)
        return
      }
      const json: TallyData = await res.json()
      setTally(json)
      // Only seed rankedIds from server on first load
      if (!initialised.current) {
        setRankedIds(json.my_ranking ?? [])
        if ((json.my_ranking ?? []).length > 0) setSubmitted(true)
        initialised.current = true
      }
    } finally {
      setIsLoading(false)
    }
  }, [id])

  const loadMeta = useCallback(async () => {
    const res = await fetch(`/api/rodeos/${id}`)
    if (!res.ok) { setFetchError('Rodeo not found.'); setIsLoading(false); return }
    const json = await res.json()
    setMeta({ title: json.rodeo?.title, end_date: json.rodeo?.end_date, status: json.rodeo?.status })
  }, [id])

  useEffect(() => {
    setIsLoading(true)
    Promise.all([loadMeta(), loadTally()])
    pollRef.current = setInterval(loadTally, 12_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [loadMeta, loadTally])

  useEffect(() => {
    if (!meta?.end_date) return
    const tick = () => setCountdown(getCountdown(meta.end_date))
    tick()
    countdownRef.current = setInterval(tick, 1_000)
    return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
  }, [meta?.end_date])

  // ── Ranking mutations ────────────────────────────────────

  const addToRanking = useCallback((song_id: string) => {
    setRankedIds((prev) => prev.includes(song_id) ? prev : [...prev, song_id])
  }, [])

  const removeFromRanking = useCallback((song_id: string) => {
    setRankedIds((prev) => prev.filter((id) => id !== song_id))
  }, [])

  const moveUp = useCallback((idx: number) => {
    if (idx === 0) return
    setRankedIds((prev) => {
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }, [])

  const moveDown = useCallback((idx: number) => {
    setRankedIds((prev) => {
      if (idx >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }, [])

  // ── Submit ranking ───────────────────────────────────────

  const submitRanking = useCallback(async () => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(`/api/rodeos/${id}/rank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song_ids: rankedIds }),
      })
      const json = await res.json()
      if (!res.ok) {
        setSubmitError(json.error ?? 'Failed to submit ranking.')
        return
      }
      setSubmitted(true)
      loadTally()
    } catch {
      setSubmitError('Network error — please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }, [id, rankedIds, loadTally])

  // ── Render ───────────────────────────────────────────────

  if (isLoading) return <LoadingSkeleton />

  if (fetchError || !tally) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <BackButton onClick={() => router.back()} />
        <div className="bg-red-950/30 border border-red-800 rounded-xl p-6 text-center text-red-400">
          {fetchError ?? 'Could not load voting data.'}
        </div>
      </div>
    )
  }

  const isOpen   = meta?.status === 'voting'
  const canRank  = tally.is_subscribed && isOpen

  // Build a flat song map for quick lookup
  const songMap  = new Map<string, SongTally & { entryIdx: number; entryName: string }>()
  tally.entries.forEach((entry, idx) => {
    entry.songs.forEach((song) => {
      songMap.set(song.song_id, { ...song, entryIdx: idx, entryName: entry.name })
    })
  })

  // Interleaved full song list (the canonical display order)
  const allSongs: (SongTally & { entryIdx: number; entryName: string })[] = []
  const maxLen = Math.max(...tally.entries.map((e) => e.songs.length), 0)
  for (let i = 0; i < maxLen; i++) {
    for (let j = 0; j < tally.entries.length; j++) {
      const song = tally.entries[j].songs[i]
      if (song) allSongs.push({ ...song, entryIdx: j, entryName: tally.entries[j].name })
    }
  }

  const rankedSet   = new Set(rankedIds)
  const unranked    = allSongs.filter((s) => !rankedSet.has(s.song_id))
  const rankedSongs = rankedIds.map((id) => songMap.get(id)).filter(Boolean) as (SongTally & { entryIdx: number; entryName: string })[]

  const sorted   = [...tally.entries].sort((a, b) => b.borda_score - a.borda_score)
  const totalB   = tally.total_borda
  const leader   = sorted[0]

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-20">

      {/* Back */}
      <BackButton onClick={() => router.push(`/rodeos/${id}`)} label="Back to Rodeo" />

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-amber-900 via-stone-800 to-stone-900 rounded-2xl p-6 border border-amber-800/40 shadow-lg">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-green-300 animate-pulse' : 'bg-stone-500'}`} />
              <span className="text-xs font-medium text-amber-200/80 uppercase tracking-wide">
                {isOpen ? 'Ranking Live' : 'Ranking Closed'}
              </span>
            </div>
            <h1 className="text-xl font-bold font-display leading-tight text-amber-100">
              {meta?.title ?? 'Rodeo'}
            </h1>
          </div>
          {countdown && isOpen && (
            <div className="flex items-center gap-2 bg-stone-900/30 backdrop-blur rounded-xl px-4 py-2 shrink-0">
              <Timer className="w-4 h-4 text-amber-200" />
              <span className="text-sm font-bold tabular-nums text-amber-100">{countdown}</span>
            </div>
          )}
        </div>
        <p className="mt-3 text-xs text-amber-200/60 leading-relaxed">
          Use the arrow buttons to move songs up or down. Rank 1 carries the most weight.
          You can rank all songs or just your favourites — submit when ready.
        </p>
      </div>

      {/* ── Subscription gate ───────────────────────────────── */}
      {!tally.is_subscribed && <SubscriptionGate />}

      {/* ── Submitted banner ────────────────────────────────── */}
      {submitted && canRank && (
        <div className="flex items-center gap-3 bg-green-950/30 border border-green-800 rounded-xl px-4 py-3 text-sm text-green-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Ranking submitted — reorder and resubmit anytime.</span>
        </div>
      )}

      {/* ── Submit error ─────────────────────────────────────── */}
      {submitError && (
        <div className="flex items-center gap-3 bg-red-950/30 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {submitError}
          <button type="button" className="ml-auto text-xs underline" onClick={() => setSubmitError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* ── Ranked ballot ───────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Music className="w-4 h-4 text-amber-400" />
            Your Ranking
            {rankedIds.length > 0 && (
              <span className="text-xs font-normal text-stone-500">{rankedIds.length} song{rankedIds.length !== 1 ? 's' : ''}</span>
            )}
          </h2>
        </div>

        {rankedIds.length === 0 ? (
          <div className="bg-stone-900 border border-stone-700 border-dashed rounded-2xl px-5 py-8 text-center text-stone-600 text-sm">
            Add songs from below to start your ranking
          </div>
        ) : (
          <RankingList
            songs={rankedSongs}
            canRank={canRank}
            onRemove={removeFromRanking}
            onMoveUp={moveUp}
            onMoveDown={moveDown}
          />
        )}
      </div>

      {/* ── Submit button ────────────────────────────────────── */}
      {canRank && (
        <button
          type="button"
          onClick={submitRanking}
          disabled={isSubmitting || rankedIds.length === 0}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all
            bg-amber-500 text-white hover:bg-amber-600 active:scale-95
            disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {isSubmitting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
            : <><Send className="w-4 h-4" /> {submitted ? 'Update Ranking' : 'Submit Ranking'}</>
          }
        </button>
      )}

      {/* ── Not ranked pool ─────────────────────────────────── */}
      {unranked.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-bold text-stone-500 text-sm flex items-center gap-2">
            <Plus className="w-3.5 h-3.5" />
            Not in your ranking
          </h2>
          <div className="bg-stone-900 rounded-2xl border border-stone-800 divide-y divide-stone-800">
            {unranked.map((song) => {
              const color = ENTRY_COLORS[song.entryIdx % ENTRY_COLORS.length]
              return (
                <div key={song.song_id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-lg bg-stone-800 flex items-center justify-center shrink-0">
                    <Music className="w-3.5 h-3.5 text-stone-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-stone-400 truncate">{song.title}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-stone-600 truncate">{song.artist}</span>
                      <span className={`text-xs px-1.5 py-0 rounded-full border font-medium ${color.badge}`}>
                        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${color.dot}`} />
                        {song.entryName}
                      </span>
                    </div>
                  </div>
                  {canRank && (
                    <button
                      type="button"
                      onClick={() => addToRanking(song.song_id)}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-stone-800 text-stone-400 hover:bg-amber-950/30 hover:text-amber-400 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Live tallies ────────────────────────────────────── */}
      <LiveTallies entries={sorted} totalBorda={totalB} totalRankers={tally.total_rankers} leader={leader} />

    </div>
  )
}

// ── BackButton ────────────────────────────────────────────────

function BackButton({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 text-sm text-stone-500 hover:text-amber-400 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      {label}
    </button>
  )
}

// ── SubscriptionGate ──────────────────────────────────────────

function SubscriptionGate() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-stone-950 to-stone-900 rounded-2xl p-6 text-white border border-stone-800">
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-amber-500/20 blur-2xl pointer-events-none" />
      <div className="relative space-y-3">
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-amber-400" />
          <span className="font-bold text-lg">Subscription Required</span>
        </div>
        <p className="text-sm text-stone-400 leading-relaxed">
          Ranking in Rodeos is reserved for Stampede subscribers. Upgrade to submit
          your ballot, earn credits, and shape which music wins.
        </p>
        <p className="text-xs text-stone-600">
          Live tallies below are always visible — no weighting hidden.
        </p>
        <button
          type="button"
          className="w-full mt-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 font-semibold text-sm transition-colors"
        >
          Upgrade to Stampede Pro
        </button>
      </div>
    </div>
  )
}

// ── RankingList ───────────────────────────────────────────────
// Up/down arrow reorder list of songs in the voter's ballot.

function RankingList({
  songs,
  canRank,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  songs: (SongTally & { entryIdx: number; entryName: string })[]
  canRank: boolean
  onRemove: (song_id: string) => void
  onMoveUp: (idx: number) => void
  onMoveDown: (idx: number) => void
}) {
  return (
    <ul className="bg-stone-900 rounded-2xl border border-stone-700 overflow-hidden flex flex-col">
      {songs.map((song, index) => {
        const color   = ENTRY_COLORS[song.entryIdx % ENTRY_COLORS.length]
        const rank    = index + 1
        const isFirst = index === 0
        const isLast  = index === songs.length - 1

        return (
          <li
            key={song.song_id}
            className="flex items-center gap-3 px-3 py-3 border-b border-stone-800 last:border-b-0 bg-stone-900 hover:bg-stone-800/40 transition-colors"
          >
            {/* Up / down arrows */}
            {canRank ? (
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  type="button"
                  disabled={isFirst}
                  onClick={() => onMoveUp(index)}
                  className="p-0.5 rounded text-stone-600 hover:text-amber-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                  title="Move up"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={isLast}
                  onClick={() => onMoveDown(index)}
                  className="p-0.5 rounded text-stone-600 hover:text-amber-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                  title="Move down"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="w-5 shrink-0" />
            )}

            {/* Rank badge */}
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 tabular-nums ${
              rank === 1
                ? 'bg-amber-500 text-white'
                : rank === 2
                ? 'bg-stone-600 text-stone-200'
                : 'bg-stone-700 text-stone-500'
            }`}>
              {rank}
            </span>

            {/* Song icon */}
            <div className="w-8 h-8 rounded-lg bg-amber-950/20 flex items-center justify-center shrink-0">
              <Music className="w-3.5 h-3.5 text-amber-400" />
            </div>

            {/* Song info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{song.title}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-stone-500 truncate">{song.artist}</span>
                <span className={`text-xs px-1.5 py-0 rounded-full border font-medium ${color.badge}`}>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${color.dot}`} />
                  {song.entryName}
                </span>
              </div>
              {song.borda_score > 0 && (
                <div className="text-xs text-stone-600 mt-0.5 tabular-nums">
                  {song.borda_score.toFixed(0)} pts · {song.ranker_count} ranker{song.ranker_count !== 1 ? 's' : ''}
                </div>
              )}
            </div>

            {/* Remove button */}
            {canRank && (
              <button
                type="button"
                onClick={() => onRemove(song.song_id)}
                className="shrink-0 p-1.5 rounded-lg text-stone-600 hover:text-red-400 hover:bg-red-950/20 transition-colors"
                title="Remove from ranking"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// ── LiveTallies ───────────────────────────────────────────────

function LiveTallies({
  entries,
  totalBorda,
  totalRankers,
  leader,
}: {
  entries: EntryTally[]
  totalBorda: number
  totalRankers: number
  leader: EntryTally | undefined
}) {
  const tied = totalBorda === 0

  const leaderPct = leader && totalBorda > 0
    ? Math.round((leader.borda_score / totalBorda) * 100)
    : 50

  return (
    <div className="bg-stone-900 rounded-2xl border border-stone-700 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          Live Tallies
        </h2>
        <span className="text-xs text-stone-600">
          {totalRankers} ranker{totalRankers !== 1 ? 's' : ''} · {totalBorda.toFixed(0)} pts total
        </span>
      </div>

      {/* Tug-of-war bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-semibold text-stone-400 px-0.5">
          <span className="truncate max-w-[40%]">{entries[0]?.name ?? '—'}</span>
          <span className="truncate max-w-[40%] text-right">{entries[1]?.name ?? '—'}</span>
        </div>
        <div className="relative h-8 rounded-full bg-stone-800 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-amber-500 transition-all duration-700"
            style={{ width: tied ? '50%' : `${leaderPct}%` }}
          />
          <div
            className="absolute inset-y-0 right-0 bg-teal-400 transition-all duration-700"
            style={{ width: tied ? '50%' : `${100 - leaderPct}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-white drop-shadow-sm select-none">
              {tied ? 'TIED' : `${leaderPct}% — ${100 - leaderPct}%`}
            </span>
          </div>
        </div>
      </div>

      {/* Per-entry breakdown */}
      <div className="grid gap-3">
        {entries.map((entry, idx) => {
          const pct       = totalBorda > 0 ? Math.round((entry.borda_score / totalBorda) * 100) : 50
          const isLeading = entry.id === leader?.id && totalBorda > 0
          return (
            <div
              key={entry.id}
              className={`rounded-xl border p-4 ${isLeading ? 'border-amber-700 bg-amber-950/20' : 'border-stone-800 bg-stone-950'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {isLeading && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                  <span className="font-semibold text-stone-100 truncate text-sm">{entry.name}</span>
                </div>
                <span className={`text-lg font-bold tabular-nums ${isLeading ? 'text-amber-400' : 'text-stone-400'}`}>
                  {entry.borda_score.toFixed(0)}
                  <span className="text-xs font-normal text-stone-600 ml-1">pts</span>
                </span>
              </div>
              <div className="h-1.5 bg-stone-700 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${idx === 0 ? 'bg-amber-500' : 'bg-teal-400'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {/* Per-song scores */}
              {entry.songs.some((s) => s.borda_score > 0) && (
                <div className="space-y-1 pt-1">
                  {[...entry.songs]
                    .sort((a, b) => b.borda_score - a.borda_score)
                    .map((song) => {
                      const maxSong = Math.max(...entry.songs.map((s) => s.borda_score), 1)
                      return (
                        <div key={song.song_id} className="flex items-center gap-2 text-xs text-stone-500">
                          <span className="truncate flex-1 max-w-[50%]">{song.title}</span>
                          <div className="flex-1 h-1 bg-stone-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-600/60 rounded-full"
                              style={{ width: `${(song.borda_score / maxSong) * 100}%` }}
                            />
                          </div>
                          <span className="tabular-nums w-10 text-right text-stone-600">
                            {song.borda_score.toFixed(0)} pts
                          </span>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── SongLabelBadge ────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SongLabelBadge({ label }: { label: 'studio' | 'live' }) {
  if (label === 'live') {
    return <span className="text-xs px-1.5 py-0.5 rounded bg-red-900/30 text-red-400 font-medium">Live</span>
  }
  return <span className="text-xs px-1.5 py-0.5 rounded bg-stone-800 text-stone-500 font-medium">Studio</span>
}
