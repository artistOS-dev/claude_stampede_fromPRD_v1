'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Timer, CheckCircle2, Swords, Trophy, Music, ChevronRight, RotateCcw, Star } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────

interface Song {
  id: string
  title: string
  artist: string
  album: string | null
  cover_url: string | null
  avg_rating: number | null
  rating_count: number
}

interface ShowdownDetail {
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
  my_ratings: Record<string, number>
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

// ── Rating badge ──────────────────────────────────────────────

function RatingBadge({ myRating, avgRating, ratingCount }: {
  myRating?: number | null
  avgRating?: number | null
  ratingCount?: number
}) {
  if (myRating) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 mt-1">
        <Star className="w-3 h-3 fill-amber-400 text-amber-400" aria-hidden="true" />
        {myRating}/5
        <span className="text-amber-600 font-normal">your rating</span>
      </span>
    )
  }
  if (avgRating && avgRating > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-400 mt-1">
        <Star className="w-3 h-3 fill-stone-500 text-stone-500" aria-hidden="true" />
        {Number(avgRating).toFixed(1)}/5
        <span className="text-stone-600 font-normal">avg{ratingCount ? ` · ${ratingCount}` : ''}</span>
      </span>
    )
  }
  return null
}

// ── Song vote card ─────────────────────────────────────────────

