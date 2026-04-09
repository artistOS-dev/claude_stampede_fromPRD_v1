'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Trophy, Timer, Users, Coins, ChevronRight, Flame, Loader2 } from 'lucide-react'

// ── Types (mirroring the API response shape) ──────────────────

interface RodeoFeedEntry {
  id: string
  status: string
  circle_id: string | null
  artist_id: string | null
  credits_contributed: number
  circles: { id: string; name: string } | null
  profiles: { id: string; display_name: string } | null
}

interface RodeoFeedResult {
  circle_member_votes: number
  general_public_votes: number
  winner_circle_id: string | null
  winner_artist_id: string | null
  finalized_at: string | null
}

interface RodeoFeedItem {
  id: string
  type: string
  status: string
  title: string
  description: string | null
  start_date: string | null
  end_date: string | null
  created_at: string
  credit_pools: { total: number } | null
  rodeo_entries: RodeoFeedEntry[]
  rodeo_results: RodeoFeedResult[] | RodeoFeedResult | null
}

// ── Constants ─────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'showdown', label: 'Showdown' },
  { value: 'whale', label: 'Whale' },
  { value: 'grassroots', label: 'Grassroots' },
  { value: 'artist_vs_artist', label: 'Artist vs Artist' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'voting', label: 'Voting' },
  { value: 'closed', label: 'Closed' },
  { value: 'archived', label: 'Archived' },
]

const TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  showdown: { bg: 'bg-red-900/30', text: 'text-red-400', label: 'Showdown' },
  whale: { bg: 'bg-blue-900/30', text: 'text-blue-400', label: 'Whale' },
  grassroots: { bg: 'bg-green-900/30', text: 'text-green-400', label: 'Grassroots' },
  artist_vs_artist: { bg: 'bg-purple-900/30', text: 'text-purple-400', label: 'Artist vs Artist' },
}

const STATUS_STYLES: Record<string, { dot: string; label: string }> = {
  pending: { dot: 'bg-yellow-400', label: 'Pending' },
  open: { dot: 'bg-blue-400', label: 'Open' },
  voting: { dot: 'bg-green-950/300 animate-pulse', label: 'Voting Live' },
  closed: { dot: 'bg-zinc-500', label: 'Closed' },
  archived: { dot: 'bg-zinc-600', label: 'Archived' },
}

// ── Helpers ───────────────────────────────────────────────────

