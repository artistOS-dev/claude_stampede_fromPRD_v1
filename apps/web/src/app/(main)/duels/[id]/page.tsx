'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Timer, CheckCircle2, Swords, Trophy } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────

interface Song {
  id: string
  title: string
  artist: string
  album: string | null
  cover_url: string | null
}

interface DuelDetail {
  id: string
  title: string
  description: string | null
  status: 'active' | 'closed'
  end_date: string
  winner_song_id: string | null
  is_expired: boolean
  song_left: Song | null
  song_right: Song | null
  tally: { left: number; right: number; total: number }
  my_vote: string | null
}

// ── Helpers ───────────────────────────────────────────────────

function getCountdown(endDate: string): string {
  const diff = new Date(endDate).getTime() - Date.now()
  if (diff <= 0) return 'Ended'
  const days  = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  const mins  = Math.floor((diff % 3_600_000) / 60_000)
  const secs  = Math.floor((diff % 60_000) / 1_000)
  if (days > 0)  return `${days}d ${hours}h remaining`
  if (hours > 0) return `${hours}h ${mins}m remaining`
  return `${mins}m ${secs}s`
}

// ── Swipe card ────────────────────────────────────────────────

function SwipeCard({
  duel,
  onVote,
  isVoting,
}: {
  duel: DuelDetail
  onVote: (songId: string) => void
  isVoting: boolean
}) {
  const cardRef   = useRef<HTMLDivElement>(null)
  const startX    = useRef(0)
  const startY    = useRef(0)
  const [dragX, setDragX]       = useState(0)
  const [dragging, setDragging] = useState(false)
  const [hint, setHint]         = useState<'left' | 'right' | null>(null)

  const THRESHOLD = 80  // px needed to trigger a vote

  const onPointerDown = (e: React.PointerEvent) => {
    if (isVoting) return
    startX.current = e.clientX
    startY.current = e.clientY
    setDragging(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return
    const dx = e.clientX - startX.current
    const dy = e.clientY - startY.current
    // Only activate horizontal drag if x-movement dominates
    if (Math.abs(dx) < Math.abs(dy) && Math.abs(dx) < 10) return
    setDragX(dx)
    setHint(dx > 20 ? 'left' : dx < -20 ? 'right' : null)
  }

  const onPointerUp = () => {
    if (!dragging) return
    setDragging(false)
    const dx = dragX
    setDragX(0)
    setHint(null)
    if (dx >  THRESHOLD && duel.song_left)  onVote(duel.song_left.id)
    if (dx < -THRESHOLD && duel.song_right) onVote(duel.song_right.id)
  }

  const rotate = dragging ? Math.min(Math.max(dragX / 15, -12), 12) : 0
  const opacity = dragging ? Math.max(1 - Math.abs(dragX) / 300, 0.6) : 1

  return (
    <div className="relative select-none touch-pan-y">
      {/* Direction hints */}
      <div className={`absolute inset-y-0 left-0 w-24 flex items-center justify-center pointer-events-none z-10 transition-opacity duration-150 ${hint === 'left' ? 'opacity-100' : 'opacity-0'}`}>
        <div className="bg-amber-500/90 text-white font-bold text-sm px-3 py-1.5 rounded-full shadow-lg">
          ← {duel.song_left?.title?.split(' ').slice(0, 2).join(' ')}
        </div>
      </div>
      <div className={`absolute inset-y-0 right-0 w-24 flex items-center justify-center pointer-events-none z-10 transition-opacity duration-150 ${hint === 'right' ? 'opacity-100' : 'opacity-0'}`}>
        <div className="bg-teal-500/90 text-white font-bold text-sm px-3 py-1.5 rounded-full shadow-lg">
          {duel.song_right?.title?.split(' ').slice(0, 2).join(' ')} →
        </div>
      </div>

      {/* Draggable card */}
      <div
        ref={cardRef}
        className="cursor-grab active:cursor-grabbing"
        style={{
          transform: `translateX(${dragX}px) rotate(${rotate}deg)`,
          opacity,
          transition: dragging ? 'none' : 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="bg-stone-900 border border-stone-700 rounded-2xl overflow-hidden shadow-2xl">
          <div className="grid grid-cols-[1fr_auto_1fr]">
            {/* Left song */}
            <div className={`p-5 flex flex-col items-center text-center gap-2 border-r border-stone-700 transition-colors ${hint === 'left' ? 'bg-amber-950/30' : ''}`}>
              <div className="w-16 h-16 rounded-xl bg-amber-900/20 border border-amber-800/30 flex items-center justify-center">
                <span className="text-3xl">🎵</span>
              </div>
              <div>
                <p className="font-bold text-white text-sm leading-snug">{duel.song_left?.title}</p>
                <p className="text-xs text-stone-500 mt-0.5">{duel.song_left?.artist}</p>
                {duel.song_left?.album && (
                  <p className="text-xs text-stone-700 mt-0.5 italic">{duel.song_left.album}</p>
                )}
              </div>
            </div>

            {/* VS */}
            <div className="flex items-center justify-center px-3 bg-stone-950/50">
              <div className="flex flex-col items-center gap-1">
                <Swords className="w-5 h-5 text-amber-500" />
                <span className="text-xs font-bold text-stone-600">VS</span>
              </div>
            </div>

            {/* Right song */}
            <div className={`p-5 flex flex-col items-center text-center gap-2 border-l border-stone-700 transition-colors ${hint === 'right' ? 'bg-teal-950/30' : ''}`}>
              <div className="w-16 h-16 rounded-xl bg-teal-900/20 border border-teal-800/30 flex items-center justify-center">
                <span className="text-3xl">🎵</span>
              </div>
              <div>
                <p className="font-bold text-white text-sm leading-snug">{duel.song_right?.title}</p>
                <p className="text-xs text-stone-500 mt-0.5">{duel.song_right?.artist}</p>
                {duel.song_right?.album && (
                  <p className="text-xs text-stone-700 mt-0.5 italic">{duel.song_right.album}</p>
                )}
              </div>
            </div>
          </div>

          {/* Drag hint strip */}
          <div className="px-5 py-3 bg-stone-950/50 flex items-center justify-between text-xs text-stone-600 border-t border-stone-800">
            <span>← swipe left to vote</span>
            <span>swipe right to vote →</span>
          </div>
        </div>
      </div>

      {/* Tap buttons fallback */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <button
          type="button"
          disabled={isVoting}
          onClick={() => duel.song_left && onVote(duel.song_left.id)}
          className="py-3 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white font-semibold text-sm transition-colors"
        >
          Vote ← {duel.song_left?.title?.split(' ').slice(0, 2).join(' ')}
        </button>
        <button
          type="button"
          disabled={isVoting}
          onClick={() => duel.song_right && onVote(duel.song_right.id)}
          className="py-3 rounded-xl bg-teal-700 hover:bg-teal-600 disabled:opacity-40 text-white font-semibold text-sm transition-colors"
        >
          Vote {duel.song_right?.title?.split(' ').slice(0, 2).join(' ')} →
        </button>
      </div>
    </div>
  )
}

// ── Results view ─────────────────────────────────────────────

function ResultsView({ duel }: { duel: DuelDetail }) {
  const { left, right, total } = duel.tally
  const leftPct  = total > 0 ? Math.round((left  / total) * 100) : 50
  const rightPct = total > 0 ? Math.round((right / total) * 100) : 50
  const winnerIsLeft  = duel.winner_song_id === duel.song_left?.id
  const winnerIsRight = duel.winner_song_id === duel.song_right?.id
  const myVoteLeft  = duel.my_vote === duel.song_left?.id
  const myVoteRight = duel.my_vote === duel.song_right?.id

  return (
    <div className="space-y-4">
      {/* Winner banner */}
      {duel.winner_song_id && (
        <div className="flex items-center gap-3 bg-yellow-950/20 border border-yellow-700/60 rounded-2xl px-5 py-4">
          <Trophy className="w-6 h-6 text-yellow-400 shrink-0" />
          <div>
            <p className="text-xs text-yellow-600 font-medium uppercase tracking-wide">Winner</p>
            <p className="font-bold text-yellow-300 text-lg">
              {winnerIsLeft ? duel.song_left?.title : duel.song_right?.title}
            </p>
            <p className="text-xs text-yellow-700">
              {winnerIsLeft ? duel.song_left?.artist : duel.song_right?.artist}
            </p>
          </div>
        </div>
      )}

      {/* Tally bars */}
      <div className="bg-stone-900 border border-stone-700 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white">Final Results</h3>
          <span className="text-xs text-stone-500">{total} vote{total !== 1 ? 's' : ''}</span>
        </div>

        {/* Tug-of-war bar */}
        <div>
          <div className="flex justify-between text-xs font-semibold text-stone-400 px-0.5 mb-1.5">
            <span className="truncate max-w-[40%]">{duel.song_left?.title}</span>
            <span className="truncate max-w-[40%] text-right">{duel.song_right?.title}</span>
          </div>
          <div className="relative h-8 rounded-full bg-stone-800 overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-amber-500 transition-all duration-700"
              style={{ width: `${leftPct}%` }} />
            <div className="absolute inset-y-0 right-0 bg-teal-400 transition-all duration-700"
              style={{ width: `${rightPct}%` }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-white drop-shadow-sm">
                {leftPct}% — {rightPct}%
              </span>
            </div>
          </div>
        </div>

        {/* Per-song rows */}
        {[
          { song: duel.song_left,  votes: left,  pct: leftPct,  isWinner: winnerIsLeft,  myVote: myVoteLeft,  color: 'bg-amber-500' },
          { song: duel.song_right, votes: right, pct: rightPct, isWinner: winnerIsRight, myVote: myVoteRight, color: 'bg-teal-400' },
        ].map(({ song, votes, pct, isWinner, myVote, color }) => (
          <div key={song?.id} className={`rounded-xl border p-4 ${isWinner ? 'border-yellow-700 bg-yellow-950/10' : 'border-stone-800 bg-stone-950'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                {isWinner && <Trophy className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                {myVote && !isWinner && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                <span className="font-semibold text-stone-100 truncate text-sm">{song?.title}</span>
                {myVote && <span className="text-xs text-stone-500">(your pick)</span>}
              </div>
              <span className={`text-lg font-bold tabular-nums ${isWinner ? 'text-yellow-400' : 'text-stone-400'}`}>
                {pct}%
                <span className="text-xs font-normal text-stone-600 ml-1">({votes})</span>
              </span>
            </div>
            <div className="h-1.5 bg-stone-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────

export default function DuelPage() {
  const { id }  = useParams<{ id: string }>()
  const router  = useRouter()

  const [duel, setDuel]         = useState<DuelDetail | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [fetchError, setError]  = useState<string | null>(null)
  const [isVoting, setVoting]   = useState(false)
  const [voteError, setVoteErr] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<string | null>(null)

  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/duels/${id}`)
      if (!res.ok) { setError('Duel not found.'); setLoading(false); return }
      const json: { duel: DuelDetail } = await res.json()
      setDuel(json.duel)
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => {
    load()
    pollRef.current = setInterval(load, 15_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [load])

  useEffect(() => {
    if (!duel?.end_date) return
    const tick = () => setCountdown(getCountdown(duel.end_date))
    tick()
    countdownRef.current = setInterval(tick, 1_000)
    return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
  }, [duel?.end_date])

  const handleVote = useCallback(async (chosenSongId: string) => {
    if (!duel || isVoting) return
    setVoting(true)
    setVoteErr(null)
    try {
      const res = await fetch(`/api/duels/${id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chosen_song_id: chosenSongId }),
      })
      const json: { error?: string } = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Vote failed')
      // Optimistic update then reload for real tally
      setDuel((prev) => prev ? { ...prev, my_vote: chosenSongId } : prev)
      await load()
    } catch (err) {
      setVoteErr(err instanceof Error ? err.message : 'Vote failed')
    } finally { setVoting(false) }
  }, [duel, id, isVoting, load])

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (fetchError || !duel) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-200">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="bg-red-950/30 border border-red-800 rounded-xl p-6 text-center text-red-400">
          {fetchError ?? 'Duel not found.'}
        </div>
      </div>
    )
  }

  const isOpen   = duel.status === 'active' && !duel.is_expired
  const isClosed = duel.status === 'closed' || duel.is_expired
  const hasVoted = !!duel.my_vote

  return (
    <div className="max-w-lg mx-auto space-y-5 pb-20">
      {/* Back */}
      <button type="button" onClick={() => router.push('/duels')}
        className="flex items-center gap-2 text-sm text-stone-500 hover:text-amber-400 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        All Duels
      </button>

      {/* Header */}
      <div className="bg-gradient-to-br from-amber-900 via-stone-800 to-stone-900 rounded-2xl p-6 border border-amber-800/40 shadow-lg">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-green-400 animate-pulse' : 'bg-stone-500'}`} />
              <span className="text-xs font-medium text-amber-200/70 uppercase tracking-wide">
                {isOpen ? 'Voting Live' : 'Voting Closed'}
              </span>
              {hasVoted && (
                <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
                  <CheckCircle2 className="w-3 h-3" /> Voted
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold font-display text-amber-100">{duel.title}</h1>
            {duel.description && (
              <p className="text-sm text-amber-200/60 mt-1">{duel.description}</p>
            )}
          </div>
          {countdown && isOpen && (
            <div className="flex items-center gap-2 bg-stone-900/40 rounded-xl px-3 py-2 shrink-0">
              <Timer className="w-4 h-4 text-amber-300" />
              <span className="text-sm font-bold tabular-nums text-amber-100">{countdown}</span>
            </div>
          )}
        </div>
      </div>

      {/* Voting UI or results */}
      {isOpen && !hasVoted ? (
        <>
          <SwipeCard duel={duel} onVote={handleVote} isVoting={isVoting} />
          {isVoting && (
            <p className="text-center text-sm text-amber-400 animate-pulse">Submitting vote…</p>
          )}
          {voteError && (
            <p className="text-center text-sm text-red-400">{voteError}</p>
          )}
        </>
      ) : (
        <>
          {/* Voted confirmation when still open */}
          {isOpen && hasVoted && (
            <div className="flex items-center gap-3 bg-green-950/20 border border-green-800/50 rounded-2xl px-5 py-4">
              <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
              <div>
                <p className="font-semibold text-green-300 text-sm">Your vote is in!</p>
                <p className="text-xs text-green-700 mt-0.5">
                  You voted for{' '}
                  <span className="font-medium">
                    {duel.my_vote === duel.song_left?.id ? duel.song_left?.title : duel.song_right?.title}
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Closed banner */}
          {isClosed && !duel.winner_song_id && (
            <div className="flex items-center gap-3 bg-stone-900 border border-stone-700 rounded-2xl px-5 py-4">
              <Swords className="w-5 h-5 text-stone-500 shrink-0" />
              <p className="text-sm text-stone-400">This duel has ended. Results below.</p>
            </div>
          )}

          <ResultsView duel={duel} />
        </>
      )}
    </div>
  )
}
