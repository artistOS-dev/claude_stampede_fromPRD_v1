'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Trophy, Calendar, Users, Music, CheckCircle2,
  Swords, Crown, Search, X, ChevronRight, Mic2, Lock,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────

interface Participant {
  id: string
  artist_name: string
  artist_image_url: string | null
  seed: number | null
  status: 'active' | 'eliminated' | 'champion'
  artist_manager_id: string
}

interface Song { id: string; title: string; artist: string; cover_url: string | null }

interface CircuitDuel {
  id: string
  round_number: number
  position: number
  participant_left_id: string | null
  participant_right_id: string | null
  participant_left: Participant | null
  participant_right: Participant | null
  song_left_id: string | null
  song_right_id: string | null
  song_left: Song | null
  song_right: Song | null
  status: 'pending' | 'song_selection' | 'voting' | 'complete'
  winner_participant_id: string | null
  voting_starts_at: string | null
  voting_ends_at: string | null
  tally: { left: number; right: number }
  my_vote: string | null
  is_expired: boolean
}

interface Round {
  round_number: number
  round_name: string
  duels: CircuitDuel[]
}

interface CircuitDetail {
  id: string
  title: string
  description: string | null
  event_name: string | null
  event_date: string | null
  status: 'draft' | 'open' | 'active' | 'complete'
  max_artists: number
  current_round: number
  total_rounds: number
  voting_hours_per_round: number
  winner_participant_id: string | null
  participants: Participant[]
  rounds: Round[]
  my_participant: Participant | null       // first of my participants (backwards compat)
  my_participants: Participant[]           // all participants managed by me
  my_votes: Record<string, string>
  is_admin: boolean
  is_artist_manager: boolean
}

interface SongResult { id: string; title: string; artist: string; album: string | null }

// ── Song Search ───────────────────────────────────────────────

