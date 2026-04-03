'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Music2, Users, Star, Plus, Trash2, ExternalLink, ArrowLeft, Loader2,
  Trophy, Coins, TrendingUp, TrendingDown, Minus, Crown, Archive,
  ChevronRight, Flame, CheckCircle2,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

interface Song {
  id: string
  title: string
  artist: string
  album: string | null
  spotify_url: string | null
  cover_url: string | null
  avg_rating: number
  rating_count: number
  my_rating: number | null
  created_at: string
  profiles: { display_name: string; avatar_url: string | null } | null
}

interface Artist {
  id: string
  artist_name: string
  created_at: string
  added_by: string
  profiles: { display_name: string } | null
}

// ── Helpers ───────────────────────────────────────────────────

function formatCredits(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(0)
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const TYPE_LABELS: Record<string, string> = {
  showdown: 'Showdown',
  whale: 'Whale',
  grassroots: 'Grassroots',
  artist_vs_artist: 'Artist vs Artist',
}

const RESULT_STYLES = {
  win:     { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  badge: 'bg-green-100 text-green-700',  label: 'Win',     icon: TrendingUp },
  loss:    { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    badge: 'bg-red-100 text-red-600',      label: 'Loss',    icon: TrendingDown },
  draw:    { bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-600',   badge: 'bg-gray-100 text-gray-600',    label: 'Draw',    icon: Minus },
  pending: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700',label: 'Pending', icon: Loader2 },
}

// ── RodeoHistoryTab ───────────────────────────────────────────

function RodeoHistoryTab({
  data,
  loading,
  error,
  onNavigate,
  onNavigateCircle,
}: {
  data: RodeoHistoryData | null
  loading: boolean
  error: string | null
  onNavigate: (rodeoId: string) => void
  onNavigateCircle: (circleId: string) => void
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-600">
        {error}
      </div>
    )
  }

  if (!data) return null

  const { record, rodeos, artist_records } = data

  return (
    <div className="space-y-8">

      {/* ── Overall record ── */}
      <div className="bg-gradient-to-br from-orange-500 to-rose-500 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5" />
          <h2 className="font-bold text-lg">Circle Rodeo Record</h2>
        </div>

        {/* W-L-D row */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Wins', value: record.wins, sub: `${record.win_pct}% win rate` },
            { label: 'Losses', value: record.losses, sub: `${record.total} total` },
            { label: 'Draws', value: record.draws, sub: record.draws === 1 ? '1 draw' : `${record.draws} draws` },
          ].map((s) => (
            <div key={s.label} className="bg-white/20 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-white/80 mt-0.5">{s.label}</div>
              <div className="text-xs text-white/60 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Credits row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Credits Earned', value: formatCredits(record.credits_earned), positive: true },
            { label: 'Credits Staked', value: formatCredits(record.credits_contributed), positive: null },
            { label: 'Net Credits', value: `${record.credits_net >= 0 ? '+' : ''}${formatCredits(record.credits_net)}`, positive: record.credits_net >= 0 },
          ].map((s) => (
            <div key={s.label} className="bg-white/10 rounded-xl p-3 text-center">
              <div className={`text-lg font-bold ${s.positive === true ? 'text-green-300' : s.positive === false ? 'text-red-300' : 'text-white'}`}>
                {s.value}
              </div>
              <div className="text-xs text-white/70 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Artist records ── */}
      {artist_records.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <Crown className="w-5 h-5 text-orange-500" />
            Artist Rodeo Records
          </h2>
          <div className="grid gap-3">
            {artist_records.map((a) => (
              <div key={a.artist_name} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                  <Music2 className="w-5 h-5 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 truncate">{a.artist_name}</span>
                    {a.is_core_artist && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-medium">Core Artist</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-gray-500">
                    <span className="font-semibold text-green-600">{a.wins}W</span>
                    <span className="font-semibold text-red-500">{a.losses}L</span>
                    <span className="text-gray-400">·</span>
                    <span>{a.songs_fielded} song{a.songs_fielded !== 1 ? 's' : ''} fielded</span>
                    <span className="text-gray-400">·</span>
                    <span>Avg {a.avg_score.toFixed(1)} pts</span>
                    {a.credits_earned > 0 && (
                      <>
                        <span className="text-gray-400">·</span>
                        <span className="text-yellow-600 flex items-center gap-0.5">
                          <Coins className="w-3 h-3" />{formatCredits(a.credits_earned)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {/* Win pct bar */}
                <div className="w-16 shrink-0">
                  <div className="text-xs text-gray-400 text-right mb-1">
                    {a.rodeos > 0 ? `${Math.round((a.wins / a.rodeos) * 100)}%` : '—'}
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-400 rounded-full"
                      style={{ width: a.rodeos > 0 ? `${(a.wins / a.rodeos) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Per-rodeo history ── */}
      <div className="space-y-3">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          Rodeo Log
          <span className="text-sm font-normal text-gray-400">({rodeos.length} rodeo{rodeos.length !== 1 ? 's' : ''})</span>
        </h2>

        {rodeos.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Trophy className="w-10 h-10 mx-auto mb-2" />
            <p className="font-medium">No rodeo history yet</p>
            <p className="text-sm mt-1">Completed rodeos will appear here</p>
          </div>
        )}

        {rodeos.map((rodeo) => (
          <RodeoHistoryCard
            key={rodeo.rodeo_id}
            rodeo={rodeo}
            onNavigate={onNavigate}
            onNavigateCircle={onNavigateCircle}
          />
        ))}
      </div>

    </div>
  )
}

// ── RodeoHistoryCard ──────────────────────────────────────────

function RodeoHistoryCard({
  rodeo,
  onNavigate,
  onNavigateCircle,
}: {
  rodeo: RodeoHistoryEntry
  onNavigate: (id: string) => void
  onNavigateCircle: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const style = RESULT_STYLES[rodeo.result]
  const ResultIcon = style.icon
  const maxScore = Math.max(...rodeo.songs.map((s) => s.weighted_score), 0.1)

  return (
    <div className={`rounded-2xl border overflow-hidden ${style.border}`}>
      {/* Card header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`w-full flex items-start gap-4 p-4 text-left ${style.bg} hover:brightness-95 transition-all`}
        aria-expanded={expanded}
      >
        {/* Result badge */}
        <div className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold mt-0.5 ${style.badge}`}>
          <ResultIcon className="w-3 h-3" />
          {style.label}
        </div>

        <div className="flex-1 min-w-0">
          {/* Title + type */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 truncate">{rodeo.title}</span>
            <span className="text-xs text-gray-400">{TYPE_LABELS[rodeo.type] ?? rodeo.type}</span>
            {rodeo.archived && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Archive className="w-3 h-3" />Archived
              </span>
            )}
          </div>

          {/* Opponent + date */}
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
            {rodeo.opponent ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onNavigateCircle(rodeo.opponent!.id) }}
                className="flex items-center gap-1 hover:text-orange-600 transition-colors"
              >
                <span>vs {rodeo.opponent.name}</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            ) : (
              <span>vs —</span>
            )}
            <span className="text-gray-300">·</span>
            <span>{formatDate(rodeo.date)}</span>
          </div>
        </div>

        {/* Credits net */}
        <div className="shrink-0 text-right">
          <div className={`text-sm font-bold ${rodeo.credits_net >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {rodeo.credits_net >= 0 ? '+' : ''}{formatCredits(rodeo.credits_net)}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">credits</div>
        </div>

        <ChevronRight className={`w-4 h-4 text-gray-400 shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="bg-white border-t border-gray-100 p-4 space-y-4">

          {/* Vote breakdown */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-purple-50 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-purple-700">{rodeo.votes.circle_member}</div>
              <div className="text-xs text-purple-500 mt-0.5">Circle Member Votes (2×)</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-blue-700">{rodeo.votes.general_public}</div>
              <div className="text-xs text-blue-500 mt-0.5">General Public Votes (1×)</div>
            </div>
          </div>

          {/* Songs fielded */}
          {rodeo.songs.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Songs Fielded</h4>
              <div className="space-y-2">
                {rodeo.songs
                  .sort((a, b) => b.weighted_score - a.weighted_score)
                  .map((song, i) => (
                    <div key={song.song_id} className="flex items-center gap-3">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                        {i === 0 ? <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" /> : i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium text-gray-900 truncate">{song.title}</span>
                          {song.label && (
                            <span className={`text-xs px-1 py-0.5 rounded font-medium ${song.label === 'live' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                              {song.label === 'live' ? 'Live' : 'Studio'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-orange-300 rounded-full"
                              style={{ width: `${(song.weighted_score / maxScore) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 whitespace-nowrap tabular-nums">
                            {song.circle_member_votes}cm · {song.general_public_votes}gp · {song.weighted_score.toFixed(1)}pts
                          </span>
                        </div>
                        <div className="text-xs text-gray-400">{song.artist}</div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Credits breakdown */}
          <div className="flex items-center gap-4 text-sm pt-2 border-t border-gray-100 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">Staked:</span>
              <span className="font-medium text-gray-700">{formatCredits(rodeo.credits_contributed)}</span>
            </div>
            {rodeo.credits_won > 0 && (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-gray-500">Won:</span>
                <span className="font-medium text-green-600">{formatCredits(rodeo.credits_won)}</span>
              </div>
            )}
            {rodeo.finalized_at && (
              <span className="ml-auto text-xs text-gray-400">
                Finalized {formatDate(rodeo.finalized_at)}
              </span>
            )}
          </div>

          {/* View full rodeo link */}
          <button
            type="button"
            onClick={() => onNavigate(rodeo.rodeo_id)}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm text-orange-600 hover:text-orange-700 font-medium border border-orange-200 rounded-xl hover:bg-orange-50 transition-colors"
          >
            View full rodeo <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

function StarRating({
  value,
  interactive,
  onRate,
}: {
  value: number
  interactive?: boolean
  onRate?: (rating: number) => void
}) {
  const [hovered, setHovered] = useState(0)
  const display = hovered || value

  return (
    <div className="flex items-center gap-0.5" aria-label={`Rating: ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => onRate?.(star)}
          onMouseEnter={() => interactive && setHovered(star)}
          onMouseLeave={() => interactive && setHovered(0)}
          className={`focus:outline-none ${interactive ? 'cursor-pointer' : 'cursor-default'}`}
          aria-label={interactive ? `Rate ${star} stars` : undefined}
        >
          <Star
            className={`w-4 h-4 transition-colors ${
              star <= display
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-200 fill-gray-200'
            }`}
          />
        </button>
      ))}
    </div>
  )
}

// ── Rodeo History types ───────────────────────────────────────

interface RodeoSongEntry {
  song_id: string
  title: string
  artist: string
  label: 'studio' | 'live' | null
  total_votes: number
  weighted_score: number
  circle_member_votes: number
  general_public_votes: number
}

interface RodeoHistoryEntry {
  rodeo_id: string
  title: string
  type: string
  date: string | null
  archived: boolean
  opponent: { id: string; name: string } | null
  result: 'win' | 'loss' | 'draw' | 'pending'
  songs: RodeoSongEntry[]
  votes: { circle_member: number; general_public: number }
  credits_contributed: number
  credits_won: number
  credits_net: number
  finalized_at: string | null
}

interface ArtistRecord {
  artist_name: string
  is_core_artist: boolean
  rodeos: number
  wins: number
  losses: number
  songs_fielded: number
  avg_score: number
  credits_earned: number
}

interface CircleRecord {
  total: number
  wins: number
  losses: number
  draws: number
  win_pct: number
  credits_earned: number
  credits_contributed: number
  credits_net: number
}

interface RodeoHistoryData {
  circle: { id: string; name: string; member_count: number }
  record: CircleRecord
  rodeos: RodeoHistoryEntry[]
  artist_records: ArtistRecord[]
}

export default function CircleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [tab, setTab] = useState<'songs' | 'artists' | 'rodeos'>('songs')

  // Rodeo history state
  const [rodeoHistory, setRodeoHistory] = useState<RodeoHistoryData | null>(null)
  const [rodeoHistoryLoading, setRodeoHistoryLoading] = useState(false)
  const [rodeoHistoryError, setRodeoHistoryError] = useState<string | null>(null)

  // Songs state
  const [songs, setSongs] = useState<Song[]>([])
  const [songsLoading, setSongsLoading] = useState(true)
  const [songsError, setSongsError] = useState<string | null>(null)
  const [showAddSong, setShowAddSong] = useState(false)
  const [songTitle, setSongTitle] = useState('')
  const [songArtist, setSongArtist] = useState('')
  const [songAlbum, setSongAlbum] = useState('')
  const [songSpotify, setSongSpotify] = useState('')
  const [addingSong, setAddingSong] = useState(false)
  const [addSongError, setAddSongError] = useState<string | null>(null)

  // Artists state
  const [artists, setArtists] = useState<Artist[]>([])
  const [artistsLoading, setArtistsLoading] = useState(true)
  const [artistsError, setArtistsError] = useState<string | null>(null)
  const [artistName, setArtistName] = useState('')
  const [addingArtist, setAddingArtist] = useState(false)
  const [addArtistError, setAddArtistError] = useState<string | null>(null)

  const loadSongs = useCallback(async () => {
    setSongsLoading(true)
    setSongsError(null)
    try {
      const res = await fetch(`/api/circles/${id}/songs`)
      if (!res.ok) throw new Error('Failed to load songs')
      const data: { songs: Song[] } = await res.json()
      setSongs(data.songs ?? [])
    } catch {
      setSongsError('Could not load songs.')
    } finally {
      setSongsLoading(false)
    }
  }, [id])

  const loadArtists = useCallback(async () => {
    setArtistsLoading(true)
    setArtistsError(null)
    try {
      const res = await fetch(`/api/circles/${id}/artists`)
      if (!res.ok) throw new Error('Failed to load artists')
      const data: { artists: Artist[] } = await res.json()
      setArtists(data.artists ?? [])
    } catch {
      setArtistsError('Could not load artists.')
    } finally {
      setArtistsLoading(false)
    }
  }, [id])

  const loadRodeoHistory = useCallback(async () => {
    setRodeoHistoryLoading(true)
    setRodeoHistoryError(null)
    try {
      const res = await fetch(`/api/circles/${id}/rodeo-history`)
      if (!res.ok) throw new Error('Failed to load rodeo history')
      const data: RodeoHistoryData = await res.json()
      setRodeoHistory(data)
    } catch {
      setRodeoHistoryError('Could not load rodeo history.')
    } finally {
      setRodeoHistoryLoading(false)
    }
  }, [id])

  useEffect(() => { loadSongs() }, [loadSongs])
  useEffect(() => { loadArtists() }, [loadArtists])
  // Load rodeo history only when that tab is first opened
  useEffect(() => {
    if (tab === 'rodeos' && !rodeoHistory && !rodeoHistoryLoading) {
      loadRodeoHistory()
    }
  }, [tab, rodeoHistory, rodeoHistoryLoading, loadRodeoHistory])

  const handleAddSong = async () => {
    if (!songTitle.trim() || !songArtist.trim()) return
    setAddingSong(true)
    setAddSongError(null)
    try {
      const res = await fetch(`/api/circles/${id}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: songTitle.trim(),
          artist: songArtist.trim(),
          album: songAlbum.trim() || null,
          spotify_url: songSpotify.trim() || null,
        }),
      })
      const data: { success?: boolean; error?: string } = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to add song')
      setSongTitle('')
      setSongArtist('')
      setSongAlbum('')
      setSongSpotify('')
      setShowAddSong(false)
      loadSongs()
    } catch (err) {
      setAddSongError(err instanceof Error ? err.message : 'Failed to add song')
    } finally {
      setAddingSong(false)
    }
  }

  const handleRate = async (songId: string, rating: number) => {
    // Optimistic update
    setSongs((prev) =>
      prev.map((s) => (s.id === songId ? { ...s, my_rating: rating } : s))
    )
    try {
      await fetch(`/api/circles/${id}/songs/${songId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      })
      // Refresh to get updated avg
      loadSongs()
    } catch {
      // Revert on failure
      loadSongs()
    }
  }

  const handleAddArtist = async () => {
    if (!artistName.trim()) return
    setAddingArtist(true)
    setAddArtistError(null)
    try {
      const res = await fetch(`/api/circles/${id}/artists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist_name: artistName.trim() }),
      })
      const data: { success?: boolean; error?: string } = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to add artist')
      setArtistName('')
      loadArtists()
    } catch (err) {
      setAddArtistError(err instanceof Error ? err.message : 'Failed to add artist')
    } finally {
      setAddingArtist(false)
    }
  }

  const handleRemoveArtist = async (artistId: string) => {
    try {
      await fetch(`/api/circles/${id}/artists?artist_id=${artistId}`, { method: 'DELETE' })
      setArtists((prev) => prev.filter((a) => a.id !== artistId))
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-orange-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to circles
      </button>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab('songs')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'songs' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-1.5"><Music2 className="w-4 h-4" />Songs</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('artists')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'artists' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-1.5"><Users className="w-4 h-4" />Artists</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('rodeos')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'rodeos' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-1.5"><Trophy className="w-4 h-4" />Rodeo History</span>
        </button>
      </div>

      {/* ── SONGS TAB ── */}
      {tab === 'songs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">
              Shared Songs <span className="text-gray-400 font-normal text-base">({songs.length})</span>
            </h2>
            <Button variant="primary" onClick={() => setShowAddSong((v) => !v)}>
              <Plus className="w-4 h-4" />
              Share a song
            </Button>
          </div>

          {/* Add song form */}
          {showAddSong && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 space-y-3">
              <h3 className="font-semibold text-gray-900 text-sm">Share a new song</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Song title *"
                  type="text"
                  id="song-title"
                  value={songTitle}
                  onChange={(e) => setSongTitle(e.target.value)}
                  placeholder="e.g. Fast Car"
                />
                <Input
                  label="Artist *"
                  type="text"
                  id="song-artist"
                  value={songArtist}
                  onChange={(e) => setSongArtist(e.target.value)}
                  placeholder="e.g. Tracy Chapman"
                />
                <Input
                  label="Album"
                  type="text"
                  id="song-album"
                  value={songAlbum}
                  onChange={(e) => setSongAlbum(e.target.value)}
                  placeholder="Optional"
                />
                <Input
                  label="Spotify link"
                  type="url"
                  id="song-spotify"
                  value={songSpotify}
                  onChange={(e) => setSongSpotify(e.target.value)}
                  placeholder="https://open.spotify.com/…"
                />
              </div>
              {addSongError && (
                <p className="text-sm text-red-600">{addSongError}</p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  loading={addingSong}
                  disabled={!songTitle.trim() || !songArtist.trim()}
                  onClick={handleAddSong}
                >
                  Share
                </Button>
                <Button variant="secondary" onClick={() => setShowAddSong(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {songsLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
            </div>
          )}

          {songsError && !songsLoading && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-4">{songsError}</p>
          )}

          {!songsLoading && !songsError && songs.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Music2 className="w-10 h-10 mx-auto mb-2" />
              <p className="font-medium">No songs yet</p>
              <p className="text-sm mt-1">Be the first to share a song with this circle</p>
            </div>
          )}

          {!songsLoading && songs.map((song) => (
            <div
              key={song.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-start gap-4"
            >
              {/* Cover placeholder */}
              <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Music2 className="w-6 h-6 text-orange-500" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{song.title}</p>
                    <p className="text-sm text-gray-500 truncate">{song.artist}{song.album ? ` · ${song.album}` : ''}</p>
                  </div>
                  {song.spotify_url && (
                    <a
                      href={song.spotify_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-green-600 hover:text-green-700"
                      aria-label="Open in Spotify"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>

                <div className="mt-2 flex items-center gap-4 flex-wrap">
                  {/* Community avg */}
                  <div className="flex items-center gap-1.5">
                    <StarRating value={Math.round(song.avg_rating)} />
                    <span className="text-xs text-gray-400">
                      {song.avg_rating > 0 ? song.avg_rating.toFixed(1) : '—'}
                      {song.rating_count > 0 && ` (${song.rating_count})`}
                    </span>
                  </div>

                  {/* My rating */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">My rating:</span>
                    <StarRating
                      value={song.my_rating ?? 0}
                      interactive
                      onRate={(r) => handleRate(song.id, r)}
                    />
                  </div>
                </div>

                {song.profiles && (
                  <p className="text-xs text-gray-400 mt-1.5">
                    Shared by {song.profiles.display_name}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── RODEO HISTORY TAB ── */}
      {tab === 'rodeos' && (
        <RodeoHistoryTab
          data={rodeoHistory}
          loading={rodeoHistoryLoading}
          error={rodeoHistoryError}
          onNavigate={(rodeoId) => router.push(`/rodeos/${rodeoId}`)}
          onNavigateCircle={(cId) => router.push(`/circles/${cId}`)}
        />
      )}

      {/* ── ARTISTS TAB ── */}
      {tab === 'artists' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">
              Favourite Artists <span className="text-gray-400 font-normal text-base">({artists.length})</span>
            </h2>
          </div>

          {/* Add artist form */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                label=""
                type="text"
                id="artist-name"
                value={artistName}
                onChange={(e) => { setArtistName(e.target.value); setAddArtistError(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddArtist() }}
                placeholder="Artist name…"
              />
            </div>
            <div className="pt-0.5">
              <Button
                variant="primary"
                loading={addingArtist}
                disabled={!artistName.trim()}
                onClick={handleAddArtist}
                className="mt-0.5"
              >
                <Plus className="w-4 h-4" />
                Add
              </Button>
            </div>
          </div>
          {addArtistError && (
            <p className="text-sm text-red-600">{addArtistError}</p>
          )}

          {artistsLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
            </div>
          )}

          {artistsError && !artistsLoading && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-4">{artistsError}</p>
          )}

          {!artistsLoading && !artistsError && artists.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-2" />
              <p className="font-medium">No favourite artists yet</p>
              <p className="text-sm mt-1">Add artists this circle loves</p>
            </div>
          )}

          {!artistsLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {artists.map((artist) => (
                <div
                  key={artist.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <Music2 className="w-5 h-5 text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{artist.artist_name}</p>
                    {artist.profiles && (
                      <p className="text-xs text-gray-400">Added by {artist.profiles.display_name}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveArtist(artist.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                    aria-label={`Remove ${artist.artist_name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
