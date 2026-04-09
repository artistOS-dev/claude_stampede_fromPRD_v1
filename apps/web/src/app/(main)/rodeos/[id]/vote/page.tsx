'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Timer,
  Star,
  CheckCircle2,
  Lock,
  Loader2,
  AlertCircle,
  Coins,
  Zap,
  Users,
  Music,
  Crown,
  ChevronRight,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────

interface SongTally {
  song_id: string
  entry_id: string
  title: string
  artist: string
  label: 'studio' | 'live' | null
  locked: boolean
  circle_member_votes: number
  general_public_votes: number
  total_votes: number
  weighted_score: number
}

interface EntryTally {
  id: string
  name: string
  circle_member_votes: number
  general_public_votes: number
  weighted_score: number
  credits_contributed: number
  songs: SongTally[]
}

interface TallyData {
  entries: EntryTally[]
  total_weighted: number
  total_votes: number
  my_votes: string[]   // song_ids the current user has voted on
  is_subscribed: boolean
  granted_credits: number
  voter_type: 'circle_member' | 'general_public' | null
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

function pct(part: number, total: number): number {
  if (total === 0) return 50
  return Math.round((part / total) * 100)
}

// ── Loading skeleton ──────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-pulse">
      <div className="h-8 w-40 bg-zinc-700 rounded" />
      <div className="h-32 bg-zinc-700 rounded-2xl" />
      <div className="h-24 bg-zinc-700 rounded-2xl" />
      {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-zinc-700 rounded-2xl" />)}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────

export default function VotingPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  // Rodeo metadata (title, end_date, status) fetched from detail endpoint
  const [meta, setMeta] = useState<{ title: string; end_date: string | null; status: string } | null>(null)
  // Live tally data, polled
  const [tally, setTally] = useState<TallyData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  // Optimistic voted set (song_ids)
  const [voted, setVoted] = useState<Set<string>>(new Set())
  // Per-song vote state
  const [voteStates, setVoteStates] = useState<Record<string, 'idle' | 'pending' | 'done' | 'error'>>({})
  const [voteError, setVoteError] = useState<string | null>(null)
  // Countdown ticker
  const [countdown, setCountdown] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch rodeo meta (once) ──────────────────────────────

  const loadMeta = useCallback(async () => {
    const res = await fetch(`/api/rodeos/${id}`)
    if (!res.ok) { setFetchError('Rodeo not found.'); setIsLoading(false); return }
    const json = await res.json()
    setMeta({ title: json.rodeo?.title, end_date: json.rodeo?.end_date, status: json.rodeo?.status })
  }, [id])

  // ── Fetch / poll tally ───────────────────────────────────

  const loadTally = useCallback(async () => {
    const res = await fetch(`/api/rodeos/${id}/tally`)
    if (!res.ok) return
    const json: TallyData = await res.json()
    setTally(json)
    setVoted(new Set(json.my_votes))
    setIsLoading(false)
  }, [id])

  useEffect(() => {
    setIsLoading(true)
    Promise.all([loadMeta(), loadTally()])
    // Poll every 12 s while page is visible
    pollRef.current = setInterval(loadTally, 12_000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [loadMeta, loadTally])

  // ── Countdown ticker ─────────────────────────────────────

  useEffect(() => {
    if (!meta?.end_date) return
    const tick = () => setCountdown(getCountdown(meta.end_date))
    tick()
    countdownRef.current = setInterval(tick, 1_000)
    return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
  }, [meta?.end_date])

  // ── Cast vote ────────────────────────────────────────────

  const castVote = useCallback(async (song_id: string, entry_id: string) => {
    if (voted.has(song_id)) return
    setVoteError(null)
    setVoteStates((p) => ({ ...p, [song_id]: 'pending' }))
    // Optimistic update
    setVoted((p) => new Set(p).add(song_id))

    const res = await fetch(`/api/rodeos/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ song_id, target_entry_id: entry_id }),
    })
    const json = await res.json()

    if (!res.ok) {
      // Rollback
      setVoted((p) => { const s = new Set(p); s.delete(song_id); return s })
      setVoteStates((p) => ({ ...p, [song_id]: 'error' }))
      setVoteError(json.error ?? 'Vote failed — please try again.')
      return
    }

    setVoteStates((p) => ({ ...p, [song_id]: 'done' }))
    // Refresh tally immediately after voting
    loadTally()
  }, [id, voted, loadTally])

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

  const isOpen    = meta?.status === 'voting'
  const entries   = tally.entries
  const totalW    = tally.total_weighted
  // Determine leading entry (highest weighted score)
  const sorted    = [...entries].sort((a, b) => b.weighted_score - a.weighted_score)
  const leader    = sorted[0]
  const trailer   = sorted[1]
  const leaderPct = leader && totalW > 0 ? pct(leader.weighted_score, totalW) : 50
  // All songs across all entries, paired with their entry
  const allSongs  = entries.flatMap((e) => e.songs.map((s) => ({ ...s, entryName: e.name })))
  const votedCount  = allSongs.filter((s) => voted.has(s.song_id)).length

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-16">

      {/* Back */}
      <BackButton onClick={() => router.push(`/rodeos/${id}`)} label="Back to Rodeo" />

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-pink-500 to-rose-500 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-green-300 animate-pulse' : 'bg-zinc-900/50'}`} />
              <span className="text-xs font-medium text-white/80 uppercase tracking-wide">
                {isOpen ? 'Voting Live' : 'Voting Closed'}
              </span>
            </div>
            <h1 className="text-xl font-bold leading-tight">{meta?.title ?? 'Rodeo'}</h1>
          </div>
          {countdown && isOpen && (
            <div className="flex items-center gap-2 bg-zinc-900/20 backdrop-blur rounded-xl px-4 py-2 shrink-0">
              <Timer className="w-4 h-4" />
              <span className="text-sm font-bold tabular-nums">{countdown}</span>
            </div>
          )}
        </div>

        {/* Vote progress */}
        <div className="mt-4 text-xs text-white/70">
          {votedCount} / {allSongs.length} songs voted
        </div>
        <div className="mt-1.5 h-1.5 bg-zinc-900/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-zinc-900 rounded-full transition-all duration-500"
            style={{ width: allSongs.length ? `${(votedCount / allSongs.length) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* ── Subscription gate ───────────────────────────────── */}
      {!tally.is_subscribed && (
        <SubscriptionGate />
      )}

      {/* ── Granted credits banner (general public) ─────────── */}
      {tally.is_subscribed && tally.voter_type !== 'circle_member' && (
        <GrantedCreditsBanner credits={tally.granted_credits} />
      )}

      {/* Circle member badge */}
      {tally.voter_type === 'circle_member' && (
        <div className="flex items-center gap-3 bg-purple-950/30 border border-purple-800 rounded-xl p-3 text-sm text-purple-400">
          <Crown className="w-4 h-4 text-purple-400 shrink-0" />
          <span>Your votes carry <strong>2× weight</strong> as a Circle member.</span>
        </div>
      )}

      {/* ── Live tallies ────────────────────────────────────── */}
      <LiveTallies
        entries={sorted}
        leaderPct={leaderPct}
        totalW={totalW}
        leader={leader}
        trailer={trailer}
      />

      {/* ── Ballot ──────────────────────────────────────────── */}
      {entries.length === 0 ? (
        <div className="text-center text-zinc-600 py-12">No songs in this rodeo yet.</div>
      ) : (
        <div className="space-y-4">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Music className="w-5 h-5 text-pink-400" />
            Ballot
            <span className="text-xs font-normal text-zinc-600 ml-1">
              — vote for any song across both entries
            </span>
          </h2>

          {/* Vote error */}
          {voteError && (
            <div className="flex items-center gap-3 bg-red-950/30 border border-red-800 rounded-xl p-3 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {voteError}
              <button type="button" className="ml-auto text-xs underline" onClick={() => setVoteError(null)}>
                Dismiss
              </button>
            </div>
          )}

          {/* Group songs by entry */}
          {entries.map((entry) => (
            <EntryBallotSection
              key={entry.id}
              entry={entry}
              totalW={totalW}
              canVote={tally.is_subscribed && isOpen}
              voted={voted}
              voteStates={voteStates}
              onVote={castVote}
            />
          ))}
        </div>
      )}

      {/* ── Done state ──────────────────────────────────────── */}
      {tally.is_subscribed && isOpen && votedCount === allSongs.length && allSongs.length > 0 && (
        <div className="bg-green-950/30 border border-green-800 rounded-2xl p-5 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto" />
          <p className="font-semibold text-green-800">All votes cast!</p>
          <p className="text-sm text-green-400">
            Results will be finalized when voting closes. Check back soon.
          </p>
          <button
            type="button"
            onClick={() => router.push(`/rodeos/${id}`)}
            className="mt-2 inline-flex items-center gap-1.5 text-sm text-green-400 font-medium hover:text-green-900"
          >
            View rodeo details <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

    </div>
  )
}

// ── BackButton ────────────────────────────────────────────────

function BackButton({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 text-sm text-zinc-500 hover:text-pink-400 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      {label}
    </button>
  )
}

// ── SubscriptionGate ──────────────────────────────────────────

function SubscriptionGate() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-zinc-950 to-zinc-900 rounded-2xl p-6 text-white">
      {/* Decorative blur */}
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-pink-500/20 blur-2xl pointer-events-none" />
      <div className="relative space-y-3">
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-pink-400" />
          <span className="font-bold text-lg">Subscription Required to Vote</span>
        </div>
        <p className="text-sm text-zinc-700 leading-relaxed">
          Voting in Rodeos is reserved for Stampede subscribers. Upgrade to cast your vote,
          earn credits, and shape which music wins.
        </p>
        <div className="bg-zinc-800/50 rounded-xl p-3 text-sm text-zinc-300">
          <strong className="text-white">You can still watch</strong> — live tallies below are
          always visible. No weighting hidden.
        </div>
        <button
          type="button"
          className="w-full mt-2 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 font-semibold text-sm transition-colors"
        >
          Upgrade to Stampede Pro
        </button>
      </div>
    </div>
  )
}

// ── GrantedCreditsBanner ──────────────────────────────────────

function GrantedCreditsBanner({ credits }: { credits: number }) {
  return (
    <div className="flex items-center gap-4 bg-zinc-900 border border-yellow-700 rounded-2xl p-4">
      <div className="w-10 h-10 rounded-full bg-yellow-950/30 flex items-center justify-center shrink-0">
        <Coins className="w-5 h-5 text-yellow-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-yellow-300">
          Fresh ears welcome — you&apos;ve been granted {credits} Stampede credits
        </p>
        <p className="text-xs text-yellow-400 mt-0.5">
          Vote as general public. Circle members carry 2× weight, but your voice counts.
        </p>
      </div>
      <span className="text-2xl font-bold text-yellow-400 tabular-nums shrink-0">+{credits}</span>
    </div>
  )
}

// ── LiveTallies ───────────────────────────────────────────────

function LiveTallies({
  entries,
  leaderPct,
  totalW,
  leader,
  trailer,
}: {
  entries: EntryTally[]
  leaderPct: number
  totalW: number
  leader: EntryTally | undefined
  trailer: EntryTally | undefined
}) {
  const tied = totalW === 0

  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-700 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-pink-400" />
          Live Tallies
        </h2>
        <span className="text-xs text-zinc-600">{totalW.toFixed(0)} weighted pts total</span>
      </div>

      {/* ── Tug-of-war credit flow bar ── */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-semibold text-zinc-400 px-0.5">
          <span className="truncate max-w-[40%]">{entries[0]?.name ?? '—'}</span>
          <span className="truncate max-w-[40%] text-right">{entries[1]?.name ?? '—'}</span>
        </div>

        {/* Animated bar */}
        <div className="relative h-8 rounded-full bg-zinc-800 overflow-hidden">
          {/* Left entry fill */}
          <div
            className="absolute inset-y-0 left-0 bg-pink-500 transition-all duration-700 ease-in-out"
            style={{ width: tied ? '50%' : `${leaderPct}%` }}
          />
          {/* Right entry fill */}
          <div
            className="absolute inset-y-0 right-0 bg-blue-400 transition-all duration-700 ease-in-out"
            style={{ width: tied ? '50%' : `${100 - leaderPct}%` }}
          />
          {/* Center divider + label */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-white drop-shadow-sm select-none">
              {tied ? 'TIED' : `${leaderPct}% — ${100 - leaderPct}%`}
            </span>
          </div>
          {/* Credit particles (decorative) */}
          {!tied && (
            <div
              className="absolute top-1.5 bottom-1.5 w-5 rounded-full bg-zinc-900/30 animate-bounce"
              style={{ left: `calc(${leaderPct}% - 10px)` }}
            />
          )}
        </div>

        {/* Credits flowing label */}
        {!tied && leader && (
          <p className="text-xs text-center text-zinc-600">
            Credits flowing toward <strong className="text-zinc-400">{leader.name}</strong>
          </p>
        )}
      </div>

      {/* ── Per-entry breakdown ── */}
      <div className="grid gap-3">
        {entries.map((entry, idx) => {
          const entryPct = totalW > 0 ? pct(entry.weighted_score, totalW) : 50
          const isLeading = entry.id === leader?.id && totalW > 0
          return (
            <div
              key={entry.id}
              className={`rounded-xl border p-4 ${isLeading ? 'border-pink-700 bg-pink-950/20' : 'border-zinc-800 bg-zinc-950'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {isLeading && <Crown className="w-3.5 h-3.5 text-pink-400 shrink-0" />}
                  <span className="font-semibold text-zinc-100 truncate text-sm">{entry.name}</span>
                </div>
                <span className={`text-lg font-bold tabular-nums ${isLeading ? 'text-pink-400' : 'text-zinc-400'}`}>
                  {entry.weighted_score.toFixed(1)}
                  <span className="text-xs font-normal text-zinc-600 ml-1">pts</span>
                </span>
              </div>

              {/* Score bar */}
              <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${idx === 0 ? 'bg-pink-500' : 'bg-blue-400'}`}
                  style={{ width: `${entryPct}%` }}
                />
              </div>

              {/* Circle member / general public split — always visible */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <Users className="w-3 h-3 text-purple-400 shrink-0" />
                  <span className="font-semibold text-purple-400">{entry.circle_member_votes}</span>
                  <span>Circle member</span>
                  <span className="text-zinc-600">(2×)</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <Users className="w-3 h-3 text-blue-400 shrink-0" />
                  <span className="font-semibold text-blue-400">{entry.general_public_votes}</span>
                  <span>General public</span>
                  <span className="text-zinc-600">(1×)</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── EntryBallotSection ────────────────────────────────────────

function EntryBallotSection({
  entry,
  totalW,
  canVote,
  voted,
  voteStates,
  onVote,
}: {
  entry: EntryTally
  totalW: number
  canVote: boolean
  voted: Set<string>
  voteStates: Record<string, 'idle' | 'pending' | 'done' | 'error'>
  onVote: (song_id: string, entry_id: string) => void
}) {
  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-700 overflow-hidden">
      {/* Entry header */}
      <div className="flex items-center gap-3 px-5 py-3 bg-zinc-950 border-b border-zinc-800">
        <div className="w-7 h-7 rounded-full bg-pink-900/30 flex items-center justify-center shrink-0">
          <Users className="w-3.5 h-3.5 text-pink-400" />
        </div>
        <span className="font-semibold text-zinc-100">{entry.name}</span>
        <span className="ml-auto text-xs text-zinc-600">
          {entry.songs.length} song{entry.songs.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Songs */}
      <ul className="divide-y divide-zinc-800">
        {entry.songs.map((song) => {
          const isVoted  = voted.has(song.song_id)
          const state    = voteStates[song.song_id] ?? 'idle'
          const songPct  = totalW > 0 ? pct(song.weighted_score, totalW) : 0

          return (
            <li key={song.song_id} className="p-4 space-y-3">
              {/* Song info row */}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-pink-950/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Music className="w-4 h-4 text-pink-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-white text-sm">{song.title}</span>
                    {song.label && <SongLabelBadge label={song.label} />}
                    {song.locked && <span title="Locked"><Lock className="w-3 h-3 text-zinc-600" /></span>}
                  </div>
                  <p className="text-xs text-zinc-600 mt-0.5">{song.artist}</p>
                </div>

                {/* Vote button */}
                <div className="shrink-0">
                  <SongVoteButton
                    state={isVoted ? 'done' : state}
                    canVote={canVote}
                    onClick={() => onVote(song.song_id, entry.id)}
                  />
                </div>
              </div>

              {/* Per-song tally — always visible, no hidden weighting */}
              <SongTallyBar song={song} songPct={songPct} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── SongTallyBar ──────────────────────────────────────────────

function SongTallyBar({ song, songPct }: { song: SongTally; songPct: number }) {
  return (
    <div className="space-y-1.5 pt-1">
      {/* Progress bar */}
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-pink-400 rounded-full transition-all duration-700"
          style={{ width: `${songPct}%` }}
        />
      </div>

      {/* Tally detail — circle member and general public always shown */}
      <div className="flex items-center gap-4 text-xs text-zinc-600">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
          <span className="font-medium text-purple-600">{song.circle_member_votes}</span>
          <span>circle</span>
          <span className="text-zinc-700">(2×)</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
          <span className="font-medium text-blue-400">{song.general_public_votes}</span>
          <span>public</span>
          <span className="text-zinc-700">(1×)</span>
        </span>
        <span className="ml-auto font-semibold text-zinc-500">
          {song.weighted_score.toFixed(1)} pts
        </span>
      </div>
    </div>
  )
}

// ── SongVoteButton ────────────────────────────────────────────

function SongVoteButton({
  state,
  canVote,
  onClick,
}: {
  state: 'idle' | 'pending' | 'done' | 'error'
  canVote: boolean
  onClick: () => void
}) {
  if (!canVote) {
    return (
      <button
        type="button"
        disabled
        title="Subscription required"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-600 cursor-not-allowed"
      >
        <Lock className="w-3 h-3" /> Vote
      </button>
    )
  }

  if (state === 'pending') {
    return (
      <button type="button" disabled className="px-3 py-1.5 rounded-lg text-xs font-medium bg-pink-900/30 text-pink-400 flex items-center gap-1.5">
        <Loader2 className="w-3 h-3 animate-spin" /> Voting…
      </button>
    )
  }

  if (state === 'done') {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-900/30 text-green-400">
        <CheckCircle2 className="w-3.5 h-3.5" /> Voted
      </div>
    )
  }

  if (state === 'error') {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-900/30 text-red-400 hover:bg-red-200"
      >
        <AlertCircle className="w-3 h-3" /> Retry
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-pink-500 text-white hover:bg-pink-600 active:scale-95 transition-all"
    >
      <Star className="w-3 h-3" /> Vote
    </button>
  )
}

// ── SongLabelBadge ────────────────────────────────────────────

function SongLabelBadge({ label }: { label: 'studio' | 'live' }) {
  if (label === 'live') {
    return <span className="text-xs px-1.5 py-0.5 rounded bg-red-900/30 text-red-400 font-medium">Live</span>
  }
  return <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 font-medium">Studio</span>
}