function formatCredits(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`
  return amount.toFixed(0)
}

function getCountdown(endDate: string | null): string | null {
  if (!endDate) return null
  const diff = new Date(endDate).getTime() - Date.now()
  if (diff <= 0) return 'Ended'
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function getEntryNames(entries: RodeoFeedEntry[]): string[] {
  return entries
    .filter((e) => e.status !== 'withdrawn')
    .map((e) => e.circles?.name ?? e.profiles?.display_name ?? 'Unknown')
}

function getTotalVotes(result: RodeoFeedResult[] | RodeoFeedResult | null): number {
  if (!result) return 0
  const r = Array.isArray(result) ? result[0] : result
  if (!r) return 0
  return (r.circle_member_votes ?? 0) + (r.general_public_votes ?? 0)
}

// ── Component ─────────────────────────────────────────────────

export default function RodeoFeedPage() {
  const router = useRouter()
  const [rodeos, setRodeos] = useState<RodeoFeedItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  const loadRodeos = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (typeFilter) params.set('type', typeFilter)
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/rodeos?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load rodeos')
      const data: { rodeos: RodeoFeedItem[] } = await res.json()
      setRodeos(data.rodeos ?? [])
    } catch {
      setError('Could not load rodeos. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [typeFilter, statusFilter])

  useEffect(() => {
    loadRodeos()
  }, [loadRodeos])

  // Client-side text search across title, description, entry names
  const filtered = search.trim()
    ? rodeos.filter((r) => {
        const q = search.toLowerCase()
        if (r.title.toLowerCase().includes(q)) return true
        if (r.description?.toLowerCase().includes(q)) return true
        const names = getEntryNames(r.rodeo_entries ?? [])
        return names.some((n) => n.toLowerCase().includes(q))
      })
    : rodeos

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Rodeo Feed</h1>
          <p className="text-zinc-500 mt-1">
            Competitive events where Circles and artists put their music on the line
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/rodeos/challenge')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-sm font-semibold transition-colors shrink-0 shadow-sm"
        >
          <Trophy className="w-4 h-4" /> Challenge
        </button>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search rodeos, circles, or artists…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            aria-label="Search rodeos"
          />
        </div>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-pink-500"
          aria-label="Filter by type"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-pink-500"
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-pink-400 animate-spin" aria-label="Loading" />
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="bg-red-950/30 border border-red-800 rounded-xl p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Trophy className="w-12 h-12 text-zinc-700 mb-3" aria-hidden="true" />
          <p className="text-zinc-500 font-medium">No rodeos found</p>
          <p className="text-sm text-zinc-600 mt-1">Check back later or adjust your filters</p>
          {(search || typeFilter || statusFilter) && (
            <button
              type="button"
              onClick={() => { setSearch(''); setTypeFilter(''); setStatusFilter('') }}
              className="mt-3 text-sm text-pink-400 hover:text-pink-300 font-medium"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Rodeo cards */}
      {!isLoading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((rodeo) => (
            <RodeoCard key={rodeo.id} rodeo={rodeo} onClick={() => router.push(`/rodeos/${rodeo.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Rodeo Card ────────────────────────────────────────────────

function RodeoCard({ rodeo, onClick }: { rodeo: RodeoFeedItem; onClick: () => void }) {
  const typeStyle = TYPE_COLORS[rodeo.type] ?? TYPE_COLORS.showdown
  const statusStyle = STATUS_STYLES[rodeo.status] ?? STATUS_STYLES.pending
  const entryNames = getEntryNames(rodeo.rodeo_entries ?? [])
  const prizePool = rodeo.credit_pools?.total ?? 0
  const totalVotes = getTotalVotes(rodeo.rodeo_results)
  const countdown = rodeo.status === 'voting' ? getCountdown(rodeo.end_date) : null
  const isLive = rodeo.status === 'voting'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left bg-zinc-900 rounded-2xl border shadow-sm p-5 transition-all hover:shadow-md group ${
        isLive ? 'border-pink-700 ring-1 ring-pink-500/20' : 'border-zinc-700 hover:border-pink-800'
      }`}
      aria-label={`View rodeo: ${rodeo.title}`}
    >
      {/* Top row: type badge + status + countdown */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${typeStyle.bg} ${typeStyle.text}`}>
          {typeStyle.label}
        </span>

        <span className="flex items-center gap-1.5 text-xs text-zinc-500">
          <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} aria-hidden="true" />
          {statusStyle.label}
        </span>

        {isLive && countdown && (
          <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-pink-400 bg-pink-950/20 px-2 py-0.5 rounded-full">
            <Timer className="w-3 h-3" aria-hidden="true" />
            {countdown}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="font-bold text-white text-lg leading-tight group-hover:text-pink-400 transition-colors mb-1">
        {rodeo.title}
      </h3>

      {/* Description */}
      {rodeo.description && (
        <p className="text-sm text-zinc-500 line-clamp-2 mb-3">{rodeo.description}</p>
      )}

      {/* Matchup */}
      {entryNames.length >= 2 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-semibold text-zinc-100 truncate max-w-[40%]">
            {entryNames[0]}
          </span>
          <span className="flex-shrink-0 text-xs font-bold text-pink-400 bg-pink-950/20 px-2 py-0.5 rounded-full">
            VS
          </span>
          <span className="text-sm font-semibold text-zinc-100 truncate max-w-[40%]">
            {entryNames[1]}
          </span>
        </div>
      )}

      {entryNames.length === 1 && (
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-3.5 h-3.5 text-zinc-600" aria-hidden="true" />
          <span className="text-sm text-zinc-400">{entryNames[0]}</span>
          <span className="text-xs text-zinc-600">— awaiting challenger</span>
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-4 pt-3 border-t border-zinc-800">
        {/* Prize pool */}
        <div className="flex items-center gap-1.5">
          <Coins className="w-4 h-4 text-yellow-400" aria-hidden="true" />
          <span className="text-sm font-semibold text-zinc-300">
            {prizePool > 0 ? formatCredits(prizePool) : '—'}
          </span>
          <span className="text-xs text-zinc-600">pool</span>
        </div>

        {/* Vote tally */}
        {(rodeo.status === 'voting' || rodeo.status === 'closed' || rodeo.status === 'archived') && (
          <div className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-pink-400" aria-hidden="true" />
            <span className="text-sm font-semibold text-zinc-300">{totalVotes}</span>
            <span className="text-xs text-zinc-600">votes</span>
          </div>
        )}

        {/* Arrow */}
        <ChevronRight className="w-4 h-4 text-zinc-700 ml-auto group-hover:text-pink-400 transition-colors" aria-hidden="true" />
      </div>
    </button>
  )
}
