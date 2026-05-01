'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Timer,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Music,
  ChevronUp,
  ChevronDown,
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
      // Seed on first load: start from existing ranking, append any unranked songs
      if (!initialised.current) {
        const interleaved: string[] = []
        const maxLen = Math.max(...json.entries.map((e) => e.songs.length), 0)
        for (let i = 0; i < maxLen; i++) {
          for (const entry of json.entries) {
            if (entry.songs[i]) interleaved.push(entry.songs[i].song_id)
          }
        }
        const prev = json.my_ranking ?? []
        const full = [...prev, ...interleaved.filter((id) => !prev.includes(id))]
        setRankedIds(full)
        if (prev.length > 0) setSubmitted(true)
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

  const isExpired = meta?.end_date ? new Date(meta.end_date).getTime() < Date.now() : false
  const isOpen    = meta?.status === 'voting' && !isExpired
  const canRank   = isOpen

  // Flat song map for quick lookup
  const songMap = new Map<string, SongTally>()
  tally.entries.forEach((entry) => {
    entry.songs.forEach((song) => songMap.set(song.song_id, song))
  })

  const totalSongs  = tally.entries.reduce((n, e) => n + e.songs.length, 0)
  const rankedSongs = rankedIds.map((id) => songMap.get(id)).filter(Boolean) as SongTally[]
  const allRanked   = rankedIds.length >= totalSongs

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-20">

      {/* Back */}
      <BackButton onClick={() => router.push(`/rodeos/${id}`)} label="Back to Rodeo" />

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-amber-900 via-stone-800 to-stone-900 rounded-2xl p-6 border border-amber-800/40 shadow-lg">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-green-300 animate-pulse' : isExpired ? 'bg-red-500' : 'bg-stone-500'}`} />
              <span className="text-xs font-medium text-amber-200/80 uppercase tracking-wide">
                {isOpen ? 'Ranking Live' : isExpired ? 'Deadline Passed' : 'Ranking Closed'}
              </span>
            </div>
            <h1 className="text-xl font-bold font-display leading-tight text-amber-100">
              {meta?.title ?? 'Rodeo'}
            </h1>
          </div>
          {countdown && (
            <div className={`flex items-center gap-2 backdrop-blur rounded-xl px-4 py-2 shrink-0 ${isExpired ? 'bg-red-950/40' : 'bg-stone-900/30'}`}>
              <Timer className={`w-4 h-4 ${isExpired ? 'text-red-400' : 'text-amber-200'}`} />
              <span className={`text-sm font-bold tabular-nums ${isExpired ? 'text-red-300' : 'text-amber-100'}`}>{countdown}</span>
            </div>
          )}
        </div>
        {isExpired ? (
          <p className="mt-3 text-xs text-red-300/80 leading-relaxed">
            The voting deadline has passed. No new rankings can be submitted.
          </p>
        ) : (
          <p className="mt-3 text-xs text-amber-200/60 leading-relaxed">
            Use the arrows to order all {totalSongs} songs from favourite to least favourite, then submit.
          </p>
        )}
      </div>


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
        <h2 className="font-bold text-white flex items-center gap-2">
          <Music className="w-4 h-4 text-amber-400" />
          Your Ranking
          <span className="text-xs font-normal text-stone-500">{rankedIds.length} of {totalSongs} songs</span>
        </h2>
        <RankingList
          songs={rankedSongs}
          canRank={canRank}
          onMoveUp={moveUp}
          onMoveDown={moveDown}
        />
      </div>

      {/* ── Submit button ────────────────────────────────────── */}
      {canRank && (
        <div className="space-y-2">
          {!allRanked && (
            <p className="text-xs text-center text-stone-500">
              Rank all {totalSongs} songs to submit
            </p>
          )}
          <button
            type="button"
            onClick={submitRanking}
            disabled={isSubmitting || !allRanked}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all
              bg-amber-500 text-white hover:bg-amber-600 active:scale-95
              disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {isSubmitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
              : <><Send className="w-4 h-4" /> {submitted ? 'Update Ranking' : 'Submit Ranking'}</>
            }
          </button>
        </div>
      )}

      {/* ── Not ranked pool ─────────────────────────────────── */}
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

// ── RankingList ───────────────────────────────────────────────
// Up/down arrow reorder list of songs in the voter's ballot.

function RankingList({
  songs,
  canRank,
  onMoveUp,
  onMoveDown,
}: {
  songs: SongTally[]
  canRank: boolean
  onMoveUp: (idx: number) => void
  onMoveDown: (idx: number) => void
}) {
  return (
    <ul className="bg-stone-900 rounded-2xl border border-stone-700 overflow-hidden flex flex-col">
      {songs.map((song, index) => {
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
              <div className="mt-0.5">
                <span className="text-xs text-stone-500 truncate">{song.artist}</span>
              </div>
              {song.borda_score > 0 && (
                <div className="text-xs text-stone-600 mt-0.5 tabular-nums">
                  {song.borda_score.toFixed(0)} pts · {song.ranker_count} ranker{song.ranker_count !== 1 ? 's' : ''}
                </div>
              )}
            </div>

          </li>
        )
      })}
    </ul>
  )
}

