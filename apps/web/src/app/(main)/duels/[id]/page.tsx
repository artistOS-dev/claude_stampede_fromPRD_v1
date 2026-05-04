'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Timer, CheckCircle2, Swords, Trophy, Music, ChevronRight, RotateCcw } from 'lucide-react'

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

// ── Song vote card ─────────────────────────────────────────────

function SongCard({
  song,
  accent,
  isVoting,
  isPending,
  onClick,
}: {
  song: Song | null
  accent: 'amber' | 'teal'
  isVoting: boolean
  isPending: boolean
  onClick: () => void
}) {
  const a = accent === 'amber'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isVoting}
      className={`group w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-150
        active:scale-[0.98] disabled:cursor-not-allowed
        ${a
          ? 'border-stone-700 bg-stone-900 hover:border-amber-600 hover:bg-amber-950/20'
          : 'border-stone-700 bg-stone-900 hover:border-teal-600  hover:bg-teal-950/20'
        }`}
    >
      {/* Cover art */}
      {song?.cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={song.cover_url} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
      ) : (
        <div className={`w-16 h-16 rounded-xl flex items-center justify-center shrink-0
          ${a ? 'bg-amber-950/30 border border-amber-800/30' : 'bg-teal-950/30 border border-teal-800/30'}`}>
          <Music className={`w-7 h-7 ${a ? 'text-amber-600' : 'text-teal-600'}`} />
        </div>
      )}

      {/* Song info */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-white truncate text-base leading-snug">{song?.title}</p>
        <p className="text-sm text-stone-400 truncate mt-0.5">{song?.artist}</p>
        {song?.album && (
          <p className="text-xs text-stone-600 truncate mt-0.5 italic">{song.album}</p>
        )}
      </div>

      {/* CTA arrow / spinner */}
      <div className="shrink-0">
        {isPending ? (
          <div className={`w-9 h-9 rounded-full border-2 border-t-transparent animate-spin
            ${a ? 'border-amber-500' : 'border-teal-500'}`} />
        ) : (
          <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-colors
            ${a
              ? 'border-amber-800 text-amber-700 group-hover:bg-amber-600 group-hover:border-amber-600 group-hover:text-white'
              : 'border-teal-800  text-teal-700  group-hover:bg-teal-600  group-hover:border-teal-600  group-hover:text-white'
            }`}>
            <ChevronRight className="w-5 h-5" />
          </div>
        )}
      </div>
    </button>
  )
}

// ── Voting panel ──────────────────────────────────────────────

function VotingPanel({
  duel,
  onVote,
  isVoting,
}: {
  duel: DuelDetail
  onVote: (songId: string) => void
  isVoting: boolean
}) {
  const [pendingId, setPendingId] = useState<string | null>(null)

  const vote = useCallback((songId: string) => {
    setPendingId(songId)
    onVote(songId)
  }, [onVote])

  return (
    <div className="space-y-3">
      <p className="text-center text-xs text-stone-500 uppercase tracking-widest font-semibold">
        Tap to cast your vote
      </p>

      <SongCard
        song={duel.song_left}
        accent="amber"
        isVoting={isVoting}
        isPending={pendingId === duel.song_left?.id && isVoting}
        onClick={() => duel.song_left && vote(duel.song_left.id)}
      />

      {/* VS divider */}
      <div className="flex items-center gap-3 py-0.5">
        <div className="flex-1 h-px bg-stone-800" />
        <div className="flex items-center gap-1.5">
          <Swords className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-black text-stone-500 tracking-widest">VS</span>
        </div>
        <div className="flex-1 h-px bg-stone-800" />
      </div>

      <SongCard
        song={duel.song_right}
        accent="teal"
        isVoting={isVoting}
        isPending={pendingId === duel.song_right?.id && isVoting}
        onClick={() => duel.song_right && vote(duel.song_right.id)}
      />
    </div>
  )
}

// ── Results view ──────────────────────────────────────────────

function ResultsView({
  duel,
  canChange,
  onChangeVote,
}: {
  duel: DuelDetail
  canChange: boolean
  onChangeVote: () => void
}) {
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

      {/* Voted confirmation */}
      {duel.my_vote && (
        <div className="flex items-center justify-between gap-3 bg-green-950/20 border border-green-800/50 rounded-2xl px-5 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
            <p className="text-sm text-green-300">
              You voted for{' '}
              <span className="font-semibold">
                {myVoteLeft ? duel.song_left?.title : duel.song_right?.title}
              </span>
            </p>
          </div>
          {canChange && (
            <button
              type="button"
              onClick={onChangeVote}
              className="shrink-0 flex items-center gap-1 text-xs text-stone-500 hover:text-stone-300 transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Change
            </button>
          )}
        </div>
      )}

      {/* Tug-of-war bar */}
      <div className="bg-stone-900 border border-stone-700 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-sm">Results</h3>
          <span className="text-xs text-stone-500">{total} vote{total !== 1 ? 's' : ''}</span>
        </div>

        <div>
          <div className="flex justify-between text-xs font-semibold text-stone-400 mb-1.5 px-0.5">
            <span className="truncate max-w-[42%]">{duel.song_left?.title}</span>
            <span className="truncate max-w-[42%] text-right">{duel.song_right?.title}</span>
          </div>
          <div className="relative h-8 rounded-full bg-stone-800 overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-amber-500 transition-all duration-700"
              style={{ width: `${leftPct}%` }} />
            <div className="absolute inset-y-0 right-0 bg-teal-400 transition-all duration-700"
              style={{ width: `${rightPct}%` }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-white drop-shadow">
                {leftPct}% — {rightPct}%
              </span>
            </div>
          </div>
        </div>

        {[
          { song: duel.song_left,  votes: left,  pct: leftPct,  isWinner: winnerIsLeft,  myVote: myVoteLeft,  color: 'bg-amber-500' },
          { song: duel.song_right, votes: right, pct: rightPct, isWinner: winnerIsRight, myVote: myVoteRight, color: 'bg-teal-400'  },
        ].map(({ song, votes, pct, isWinner, myVote, color }) => (
          <div key={song?.id}
            className={`rounded-xl border p-4 ${isWinner ? 'border-yellow-700 bg-yellow-950/10' : 'border-stone-800 bg-stone-950'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                {isWinner && <Trophy className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                {myVote && !isWinner && <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />}
                <span className="font-semibold text-stone-100 truncate text-sm">{song?.title}</span>
                {myVote && <span className="text-xs text-stone-500 shrink-0">(your pick)</span>}
              </div>
              <span className={`text-lg font-bold tabular-nums shrink-0 ${isWinner ? 'text-yellow-400' : 'text-stone-400'}`}>
                {pct}%
                <span className="text-xs font-normal text-stone-600 ml-1">({votes})</span>
              </span>
            </div>
            <div className="h-1.5 bg-stone-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${color}`}
                style={{ width: `${pct}%` }} />
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

  const [duel, setDuel]           = useState<DuelDetail | null>(null)
  const [isLoading, setLoading]   = useState(true)
  const [fetchError, setError]    = useState<string | null>(null)
  const [isVoting, setVoting]     = useState(false)
  const [voteError, setVoteErr]   = useState<string | null>(null)
  const [countdown, setCountdown] = useState<string | null>(null)
  const [changingVote, setChangingVote] = useState(false)

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
      setDuel((prev) => prev ? { ...prev, my_vote: chosenSongId } : prev)
      setChangingVote(false)
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
  const showVoting = isOpen && (!hasVoted || changingVote)

  return (
    <div className="max-w-lg mx-auto space-y-5 pb-20">
      {/* Back */}
      <button type="button" onClick={() => router.push('/duels')}
        className="flex items-center gap-2 text-sm text-stone-500 hover:text-amber-400 transition-colors">
        <ArrowLeft className="w-4 h-4" /> All Duels
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
              {hasVoted && !changingVote && (
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

      {/* Closed banner */}
      {isClosed && !duel.winner_song_id && (
        <div className="flex items-center gap-3 bg-stone-900 border border-stone-700 rounded-2xl px-5 py-4">
          <Swords className="w-5 h-5 text-stone-500 shrink-0" />
          <p className="text-sm text-stone-400">This duel has ended. Results below.</p>
        </div>
      )}

      {/* Voting cards or results */}
      {showVoting ? (
        <>
          <VotingPanel duel={duel} onVote={handleVote} isVoting={isVoting} />
          {voteError && (
            <p className="text-center text-sm text-red-400">{voteError}</p>
          )}
        </>
      ) : (
        <ResultsView
          duel={duel}
          canChange={isOpen && hasVoted}
          onChangeVote={() => setChangingVote(true)}
        />
      )}
    </div>
  )
}