function SongSearchModal({
  onSelect,
  onClose,
  artistName,
  usedSongIds,
}: {
  onSelect: (song: SongResult) => void
  onClose: () => void
  artistName: string
  usedSongIds: string[]
}) {
  const [query, setQuery]     = useState(artistName)
  const [results, setResults] = useState<SongResult[]>([])
  const [loading, setLoading] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback((q: string) => {
    setQuery(q)
    if (debounce.current) clearTimeout(debounce.current)
    if (!q.trim()) { setResults([]); return }
    debounce.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/songs/search?q=${encodeURIComponent(q)}&limit=10`)
        if (!res.ok) return
        const json: { songs: SongResult[] } = await res.json()
        setResults(json.songs ?? [])
      } finally { setLoading(false) }
    }, 300)
  }, [])

  useEffect(() => { search(artistName) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-stone-900 rounded-2xl border border-stone-700 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-stone-800">
          <p className="font-bold text-white">Pick your song</p>
          <button type="button" onClick={onClose} className="text-stone-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
            <input
              type="text"
              placeholder="Search by song or artist…"
              value={query}
              onChange={(e) => search(e.target.value)}
              autoFocus
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            {loading && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />}
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {results.map((s) => {
              const isUsedTwice = usedSongIds.filter((id) => id === s.id).length >= 2
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={isUsedTwice}
                  onClick={() => onSelect(s)}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-amber-950/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <p className="text-sm font-medium text-white truncate">{s.title}</p>
                  <p className="text-xs text-stone-500 truncate">{s.artist}{isUsedTwice ? ' · used 2×' : ''}</p>
                </button>
              )
            })}
            {!loading && results.length === 0 && query && (
              <p className="text-center text-stone-500 text-sm py-4">No songs found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Duel Card ─────────────────────────────────────────────────

function DuelCard({
  duel,
  myParticipantIds,
  onVote,
  onPickSong,
  isVoting,
}: {
  duel: CircuitDuel
  myParticipantIds: Set<string>
  onVote: (duelId: string, participantId: string) => void
  onPickSong: (duelId: string, side: 'left' | 'right') => void
  isVoting: boolean
}) {
  const { left, right } = duel.tally
  const total    = left + right
  const leftPct  = total > 0 ? Math.round((left  / total) * 100) : 50
  const rightPct = total > 0 ? Math.round((right / total) * 100) : 50

  const isWinnerLeft  = duel.winner_participant_id === duel.participant_left_id
  const isWinnerRight = duel.winner_participant_id === duel.participant_right_id
  const myVoteLeft    = duel.my_vote === duel.participant_left_id
  const myVoteRight   = duel.my_vote === duel.participant_right_id
  const iAmLeft       = !!duel.participant_left_id  && myParticipantIds.has(duel.participant_left_id)
  const iAmRight      = !!duel.participant_right_id && myParticipantIds.has(duel.participant_right_id)

  const isPending  = duel.status === 'pending'
  const isSong     = duel.status === 'song_selection'
  const isVotingOn = duel.status === 'voting' && !duel.is_expired
  const isComplete = duel.status === 'complete' || (duel.status === 'voting' && duel.is_expired)

  function ParticipantRow({
    participant, song, isWinner, myVote, iAm, side, pct, votes,
  }: {
    participant: Participant | null
    song: Song | null
    isWinner: boolean
    myVote: boolean
    iAm: boolean
    side: 'left' | 'right'
    pct: number
    votes: number
  }) {
    const accent = side === 'left' ? 'amber' : 'teal'
    const aColor = accent === 'amber' ? 'text-amber-400 border-amber-700 bg-amber-950/20' : 'text-teal-400 border-teal-700 bg-teal-950/20'

    return (
      <div className={`rounded-xl border p-3 ${isWinner ? 'border-yellow-700 bg-yellow-950/10' : isComplete && !isWinner ? 'border-stone-800 bg-stone-950 opacity-60' : 'border-stone-800 bg-stone-950'}`}>
        <div className="flex items-start gap-2.5">
          {/* Avatar */}
          {participant?.artist_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={participant.artist_image_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
          ) : (
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${isWinner ? 'bg-yellow-900/40 text-yellow-400' : `border ${aColor}`}`}>
              {participant ? participant.artist_name.slice(0, 2).toUpperCase() : '?'}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {isWinner && <Trophy className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
              {myVote && !isWinner && <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />}
              {iAm && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
              <span className={`font-bold text-sm truncate ${isWinner ? 'text-yellow-300' : 'text-white'}`}>
                {participant?.artist_name ?? 'TBD'}
              </span>
              {participant?.seed && <span className="text-[10px] text-stone-600 font-medium">#{participant.seed}</span>}
            </div>

            {/* Song */}
            {song ? (
              <div className="flex items-center gap-1 mt-0.5">
                <Music className="w-3 h-3 text-stone-500 shrink-0" />
                <span className="text-xs text-stone-400 truncate">{song.title}</span>
              </div>
            ) : iAm && isSong ? (
              <button
                type="button"
                onClick={() => onPickSong(duel.id, side)}
                className="mt-1 flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-medium transition-colors"
              >
                <Music className="w-3 h-3" /> Pick your song
              </button>
            ) : (
              <span className="text-xs text-stone-600 mt-0.5 block">No song yet</span>
            )}
          </div>

          {/* Vote button or tally */}
          <div className="shrink-0">
            {isVotingOn && !duel.my_vote && !iAmLeft && !iAmRight ? (
              <button
                type="button"
                disabled={isVoting}
                onClick={() => participant && onVote(duel.id, participant.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-40
                  ${accent === 'amber' ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-teal-600 hover:bg-teal-500 text-white'}`}
              >
                Vote
              </button>
            ) : (isComplete || (isVotingOn && duel.my_vote)) ? (
              <span className={`text-sm font-bold tabular-nums ${isWinner ? 'text-yellow-400' : 'text-stone-500'}`}>
                {pct}%
                <span className="text-[10px] font-normal text-stone-600 ml-0.5">({votes})</span>
              </span>
            ) : null}
          </div>
        </div>

        {/* Vote bar */}
        {(isComplete || (isVotingOn && duel.my_vote)) && total > 0 && (
          <div className="mt-2 h-1.5 bg-stone-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${accent === 'amber' ? 'bg-amber-500' : 'bg-teal-400'}`}
              style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`w-52 rounded-2xl border bg-stone-900 shadow-lg text-left
      ${isPending ? 'border-stone-800 opacity-50' : isVotingOn ? 'border-amber-700/60' : 'border-stone-700'}`}
    >
      {/* Status stripe */}
      <div className={`h-0.5 rounded-t-2xl ${isVotingOn ? 'bg-gradient-to-r from-amber-500 to-teal-400' : isComplete ? 'bg-stone-700' : isSong ? 'bg-amber-800' : 'bg-stone-800'}`} />

      <div className="p-2.5 space-y-2">
        {/* Status label */}
        <div className="flex items-center justify-between">
          <span className={`text-[9px] font-bold uppercase tracking-widest
            ${isVotingOn ? 'text-amber-400' : isComplete ? 'text-stone-500' : isSong ? 'text-amber-600' : 'text-stone-700'}`}>
            {isPending ? 'Pending' : isSong ? 'Pick Songs' : isVotingOn ? 'Vote Now' : 'Complete'}
          </span>
          {isVotingOn && (
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          )}
        </div>

        <ParticipantRow
          participant={duel.participant_left}
          song={duel.song_left}
          isWinner={isWinnerLeft}
          myVote={myVoteLeft}
          iAm={iAmLeft}
          side="left"
          pct={leftPct}
          votes={left}
        />

        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-stone-800" />
          <Swords className="w-3 h-3 text-stone-600" />
          <div className="flex-1 h-px bg-stone-800" />
        </div>

        <ParticipantRow
          participant={duel.participant_right}
          song={duel.song_right}
          isWinner={isWinnerRight}
          myVote={myVoteRight}
          iAm={iAmRight}
          side="right"
          pct={rightPct}
          votes={right}
        />
      </div>
    </div>
  )
}

// ── Bracket ───────────────────────────────────────────────────

const SLOT_HEIGHT = 156 // px per bracket slot

function BracketView({
  circuit,
  myParticipantIds,
  onVote,
  onPickSong,
  isVoting,
}: {
  circuit: CircuitDetail
  myParticipantIds: Set<string>
  onVote: (duelId: string, participantId: string) => void
  onPickSong: (duelId: string, side: 'left' | 'right') => void
  isVoting: boolean
}) {
  const totalSlots = circuit.max_artists / 2

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-6 items-start" style={{ minWidth: `${circuit.total_rounds * 240}px` }}>
        {circuit.rounds.map((round) => {
          const slotsPerDuel = Math.pow(2, round.round_number - 1)
          const containerHeight = totalSlots * SLOT_HEIGHT

          return (
            <div key={round.round_number} className="flex-shrink-0" style={{ width: 208 }}>
              {/* Round header */}
              <div className={`mb-3 px-3 py-1.5 rounded-lg text-center
                ${round.round_number === circuit.current_round && circuit.status === 'active'
                  ? 'bg-amber-900/30 border border-amber-800/50'
                  : 'bg-stone-900 border border-stone-800'}`}>
                <p className={`text-xs font-bold uppercase tracking-wide
                  ${round.round_number === circuit.current_round && circuit.status === 'active'
                    ? 'text-amber-400' : 'text-stone-500'}`}>
                  {round.round_name}
                </p>
                {round.round_number === circuit.current_round && circuit.status === 'active' && (
                  <p className="text-[10px] text-amber-600 mt-0.5">Current round</p>
                )}
              </div>

              {/* Duel column */}
              <div className="relative" style={{ height: containerHeight }}>
                {round.duels.map((duel, i) => {
                  const top    = i * slotsPerDuel * SLOT_HEIGHT
                  const height = slotsPerDuel * SLOT_HEIGHT
                  return (
                    <div
                      key={duel.id}
                      className="absolute w-full flex items-center justify-center"
                      style={{ top, height }}
                    >
                      <DuelCard
                        duel={duel}
                        myParticipantIds={myParticipantIds}
                        onVote={onVote}
                        onPickSong={onPickSong}
                        isVoting={isVoting}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Admin Panel ───────────────────────────────────────────────

function AdminPanel({
  circuit,
  onAction,
  acting,
}: {
  circuit: CircuitDetail
  onAction: (action: string) => void
  acting: boolean
}) {
  const { status, participants, max_artists, current_round, rounds } = circuit
  const currentRoundData = rounds.find((r) => r.round_number === current_round)
  const allSongsPicked   = currentRoundData?.duels.every((d) => d.song_left_id !== null && d.song_right_id !== null) ?? false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allVotingDone    = currentRoundData?.duels.every((d: any) => d.status === 'voting' || d.status === 'complete') ?? false

  return (
    <div className="bg-yellow-950/10 border border-yellow-800/40 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Crown className="w-4 h-4 text-yellow-400" />
        <p className="text-xs font-bold text-yellow-400 uppercase tracking-wide">Producer Controls</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {status === 'draft' && (
          <button
            type="button"
            disabled={acting}
            onClick={() => onAction('open')}
            className="px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-white text-xs font-semibold disabled:opacity-40 transition-colors"
          >
            Open for Registration
          </button>
        )}

        {status === 'open' && (
          <button
            type="button"
            disabled={acting || participants.length !== max_artists}
            onClick={() => onAction('seed')}
            className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-xs font-semibold disabled:opacity-40 transition-colors"
            title={participants.length !== max_artists ? `Need ${max_artists - participants.length} more artists` : ''}
          >
            Seed Bracket & Start ({participants.length}/{max_artists})
          </button>
        )}

        {status === 'active' && allSongsPicked && currentRoundData?.duels.some((d) => d.status === 'song_selection') && (
          <button
            type="button"
            disabled={acting}
            onClick={() => onAction('start_voting')}
            className="px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-xs font-semibold disabled:opacity-40 transition-colors"
          >
            Start Voting — Round {current_round}
          </button>
        )}

        {status === 'active' && allVotingDone && (
          <button
            type="button"
            disabled={acting}
            onClick={() => onAction('close_round')}
            className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-xs font-semibold disabled:opacity-40 transition-colors"
          >
            Close Round & Advance
          </button>
        )}
      </div>

      {status === 'open' && participants.length < max_artists && (
        <p className="text-xs text-stone-500">
          Waiting for {max_artists - participants.length} more artist{max_artists - participants.length !== 1 ? 's' : ''} to register
        </p>
      )}
    </div>
  )
}

// ── Join Panel ────────────────────────────────────────────────

function JoinPanel({ circuitId, onJoined }: { circuitId: string; onJoined: () => void }) {
  const [form, setForm]       = useState({ artist_name: '', artist_image_url: '' })
  const [submitting, setSub]  = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [open, setOpen]       = useState(false)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.artist_name.trim()) { setError('Artist name required'); return }
    setSub(true)
    try {
      const res = await fetch(`/api/circuits/${circuitId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist_name: form.artist_name.trim(), artist_image_url: form.artist_image_url.trim() || null }),
      })
      const json: { error?: string } = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to join')
      onJoined()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join')
    } finally { setSub(false) }
  }, [form, circuitId, onJoined])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full py-3 rounded-xl border-2 border-dashed border-amber-700 text-amber-400 text-sm font-semibold hover:border-amber-500 hover:bg-amber-950/20 transition-all flex items-center justify-center gap-2"
      >
        <Mic2 className="w-4 h-4" /> Register Your Artist
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-stone-900 border border-amber-800/50 rounded-2xl p-4 space-y-3">
      <p className="font-bold text-white text-sm">Register Your Artist</p>
      <div>
        <input
          type="text"
          placeholder="Artist name *"
          required
          value={form.artist_name}
          onChange={(e) => setForm((f) => ({ ...f, artist_name: e.target.value }))}
          className="w-full px-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>
      <div>
        <input
          type="url"
          placeholder="Artist photo URL (optional)"
          value={form.artist_image_url}
          onChange={(e) => setForm((f) => ({ ...f, artist_image_url: e.target.value }))}
          className="w-full px-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)}
          className="flex-1 py-2 rounded-xl border border-stone-700 text-stone-400 text-sm font-medium hover:text-white transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={submitting || !form.artist_name.trim()}
          className="flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
          {submitting ? 'Joining…' : 'Join Circuit'}
        </button>
      </div>
    </form>
  )
}

// ── Main Page ─────────────────────────────────────────────────

export default function CircuitPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()

  const [circuit, setCircuit]       = useState<CircuitDetail | null>(null)
  const [isLoading, setLoading]     = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [isVoting, setVoting]       = useState(false)
  const [acting, setActing]         = useState(false)
  const [actionMsg, setActionMsg]   = useState<string | null>(null)

  // Song picker state
  const [songPicker, setSongPicker] = useState<{ duelId: string; side: 'left' | 'right' } | null>(null)
  const [pickingMsg, setPickingMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/circuits/${id}`)
      if (!res.ok) { setFetchError('Circuit not found'); setLoading(false); return }
      const json: { circuit: CircuitDetail } = await res.json()
      setCircuit(json.circuit)
    } catch { setFetchError('Failed to load circuit') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  const handleVote = useCallback(async (duelId: string, participantId: string) => {
    if (isVoting) return
    setVoting(true)
    try {
      const res = await fetch(`/api/circuits/${id}/duels/${duelId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chosen_participant_id: participantId }),
      })
      if (res.ok) await load()
    } finally { setVoting(false) }
  }, [id, isVoting, load])

  const handleAdminAction = useCallback(async (action: string) => {
    setActing(true)
    setActionMsg(null)
    try {
      const res = await fetch(`/api/circuits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json: { error?: string } = await res.json()
      if (!res.ok) { setActionMsg(json.error ?? 'Action failed'); return }
      await load()
    } catch { setActionMsg('Action failed') }
    finally { setActing(false) }
  }, [id, load])

  const handlePickSong = useCallback(async (song: SongResult) => {
    if (!songPicker) return
    setPickingMsg(null)
    try {
      const res = await fetch(`/api/circuits/${id}/duels/${songPicker.duelId}/song`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song_id: song.id }),
      })
      const json: { error?: string } = await res.json()
      if (!res.ok) { setPickingMsg(json.error ?? 'Failed to pick song'); return }
      setSongPicker(null)
      await load()
    } catch { setPickingMsg('Failed to pick song') }
  }, [id, songPicker, load])

  // Collect songs already used by any of my participants in this circuit
  const myParticipantIds = new Set((circuit?.my_participants ?? []).map((p) => p.id))
  const usedSongIds: string[] = []
  for (const round of circuit?.rounds ?? []) {
    for (const duel of round.duels) {
      if (duel.participant_left_id  && myParticipantIds.has(duel.participant_left_id)  && duel.song_left)  usedSongIds.push(duel.song_left.id)
      if (duel.participant_right_id && myParticipantIds.has(duel.participant_right_id) && duel.song_right) usedSongIds.push(duel.song_right.id)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (fetchError || !circuit) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => router.back()} className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-200">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="bg-red-950/30 border border-red-800 rounded-xl p-6 text-center text-red-400">
          {fetchError ?? 'Circuit not found.'}
        </div>
      </div>
    )
  }

  const champion = circuit.winner_participant_id
    ? circuit.participants.find((p) => p.id === circuit.winner_participant_id)
    : null

  const canJoin = circuit.status === 'open'
    && circuit.is_artist_manager
    && circuit.participants.length < circuit.max_artists

  return (
    <div className="max-w-full space-y-5 pb-20">
      <button type="button" onClick={() => router.push('/circuits')}
        className="flex items-center gap-2 text-sm text-stone-500 hover:text-amber-400 transition-colors">
        <ArrowLeft className="w-4 h-4" /> All Circuits
      </button>

      {/* Header */}
      <div className="bg-gradient-to-br from-amber-900 via-stone-800 to-teal-950 rounded-2xl p-6 border border-amber-800/40 shadow-lg">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {circuit.status === 'open' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-green-900/50 text-green-400 border border-green-800">Open</span>}
              {circuit.status === 'active' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-900/50 text-amber-400 border border-amber-800 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" /> Live</span>}
              {circuit.status === 'complete' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-stone-800 text-stone-400 border border-stone-700">Complete</span>}
              {circuit.my_participants.length > 0 && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-teal-900/50 text-teal-400 border border-teal-800">{circuit.my_participants.length === 1 ? 'Your artist' : `Your ${circuit.my_participants.length} artists`}</span>}
            </div>
            <h1 className="text-2xl font-extrabold font-display text-amber-100">{circuit.title}</h1>
            {circuit.event_name && <p className="text-amber-300/70 mt-0.5">{circuit.event_name}</p>}
            {circuit.description && <p className="text-amber-200/50 text-sm mt-1">{circuit.description}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            {circuit.event_date && (
              <div className="flex items-center gap-1.5 text-xs text-amber-300/70">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(circuit.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-stone-400">
              <Users className="w-3.5 h-3.5" />
              {circuit.participants.length}/{circuit.max_artists} artists
            </div>
            {circuit.status === 'active' && (
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                <ChevronRight className="w-3.5 h-3.5" />
                Round {circuit.current_round} of {circuit.total_rounds}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Champion banner */}
      {champion && (
        <div className="flex items-center gap-4 bg-yellow-950/20 border border-yellow-700/60 rounded-2xl px-6 py-4">
          <Trophy className="w-8 h-8 text-yellow-400 shrink-0" />
          <div>
            <p className="text-xs text-yellow-600 uppercase tracking-wide font-medium">Circuit Champion</p>
            <p className="text-xl font-bold text-yellow-300">{champion.artist_name}</p>
          </div>
        </div>
      )}

      {/* Admin controls */}
      {circuit.is_admin && circuit.status !== 'complete' && (
        <div className="space-y-2">
          <AdminPanel circuit={circuit} onAction={handleAdminAction} acting={acting} />
          {actionMsg && <p className="text-sm text-red-400">{actionMsg}</p>}
        </div>
      )}

      {/* My song picker feedback */}
      {pickingMsg && <p className="text-sm text-red-400 text-center">{pickingMsg}</p>}

      {/* Join panel */}
      {canJoin && <JoinPanel circuitId={id} onJoined={load} />}

      {/* Artist manager — waiting for round to open */}
      {circuit.my_participants.length > 0 && circuit.status === 'active' && (() => {
        const myDuels = circuit.rounds
          .flatMap((r) => r.duels)
          .filter((d) =>
            (d.participant_left_id  && myParticipantIds.has(d.participant_left_id)) ||
            (d.participant_right_id && myParticipantIds.has(d.participant_right_id))
          )
        const hasSongToPick = myDuels.some((d) => {
          if (d.status !== 'song_selection') return false
          const iAmLeft  = !!(d.participant_left_id  && myParticipantIds.has(d.participant_left_id))
          return iAmLeft ? !d.song_left : !d.song_right
        })
        if (!hasSongToPick) return null
        return (
          <div className="flex items-center gap-3 bg-amber-950/20 border border-amber-800/50 rounded-2xl px-5 py-3">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-sm text-amber-300">
              It&apos;s your turn to pick a song for your upcoming duel. Find it in the bracket below.
            </p>
          </div>
        )
      })()}

      {/* Participant roster */}
      {circuit.participants.length > 0 && (
        <div className="bg-stone-900 border border-stone-700 rounded-2xl p-4">
          <p className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-3">
            Competing Artists
          </p>
          <div className="flex flex-wrap gap-2">
            {circuit.participants.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium
                  ${p.status === 'champion' ? 'border-yellow-600 bg-yellow-950/20 text-yellow-300' :
                    p.status === 'eliminated' ? 'border-stone-700 bg-stone-900 text-stone-500 line-through' :
                    'border-stone-700 bg-stone-800 text-stone-300'}`}
              >
                {p.status === 'champion' && <Trophy className="w-3 h-3 text-yellow-400" />}
                {p.seed && <span className="text-[10px] text-stone-600 font-bold">#{p.seed}</span>}
                {p.artist_name}
                {myParticipantIds.has(p.id) && <Crown className="w-3 h-3 text-amber-400" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bracket */}
      {circuit.rounds.length > 0 && (
        <div className="bg-stone-900 border border-stone-700 rounded-2xl p-4">
          <p className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-4">Tournament Bracket</p>
          <BracketView
            circuit={circuit}
            myParticipantIds={myParticipantIds}
            onVote={handleVote}
            onPickSong={(duelId, side) => setSongPicker({ duelId, side })}
            isVoting={isVoting}
          />
        </div>
      )}

      {/* Empty state */}
      {circuit.status === 'open' && circuit.rounds.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Swords className="w-10 h-10 text-stone-700 mb-3" />
          <p className="text-stone-400 font-medium">Bracket not seeded yet</p>
          <p className="text-stone-600 text-sm mt-1">
            {circuit.participants.length < circuit.max_artists
              ? `Waiting for ${circuit.max_artists - circuit.participants.length} more artist${circuit.max_artists - circuit.participants.length !== 1 ? 's' : ''}`
              : 'Admin will seed the bracket soon'}
          </p>
        </div>
      )}

      {/* Song picker modal */}
      {songPicker && circuit.my_participant && (
        <SongSearchModal
          artistName={circuit.my_participant.artist_name}
          usedSongIds={usedSongIds}
          onSelect={handlePickSong}
          onClose={() => { setSongPicker(null); setPickingMsg(null) }}
        />
      )}
    </div>
  )
}
