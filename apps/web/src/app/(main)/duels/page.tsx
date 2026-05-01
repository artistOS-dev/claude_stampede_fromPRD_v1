'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Swords, Timer, CheckCircle2, ChevronRight } from 'lucide-react'

interface Song {
  id: string
  title: string
  artist: string
  album: string | null
  cover_url: string | null
}

interface Duel {
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

function getCountdown(endDate: string): string {
  const diff = new Date(endDate).getTime() - Date.now()
  if (diff <= 0) return 'Ended'
  const days  = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  const mins  = Math.floor((diff % 3_600_000) / 60_000)
  if (days > 0)  return `${days}d ${hours}h left`
  if (hours > 0) return `${hours}h ${mins}m left`
  return `${mins}m left`
}

function DuelCard({ duel, onClick }: { duel: Duel; onClick: () => void }) {
  const isOpen    = duel.status === 'active' && !duel.is_expired
  const isClosed  = duel.status === 'closed' || duel.is_expired
  const hasVoted  = !!duel.my_vote
  const { left, right, total } = duel.tally
  const leftPct   = total > 0 ? Math.round((left  / total) * 100) : 50
  const rightPct  = total > 0 ? Math.round((right / total) * 100) : 50
  const winnerIsLeft  = duel.winner_song_id === duel.song_left?.id
  const winnerIsRight = duel.winner_song_id === duel.song_right?.id

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-stone-900 border border-stone-700 rounded-2xl overflow-hidden hover:border-amber-700/60 transition-colors group"
    >
      {/* Status bar */}
      <div className={`h-1 w-full ${isOpen ? 'bg-green-500' : 'bg-stone-600'}`} />

      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-green-400 animate-pulse' : 'bg-stone-500'}`} />
              <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                {isOpen ? 'Voting Open' : 'Closed'}
              </span>
              {hasVoted && isOpen && (
                <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
                  <CheckCircle2 className="w-3 h-3" />
                  Voted
                </span>
              )}
            </div>
            <h3 className="font-bold text-white text-sm leading-snug group-hover:text-amber-300 transition-colors">
              {duel.title}
            </h3>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isOpen && (
              <span className="flex items-center gap-1 text-xs text-amber-400 font-medium">
                <Timer className="w-3.5 h-3.5" />
                {getCountdown(duel.end_date)}
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-stone-600 group-hover:text-amber-400 transition-colors" />
          </div>
        </div>

        {/* VS card */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          {/* Left */}
          <div className={`text-center rounded-xl px-3 py-3 border transition-colors ${
            winnerIsLeft ? 'border-yellow-600 bg-yellow-950/20' :
            duel.my_vote === duel.song_left?.id ? 'border-amber-600 bg-amber-950/20' :
            'border-stone-700 bg-stone-800/50'
          }`}>
            <p className="text-xs font-bold text-stone-100 truncate">{duel.song_left?.title ?? '—'}</p>
            <p className="text-xs text-stone-500 truncate mt-0.5">{duel.song_left?.artist ?? ''}</p>
            {(isClosed || hasVoted) && (
              <p className="text-sm font-bold text-amber-400 mt-1.5 tabular-nums">{leftPct}%</p>
            )}
          </div>

          <div className="flex flex-col items-center gap-1">
            <Swords className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-bold text-stone-600">VS</span>
          </div>

          {/* Right */}
          <div className={`text-center rounded-xl px-3 py-3 border transition-colors ${
            winnerIsRight ? 'border-yellow-600 bg-yellow-950/20' :
            duel.my_vote === duel.song_right?.id ? 'border-amber-600 bg-amber-950/20' :
            'border-stone-700 bg-stone-800/50'
          }`}>
            <p className="text-xs font-bold text-stone-100 truncate">{duel.song_right?.title ?? '—'}</p>
            <p className="text-xs text-stone-500 truncate mt-0.5">{duel.song_right?.artist ?? ''}</p>
            {(isClosed || hasVoted) && (
              <p className="text-sm font-bold text-amber-400 mt-1.5 tabular-nums">{rightPct}%</p>
            )}
          </div>
        </div>

        {/* Progress bar (visible after voting or when closed) */}
        {(isClosed || hasVoted) && total > 0 && (
          <div className="space-y-1">
            <div className="relative h-2 rounded-full bg-stone-800 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${leftPct}%` }}
              />
            </div>
            <p className="text-xs text-stone-600 text-center">{total} vote{total !== 1 ? 's' : ''}</p>
          </div>
        )}

        {/* Winner badge */}
        {isClosed && duel.winner_song_id && (
          <div className="flex items-center gap-2 bg-yellow-950/20 border border-yellow-700/50 rounded-xl px-3 py-2">
            <span className="text-yellow-400 text-sm">🏆</span>
            <span className="text-sm font-semibold text-yellow-300">
              {winnerIsLeft ? duel.song_left?.title : duel.song_right?.title} wins
            </span>
          </div>
        )}

        {/* CTA */}
        {isOpen && !hasVoted && (
          <div className="text-center">
            <span className="text-xs text-amber-400 font-semibold">Swipe to vote →</span>
          </div>
        )}
      </div>
    </button>
  )
}

export default function DuelsPage() {
  const router = useRouter()
  const [duels, setDuels]       = useState<Duel[]>([])
  const [isLoading, setLoading] = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/duels')
      if (!res.ok) throw new Error('Failed to load')
      const json: { duels: Duel[] } = await res.json()
      setDuels(json.duels ?? [])
    } catch {
      setError('Could not load duels. Please refresh.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const active = duels.filter((d) => d.status === 'active' && !d.is_expired)
  const closed = duels.filter((d) => d.status === 'closed' || d.is_expired)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-amber-900 via-stone-800 to-stone-900 p-6 border border-amber-800/40 shadow-lg">
        <div className="flex items-center gap-3 mb-1">
          <Swords className="w-7 h-7 text-amber-300" />
          <h1 className="text-3xl font-extrabold font-display tracking-tight text-amber-100">Song Duels</h1>
        </div>
        <p className="text-amber-200/70 text-sm">Two songs enter, one song wins. Swipe to vote.</p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
        </div>
      )}

      {error && !isLoading && (
        <div className="bg-red-950/30 border border-red-800 rounded-xl p-4 text-sm text-red-400">{error}</div>
      )}

      {!isLoading && !error && duels.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Swords className="w-12 h-12 text-stone-700 mb-3" />
          <p className="text-stone-500 font-medium">No duels yet</p>
          <p className="text-stone-600 text-sm mt-1">Check back soon for new matchups</p>
        </div>
      )}

      {!isLoading && active.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-stone-400 uppercase tracking-wide px-1">Live Now</h2>
          {active.map((d) => (
            <DuelCard key={d.id} duel={d} onClick={() => router.push(`/duels/${d.id}`)} />
          ))}
        </div>
      )}

      {!isLoading && closed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-stone-400 uppercase tracking-wide px-1">Past Duels</h2>
          {closed.map((d) => (
            <DuelCard key={d.id} duel={d} onClick={() => router.push(`/duels/${d.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}