function SongCard({
  song,
  myRating,
  accent,
  isVoting,
  isPending,
  onClick,
}: {
  song: Song | null
  myRating?: number | null
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
      {song?.cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={song.cover_url} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
      ) : (
        <div className={`w-16 h-16 rounded-xl flex items-center justify-center shrink-0
          ${a ? 'bg-amber-950/30 border border-amber-800/30' : 'bg-teal-950/30 border border-teal-800/30'}`}>
          <Music className={`w-7 h-7 ${a ? 'text-amber-600' : 'text-teal-600'}`} />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="font-bold text-white truncate text-base leading-snug">{song?.title}</p>
        <p className="text-sm text-stone-400 truncate mt-0.5">{song?.artist}</p>
        {song?.album && (
          <p className="text-xs text-stone-600 truncate mt-0.5 italic">{song.album}</p>
        )}
        <RatingBadge
          myRating={myRating}
          avgRating={song?.avg_rating}
          ratingCount={song?.rating_count}
        />
      </div>

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
  showdown,
  onVote,
  isVoting,
}: {
  showdown: ShowdownDetail
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
        song={showdown.song_left}
        myRating={showdown.song_left ? (showdown.my_ratings[showdown.song_left.id] ?? null) : null}
        accent="amber"
        isVoting={isVoting}
        isPending={pendingId === showdown.song_left?.id && isVoting}
        onClick={() => showdown.song_left && vote(showdown.song_left.id)}
      />

      <div className="flex items-center gap-3 py-0.5">
        <div className="flex-1 h-px bg-stone-800" />
        <div className="flex items-center gap-1.5">
          <Swords className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-black text-stone-500 tracking-widest">VS</span>
        </div>
        <div className="flex-1 h-px bg-stone-800" />
      </div>

      <SongCard
        song={showdown.song_right}
        myRating={showdown.song_right ? (showdown.my_ratings[showdown.song_right.id] ?? null) : null}
        accent="teal"
        isVoting={isVoting}
        isPending={pendingId === showdown.song_right?.id && isVoting}
        onClick={() => showdown.song_right && vote(showdown.song_right.id)}
      />
    </div>
  )
}

// ── Results view ──────────────────────────────────────────────

function ResultsView({
  showdown,
  canChange,
  onChangeVote,
}: {
  showdown: ShowdownDetail
  canChange: boolean
  onChangeVote: () => void
}) {
  const { left, right, total } = showdown.tally
  const leftPct  = total > 0 ? Math.round((left  / total) * 100) : 50
  const rightPct = total > 0 ? Math.round((right / total) * 100) : 50
  const winnerIsLeft  = showdown.winner_song_id === showdown.song_left?.id
  const winnerIsRight = showdown.winner_song_id === showdown.song_right?.id
  const myVoteLeft    = showdown.my_vote === showdown.song_left?.id
  const myVoteRight   = showdown.my_vote === showdown.song_right?.id
  const myRatings     = showdown.my_ratings ?? {}

  return (
    <div className="space-y-4">
      {showdown.winner_song_id && (
        <div className="flex items-center gap-3 bg-yellow-950/20 border border-yellow-700/60 rounded-2xl px-5 py-4">
          <Trophy className="w-6 h-6 text-yellow-400 shrink-0" />
          <div>
            <p className="text-xs text-yellow-600 font-medium uppercase tracking-wide">Winner</p>
            <p className="font-bold text-yellow-300 text-lg">
              {winnerIsLeft ? showdown.song_left?.title : showdown.song_right?.title}
            </p>
            <p className="text-xs text-yellow-700">
              {winnerIsLeft ? showdown.song_left?.artist : showdown.song_right?.artist}
            </p>
          </div>
        </div>
      )}

      {showdown.my_vote && (
        <div className="flex items-center justify-between gap-3 bg-green-950/20 border border-green-800/50 rounded-2xl px-5 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
            <p className="text-sm text-green-300">
              You voted for{' '}
              <span className="font-semibold">
                {myVoteLeft ? showdown.song_left?.title : showdown.song_right?.title}
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

      <div className="bg-stone-900 border border-stone-700 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-sm">Results</h3>
          <span className="text-xs text-stone-500">{total} vote{total !== 1 ? 's' : ''}</span>
        </div>

        <div>
          <div className="flex justify-between text-xs font-semibold text-stone-400 mb-1.5 px-0.5">
            <span className="truncate max-w-[42%]">{showdown.song_left?.title}</span>
            <span className="truncate max-w-[42%] text-right">{showdown.song_right?.title}</span>
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
          { song: showdown.song_left,  votes: left,  pct: leftPct,  isWinner: winnerIsLeft,  myVote: myVoteLeft,  color: 'bg-amber-500' },
          { song: showdown.song_right, votes: right, pct: rightPct, isWinner: winnerIsRight, myVote: myVoteRight, color: 'bg-teal-400'  },
        ].map(({ song, votes, pct, isWinner, myVote, color }) => (
          <div key={song?.id}
            className={`rounded-xl border p-4 ${isWinner ? 'border-yellow-700 bg-yellow-950/10' : 'border-stone-800 bg-stone-950'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {isWinner && <Trophy className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                  {myVote && !isWinner && <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />}
                  <span className="font-semibold text-stone-100 truncate text-sm">{song?.title}</span>
                  {myVote && <span className="text-xs text-stone-500 shrink-0">(your pick)</span>}
                </div>
                {song && (
                  <RatingBadge
                    myRating={myRatings[song.id] ?? null}
                    avgRating={song.avg_rating}
                    ratingCount={song.rating_count}
                  />
                )}
              </div>
              <span className={`text-lg font-bold tabular-nums shrink-0 ml-3 ${isWinner ? 'text-yellow-400' : 'text-stone-400'}`}>
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

export default function ShowdownDetailPage() {
  const { id }  = useParams<{ id: string }>()
  const router  = useRouter()

  const [showdown, setShowdown]     = useState<ShowdownDetail | null>(null)
  const [isLoading, setLoading]     = useState(true)
  const [fetchError, setError]      = useState<string | null>(null)
  const [isVoting, setVoting]       = useState(false)
  const [voteError, setVoteErr]     = useState<string | null>(null)
  const [countdown, setCountdown]   = useState<string | null>(null)
  const [changingVote, setChangingVote] = useState(false)

  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/showdown/${id}`)
      if (!res.ok) { setError('Showdown not found.'); setLoading(false); return }
      const json: { showdown: ShowdownDetail } = await res.json()
      setShowdown(json.showdown)
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => {
    load()
    pollRef.current = setInterval(load, 15_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [load])

  useEffect(() => {
    if (!showdown?.end_date) return
    const tick = () => setCountdown(getCountdown(showdown.end_date))
    tick()
    countdownRef.current = setInterval(tick, 1_000)
    return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
  }, [showdown?.end_date])

  const handleVote = useCallback(async (chosenSongId: string) => {
    if (!showdown || isVoting) return
    setVoting(true)
    setVoteErr(null)
    try {
      const res = await fetch(`/api/showdown/${id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chosen_song_id: chosenSongId }),
      })
      const json: { error?: string } = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Vote failed')
      setShowdown((prev) => prev ? { ...prev, my_vote: chosenSongId } : prev)
      setChangingVote(false)
      await load()
    } catch (err) {
      setVoteErr(err instanceof Error ? err.message : 'Vote failed')
    } finally { setVoting(false) }
  }, [showdown, id, isVoting, load])

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (fetchError || !showdown) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-200">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="bg-red-950/30 border border-red-800 rounded-xl p-6 text-center text-red-400">
          {fetchError ?? 'Showdown not found.'}
        </div>
      </div>
    )
  }

  const isOpen   = showdown.status === 'active' && !showdown.is_expired
  const isClosed = showdown.status === 'closed' || showdown.is_expired
  const hasVoted = !!showdown.my_vote
  const showVoting = isOpen && (!hasVoted || changingVote)

  return (
    <div className="max-w-lg mx-auto space-y-5 pb-20">
      <button type="button" onClick={() => router.push('/showdown')}
        className="flex items-center gap-2 text-sm text-stone-500 hover:text-amber-400 transition-colors">
        <ArrowLeft className="w-4 h-4" /> All Showdowns
      </button>

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
            <h1 className="text-xl font-bold font-display text-amber-100">{showdown.title}</h1>
            {showdown.description && (
              <p className="text-sm text-amber-200/60 mt-1">{showdown.description}</p>
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

      {isClosed && !showdown.winner_song_id && (
        <div className="flex items-center gap-3 bg-stone-900 border border-stone-700 rounded-2xl px-5 py-4">
          <Swords className="w-5 h-5 text-stone-500 shrink-0" />
          <p className="text-sm text-stone-400">This showdown has ended. Results below.</p>
        </div>
      )}

      {showVoting ? (
        <>
          <VotingPanel showdown={showdown} onVote={handleVote} isVoting={isVoting} />
          {voteError && (
            <p className="text-center text-sm text-red-400">{voteError}</p>
          )}
        </>
      ) : (
        <ResultsView
          showdown={showdown}
          canChange={isOpen && hasVoted}
          onChangeVote={() => setChangingVote(true)}
        />
      )}
    </div>
  )
}
