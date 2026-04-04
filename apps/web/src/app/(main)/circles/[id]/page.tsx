'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Music2, Users, Star, Plus, Trash2, ExternalLink, ArrowLeft, Loader2,
  Trophy, Coins, TrendingUp, TrendingDown, Minus, Crown, Archive,
  ChevronRight, Flame, CheckCircle2, ThumbsUp, PauseCircle, XCircle,
  AlertCircle, Swords,
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
  tier?: 'rising_star' | 'young_buck' | 'core' | 'legacy'
  promotion_eligible?: boolean
  rodeo_wins?: number
  rodeo_appearances?: number
}

interface NominationBudget {
  id: string
  young_buck_slots: number
  rising_star_slots: number
  young_buck_used: number
  rising_star_used: number
  period_end: string
}

interface Nomination {
  id: string
  artist_name: string
  tier_target: 'young_buck' | 'core'
  status: string
  votes_for: number
  votes_against: number
  message: string | null
  created_at: string
}

interface FeedEvent {
  id: string
  event_type: string
  actor_id: string | null
  rodeo_id: string | null
  nomination_id: string | null
  payload: Record<string, unknown>
  board_only: boolean
  created_at: string
}

const TIER_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  rising_star: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Rising Star' },
  young_buck:  { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Young Buck' },
  core:        { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Core' },
  legacy:      { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Legacy' },
}

const EVENT_ICONS: Record<string, string> = {
  challenge_sent:        '⚔️',
  challenge_received:    '📨',
  challenge_accepted:    '✅',
  challenge_declined:    '❌',
  rodeo_opened:          '🤠',
  vote_milestone:        '📊',
  result_posted:         '🏆',
  artist_promoted:       '⬆️',
  credits_distributed:   '💰',
  budget_reset:          '🔄',
  board_approval_pending:'⏳',
  nomination_passed:     '🗳️',
  nomination_inducted:   '🎤',
}

function FeedEventCard({ event }: { event: FeedEvent }) {
  const icon = EVENT_ICONS[event.event_type] ?? '📌'
  const label = event.event_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const payload = event.payload as Record<string, string>

  return (
    <div className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0 text-base">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {payload.artist_name && (
          <p className="text-xs text-gray-500 truncate">Artist: {payload.artist_name}</p>
        )}
        {payload.action && (
          <p className="text-xs text-gray-400 truncate capitalize">{String(payload.action).replace(/_/g, ' ')}</p>
        )}
        <p className="text-xs text-gray-400 mt-0.5">{formatDate(event.created_at)}</p>
      </div>
      {event.board_only && (
        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full h-fit self-center flex-shrink-0">
          Board
        </span>
      )}
    </div>
  )
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

// ── BoardInboxTab ─────────────────────────────────────────────

function BoardInboxTab({
  data,
  loading,
  error,
  isBoardMember,
  circleId,
  onVoted,
  onNewChallenge,
  onViewRodeo,
}: {
  data: BoardData | null
  loading: boolean
  error: string | null
  isBoardMember: boolean | null
  circleId: string
  onVoted: () => void
  onNewChallenge: () => void
  onViewRodeo: (id: string) => void
}) {
  const [boardMembers, setBoardMembers] = useState<CircleBoardMember[]>([])
  const [myRole, setMyRole] = useState<'member' | 'board' | 'founder' | null>(null)
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersError, setMembersError] = useState<string | null>(null)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)

  const loadBoardMembers = useCallback(async () => {
    setMembersLoading(true)
    setMembersError(null)
    try {
      const res = await fetch(`/api/circles/${circleId}/board-members`)
      if (!res.ok) throw new Error('Failed to load board members')
      const json: { my_role: 'member' | 'board' | 'founder'; members: CircleBoardMember[] } = await res.json()
      setMyRole(json.my_role)
      setBoardMembers(json.members ?? [])
    } catch {
      setMembersError('Could not load board management data.')
    } finally {
      setMembersLoading(false)
    }
  }, [circleId])

  useEffect(() => {
    if (isBoardMember === false) return
    loadBoardMembers()
  }, [isBoardMember, loadBoardMembers])

  const updateBoardRole = async (userId: string, nextRole: 'member' | 'board') => {
    setUpdatingUserId(userId)
    setMembersError(null)
    try {
      const res = await fetch(`/api/circles/${circleId}/board-members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role: nextRole }),
      })
      const json: { error?: string } = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not update member role')
      await loadBoardMembers()
    } catch (e) {
      setMembersError(e instanceof Error ? e.message : 'Could not update member role')
    } finally {
      setUpdatingUserId(null)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-orange-500 animate-spin" /></div>
  }

  if (isBoardMember === false) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center space-y-2">
        <Crown className="w-10 h-10 text-amber-400 mx-auto" />
        <p className="font-semibold text-amber-900">Board access required</p>
        <p className="text-sm text-amber-700">Only board members and founders can view the board inbox.</p>
      </div>
    )
  }

  if (error) {
    return <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-600">{error}</div>
  }

  if (!data) return null

  const pending = data.proposals.filter((p) => p.status === 'pending')
  const past    = data.proposals.filter((p) => p.status !== 'pending')

  return (
    <div className="space-y-6">
      {/* Board management */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Board management</h3>
          {myRole && (
            <span className="text-xs px-2 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200 capitalize">
              You are {myRole}
            </span>
          )}
        </div>

        {membersLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading members…
          </div>
        )}

        {membersError && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{membersError}</div>
        )}

        {!membersLoading && boardMembers.length > 0 && (
          <div className="space-y-2">
            {boardMembers.map((member) => {
              const canEdit = myRole === 'founder' && member.role !== 'founder'
              const promote = member.role === 'member'
              const demote = member.role === 'board'

              return (
                <div key={member.user_id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {member.display_name ?? member.email ?? 'Member'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{member.email ?? member.user_id}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                      member.role === 'founder'
                        ? 'bg-yellow-100 text-yellow-700'
                        : member.role === 'board'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {member.role}
                    </span>
                    {canEdit && promote && (
                      <button
                        type="button"
                        onClick={() => updateBoardRole(member.user_id, 'board')}
                        disabled={updatingUserId === member.user_id}
                        className="text-xs px-2.5 py-1 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
                      >
                        Make board
                      </button>
                    )}
                    {canEdit && demote && (
                      <button
                        type="button"
                        onClick={() => updateBoardRole(member.user_id, 'member')}
                        disabled={updatingUserId === member.user_id}
                        className="text-xs px-2.5 py-1 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                      >
                        Remove board
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {myRole !== 'founder' && !membersLoading && (
          <p className="text-xs text-gray-500">
            Only founders can change board roles.
          </p>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <Crown className="w-5 h-5 text-orange-500" />
          Board Inbox
        </h2>
        <button
          type="button"
          onClick={onNewChallenge}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors"
        >
          <Swords className="w-4 h-4" /> New Challenge
        </button>
      </div>

      {/* Pending proposals */}
      {pending.length === 0 && past.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Crown className="w-10 h-10 mx-auto mb-2" />
          <p className="font-medium">No pending challenge proposals</p>
          <p className="text-sm mt-1">Start a new challenge to put it before the board.</p>
        </div>
      )}

      {pending.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
            Pending approval ({pending.length})
          </h3>
          {pending.map((p) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              circleId={circleId}
              boardSeatCount={data.board_seat_count}
              myUserId={data.my_user_id}
              onVoted={onVoted}
              onViewRodeo={onViewRodeo}
            />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Past proposals</h3>
          {past.map((p) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              circleId={circleId}
              boardSeatCount={data.board_seat_count}
              myUserId={data.my_user_id}
              onVoted={onVoted}
              onViewRodeo={onViewRodeo}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── ProposalCard ──────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; border: string; badge: string; label: string }> = {
  pending:  { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', label: 'Pending' },
  approved: { bg: 'bg-green-50',  border: 'border-green-200',  badge: 'bg-green-100 text-green-700',   label: 'Approved' },
  held:     { bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-700', label: 'Held' },
  declined: { bg: 'bg-red-50',    border: 'border-red-200',    badge: 'bg-red-100 text-red-600',       label: 'Declined' },
  sent:     { bg: 'bg-blue-50',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700',     label: 'Sent' },
}

function ProposalCard({
  proposal,
  circleId,
  boardSeatCount,
  myUserId,
  onVoted,
  onViewRodeo,
}: {
  proposal: ChallengeProposal
  circleId: string
  boardSeatCount: number
  myUserId: string
  onVoted: () => void
  onViewRodeo: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [votingState, setVotingState] = useState<'idle' | 'pending' | 'done' | 'error'>('idle')
  const [voteError, setVoteError] = useState<string | null>(null)
  const [comment, setComment] = useState('')

  const style = STATUS_STYLE[proposal.status] ?? STATUS_STYLE.pending
  const isPending = proposal.status === 'pending'
  const myVote = proposal.challenge_proposal_votes.find((v) => v.voter_id === myUserId)

  const tally = { approve: 0, hold: 0, decline: 0 }
  for (const v of proposal.challenge_proposal_votes) {
    tally[v.vote]++
  }
  const majority = Math.floor(boardSeatCount / 2) + 1

  const castVote = async (vote: 'approve' | 'hold' | 'decline') => {
    setVoteError(null)
    setVotingState('pending')
    try {
      const res = await fetch(`/api/circles/${circleId}/challenge-proposals/${proposal.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote, comment: comment.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Vote failed')
      setVotingState('done')
      setComment('')
      onVoted()
    } catch (e) {
      setVoteError(e instanceof Error ? e.message : 'Vote failed')
      setVotingState('error')
    }
  }

  return (
    <div className={`rounded-2xl border overflow-hidden ${style.border}`}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`w-full text-left flex items-start gap-3 p-4 ${style.bg} hover:brightness-[0.97] transition-all`}
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${style.badge}`}>{style.label}</span>
            <span className="font-semibold text-gray-900 truncate text-sm">{proposal.title}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
            <span>vs <strong>{proposal.target?.name ?? '—'}</strong></span>
            <span className="text-gray-300">·</span>
            <span>{formatCredits(proposal.credit_buy_in)} credits per side</span>
            <span className="text-gray-300">·</span>
            <span>by {proposal.profiles?.display_name ?? '—'}</span>
          </div>
        </div>
        {/* Tally pills */}
        <div className="flex items-center gap-1.5 shrink-0">
          <TallyPill count={tally.approve} needed={majority} icon="approve" />
          <TallyPill count={tally.hold}    needed={majority} icon="hold" />
          <TallyPill count={tally.decline} needed={majority} icon="decline" />
        </div>
        <ChevronRight className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="bg-white border-t border-gray-100 p-4 space-y-4">

          {/* Storyline */}
          {proposal.description && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Storyline</p>
              <p className="text-sm text-gray-700 leading-relaxed">{proposal.description}</p>
            </div>
          )}

          {/* Songs */}
          {proposal.challenge_proposal_songs.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Songs on the Line</p>
              <div className="space-y-1.5">
                {proposal.challenge_proposal_songs.map((s) => (
                  <div key={s.song_id} className="flex items-center gap-2 text-sm">
                    <Music2 className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <span className="font-medium text-gray-800 truncate">{s.circle_songs?.title ?? 'Untitled'}</span>
                    <span className="text-gray-400 truncate">{s.circle_songs?.artist}</span>
                    {s.label && (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${s.label === 'live' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                        {s.label === 'live' ? 'Live' : 'Studio'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Board vote breakdown — always visible */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Board vote ({proposal.challenge_proposal_votes.length}/{boardSeatCount} cast · majority = {majority})
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(['approve', 'hold', 'decline'] as const).map((v) => (
                <div key={v} className={`rounded-xl p-3 text-center ${
                  v === 'approve' ? 'bg-green-50' : v === 'hold' ? 'bg-yellow-50' : 'bg-red-50'
                }`}>
                  <div className={`text-xl font-bold ${v === 'approve' ? 'text-green-700' : v === 'hold' ? 'text-yellow-700' : 'text-red-600'}`}>
                    {tally[v]}
                  </div>
                  <div className={`text-xs mt-0.5 capitalize ${v === 'approve' ? 'text-green-600' : v === 'hold' ? 'text-yellow-600' : 'text-red-500'}`}>
                    {v}
                  </div>
                  {tally[v] >= majority && (
                    <div className="text-xs text-gray-400 mt-0.5">✓ majority</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Board comment (hold/decline) */}
          {proposal.board_comment && (
            <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600">
              <span className="font-medium text-gray-700">Board note: </span>
              {proposal.board_comment}
            </div>
          )}

          {/* If sent → link to rodeo */}
          {proposal.status === 'sent' && proposal.rodeo_id && (
            <button
              type="button"
              onClick={() => onViewRodeo(proposal.rodeo_id!)}
              className="w-full flex items-center justify-center gap-2 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors"
            >
              View Rodeo <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {/* Vote UI (pending only) */}
          {isPending && (
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Your vote {myVote ? `(current: ${myVote.vote})` : ''}
              </p>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Optional comment (required for Decline)…"
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
              />

              {voteError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />{voteError}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <VoteButton
                  label="Approve"
                  icon={<ThumbsUp className="w-4 h-4" />}
                  variant="approve"
                  active={myVote?.vote === 'approve'}
                  disabled={votingState === 'pending'}
                  onClick={() => castVote('approve')}
                />
                <VoteButton
                  label="Hold"
                  icon={<PauseCircle className="w-4 h-4" />}
                  variant="hold"
                  active={myVote?.vote === 'hold'}
                  disabled={votingState === 'pending'}
                  onClick={() => castVote('hold')}
                />
                <VoteButton
                  label="Decline"
                  icon={<XCircle className="w-4 h-4" />}
                  variant="decline"
                  active={myVote?.vote === 'decline'}
                  disabled={votingState === 'pending'}
                  onClick={() => castVote('decline')}
                />
              </div>

              {votingState === 'pending' && (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Recording vote…
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TallyPill({ count, needed, icon }: { count: number; needed: number; label?: string; icon: 'approve' | 'hold' | 'decline' }) {
  const reached = count >= needed
  const colors = {
    approve: reached ? 'bg-green-500 text-white' : 'bg-green-100 text-green-700',
    hold:    reached ? 'bg-yellow-500 text-white' : 'bg-yellow-100 text-yellow-700',
    decline: reached ? 'bg-red-500 text-white' : 'bg-red-100 text-red-600',
  }
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full tabular-nums ${colors[icon]}`}>
      {count}
    </span>
  )
}

function VoteButton({
  label, icon, variant, active, disabled, onClick,
}: {
  label: string
  icon: React.ReactNode
  variant: 'approve' | 'hold' | 'decline'
  active: boolean
  disabled: boolean
  onClick: () => void
}) {
  const base = 'flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all'
  const styles = {
    approve: active ? 'bg-green-500 border-green-500 text-white' : 'border-green-200 text-green-700 hover:bg-green-50',
    hold:    active ? 'bg-yellow-500 border-yellow-500 text-white' : 'border-yellow-200 text-yellow-700 hover:bg-yellow-50',
    decline: active ? 'bg-red-500 border-red-500 text-white' : 'border-red-200 text-red-600 hover:bg-red-50',
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      {icon}{label}
    </button>
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

// ── Board Inbox types ─────────────────────────────────────────

interface ProposalSong {
  song_id: string
  label: 'studio' | 'live' | null
  circle_songs: { id: string; title: string; artist: string } | null
}

interface ProposalVote {
  vote: 'approve' | 'hold' | 'decline'
  voter_id: string
  profiles: { display_name: string; avatar_url: string | null } | null
}

interface ChallengeProposal {
  id: string
  title: string
  description: string | null
  status: 'pending' | 'approved' | 'held' | 'declined' | 'sent'
  credit_buy_in: number
  board_comment: string | null
  rodeo_id: string | null
  created_at: string
  profiles: { display_name: string; avatar_url: string | null } | null
  circles: { id: string; name: string } | null
  target: { id: string; name: string } | null
  challenge_proposal_songs: ProposalSong[]
  challenge_proposal_votes: ProposalVote[]
}

interface BoardData {
  proposals: ChallengeProposal[]
  board_seat_count: number
  my_user_id: string
}

interface CircleBoardMember {
  user_id: string
  role: 'member' | 'board' | 'founder'
  status: 'active' | 'pending' | 'banned'
  joined_at: string
  display_name: string | null
  email: string | null
}

export default function CircleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [tab, setTab] = useState<'songs' | 'artists' | 'rodeos' | 'nominations' | 'feed' | 'board'>('songs')

  // Rodeo history state
  const [rodeoHistory, setRodeoHistory] = useState<RodeoHistoryData | null>(null)
  const [rodeoHistoryLoading, setRodeoHistoryLoading] = useState(false)
  const [rodeoHistoryError, setRodeoHistoryError] = useState<string | null>(null)

  // Board inbox state
  const [boardData, setBoardData] = useState<BoardData | null>(null)
  const [boardLoading, setBoardLoading] = useState(false)
  const [boardError, setBoardError] = useState<string | null>(null)
  const [isBoardMember, setIsBoardMember] = useState<boolean | null>(null)

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

  // Nominations state
  const [nominations, setNominations] = useState<Nomination[]>([])
  const [nominationsLoading, setNominationsLoading] = useState(false)
  const [nominationsError, setNominationsError] = useState<string | null>(null)
  const [budget, setBudget] = useState<NominationBudget | null>(null)
  const [nomArtistName, setNomArtistName] = useState('')
  const [nomTierTarget, setNomTierTarget] = useState<'young_buck' | 'core'>('young_buck')
  const [nomMessage, setNomMessage] = useState('')
  const [submittingNom, setSubmittingNom] = useState(false)
  const [nomError, setNomError] = useState<string | null>(null)
  const [showNomForm, setShowNomForm] = useState(false)

  // Activity feed state
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([])
  const [feedLoading, setFeedLoading] = useState(false)
  const [feedError, setFeedError] = useState<string | null>(null)
  const [feedLoaded, setFeedLoaded] = useState(false)

  // Nominations loaded flag
  const [nominationsLoaded, setNominationsLoaded] = useState(false)

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

  const loadBoardInbox = useCallback(async () => {
    setBoardLoading(true)
    setBoardError(null)
    try {
      const res = await fetch(`/api/circles/${id}/challenge-proposals`)
      if (res.status === 403) { setIsBoardMember(false); return }
      if (!res.ok) throw new Error('Failed to load board inbox')
      const data: BoardData = await res.json()
      setBoardData(data)
      setIsBoardMember(true)
    } catch {
      setBoardError('Could not load board inbox.')
    } finally {
      setBoardLoading(false)
    }
  }, [id])

  const loadNominations = useCallback(async () => {
    setNominationsLoading(true)
    setNominationsError(null)
    try {
      const [nomRes, budgetRes] = await Promise.all([
        fetch(`/api/circles/${id}/nominations`),
        fetch(`/api/circles/${id}/budget`),
      ])
      if (!nomRes.ok) throw new Error('Failed to load nominations')
      const nomData: { nominations: Nomination[] } = await nomRes.json()
      setNominations(nomData.nominations ?? [])
      if (budgetRes.ok) {
        const budgetData: { budget: NominationBudget } = await budgetRes.json()
        setBudget(budgetData.budget)
      }
    } catch {
      setNominationsError('Could not load nominations.')
    } finally {
      setNominationsLoading(false)
      setNominationsLoaded(true)
    }
  }, [id])

  const loadFeed = useCallback(async () => {
    setFeedLoading(true)
    setFeedError(null)
    try {
      const res = await fetch(`/api/circles/${id}/feed`)
      if (!res.ok) throw new Error('Failed to load feed')
      const data: { events: FeedEvent[] } = await res.json()
      setFeedEvents(data.events ?? [])
    } catch {
      setFeedError('Could not load activity feed.')
    } finally {
      setFeedLoading(false)
      setFeedLoaded(true)
    }
  }, [id])

  useEffect(() => { loadSongs() }, [loadSongs])
  useEffect(() => { loadArtists() }, [loadArtists])
  useEffect(() => {
    if (tab === 'rodeos' && !rodeoHistory && !rodeoHistoryLoading) loadRodeoHistory()
  }, [tab, rodeoHistory, rodeoHistoryLoading, loadRodeoHistory])
  useEffect(() => {
    // guard: also stop retrying if isBoardMember was set to false (403 response)
    if (tab === 'board' && !boardData && !boardLoading && isBoardMember !== false) loadBoardInbox()
  }, [tab, boardData, boardLoading, isBoardMember, loadBoardInbox])
  useEffect(() => {
    if (tab === 'nominations' && !nominationsLoaded) loadNominations()
  }, [tab, nominationsLoaded, loadNominations])
  useEffect(() => {
    if (tab === 'feed' && !feedLoaded) loadFeed()
  }, [tab, feedLoaded, loadFeed])

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

  const handleSubmitNomination = async () => {
    if (!nomArtistName.trim()) return
    setSubmittingNom(true)
    setNomError(null)
    try {
      const res = await fetch(`/api/circles/${id}/nominations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist_name: nomArtistName.trim(),
          tier_target: nomTierTarget,
          message: nomMessage.trim() || null,
        }),
      })
      const data: { nomination?: Nomination; error?: string } = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to submit nomination')
      setNomArtistName('')
      setNomMessage('')
      setShowNomForm(false)
      loadNominations()
    } catch (err) {
      setNomError(err instanceof Error ? err.message : 'Failed to submit nomination')
    } finally {
      setSubmittingNom(false)
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
        <button
          type="button"
          onClick={() => setTab('nominations')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'nominations' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-1.5"><Star className="w-4 h-4" />Nominate</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('feed')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'feed' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-1.5"><Flame className="w-4 h-4" />Feed</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('board')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'board' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-1.5">
            <Crown className="w-4 h-4" />Board
            {boardData && boardData.proposals.filter((p) => p.status === 'pending').length > 0 && (
              <span className="w-4 h-4 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold">
                {boardData.proposals.filter((p) => p.status === 'pending').length}
              </span>
            )}
          </span>
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

      {/* ── BOARD INBOX TAB ── */}
      {tab === 'board' && (
        <BoardInboxTab
          data={boardData}
          loading={boardLoading}
          error={boardError}
          isBoardMember={isBoardMember}
          circleId={id}
          onVoted={loadBoardInbox}
          onNewChallenge={() => router.push('/rodeos/challenge')}
          onViewRodeo={(rodeoId) => router.push(`/rodeos/${rodeoId}`)}
        />
      )}

      {/* ── RODEO HISTORY TAB ── */}
      {tab === 'rodeos' && (
        <div className="space-y-6">
          {/* Rodeo Surface Summary Widget */}
          {rodeoHistory && (
            <div className="bg-gradient-to-br from-orange-50 to-yellow-50 border border-orange-200 rounded-2xl p-5">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-orange-500" />
                Circle Rodeo Record
              </h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center bg-white rounded-xl p-3 shadow-sm">
                  <div className="text-2xl font-bold text-green-600">{rodeoHistory.record.wins}</div>
                  <div className="text-xs text-gray-500 font-medium">Wins</div>
                </div>
                <div className="text-center bg-white rounded-xl p-3 shadow-sm">
                  <div className="text-2xl font-bold text-red-500">{rodeoHistory.record.losses}</div>
                  <div className="text-xs text-gray-500 font-medium">Losses</div>
                </div>
                <div className="text-center bg-white rounded-xl p-3 shadow-sm">
                  <div className="text-2xl font-bold text-gray-700">{rodeoHistory.record.total}</div>
                  <div className="text-xs text-gray-500 font-medium">Total</div>
                </div>
              </div>
              {/* Last 5 results (pending rodeos = active) */}
              {rodeoHistory.rodeos.filter((r) => r.result === 'pending').length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-600 mb-2">LIVE NOW</p>
                  {rodeoHistory.rodeos
                    .filter((r) => r.result === 'pending')
                    .map((r) => (
                      <div key={r.rodeo_id} className="flex items-center gap-2 bg-white rounded-xl p-3 mb-2 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-900 flex-1 truncate">{r.title}</span>
                        <span className="text-xs text-gray-400">Active</span>
                      </div>
                    ))}
                </div>
              )}
              {/* Last 5 results */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">RECENT RESULTS</p>
                <div className="space-y-1">
                  {rodeoHistory.rodeos.slice(0, 5).map((r) => {
                    const style = RESULT_STYLES[r.result ?? 'pending']
                    const Icon = style.icon
                    return (
                      <div key={r.rodeo_id} className="flex items-center gap-2 text-sm">
                        <span className={`${style.badge} px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1`}>
                          <Icon className="w-3 h-3" />{style.label}
                        </span>
                        <span className="text-gray-700 truncate flex-1">{r.title}</span>
                        <span className="text-gray-400 text-xs flex-shrink-0">{formatDate(r.date)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              {/* Top performing artist */}
              {rodeoHistory.artist_records && rodeoHistory.artist_records.length > 0 && (
                <div className="mt-4 pt-4 border-t border-orange-200">
                  <p className="text-xs font-semibold text-gray-600 mb-2">TOP PERFORMER</p>
                  {(() => {
                    const top = [...rodeoHistory.artist_records].sort((a, b) => b.credits_earned - a.credits_earned)[0]
                    return (
                      <div className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm">
                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                          <Music2 className="w-4 h-4 text-orange-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{top.artist_name}</p>
                          <p className="text-xs text-gray-400">{top.wins}W · {top.rodeos} rodeos</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-orange-600">{formatCredits(top.credits_earned)}</p>
                          <p className="text-xs text-gray-400">credits</p>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
              {/* Credits earned total */}
              <div className="mt-3 pt-3 border-t border-orange-200 flex items-center justify-between">
                <span className="text-sm text-gray-600 font-medium">Total Credits Earned</span>
                <span className="text-lg font-bold text-orange-600">
                  {formatCredits(rodeoHistory.rodeos.reduce((sum, r) => sum + (r.credits_won ?? 0), 0))}
                </span>
              </div>
            </div>
          )}
          <RodeoHistoryTab
            data={rodeoHistory}
            loading={rodeoHistoryLoading}
            error={rodeoHistoryError}
            onNavigate={(rodeoId) => router.push(`/rodeos/${rodeoId}`)}
            onNavigateCircle={(cId) => router.push(`/circles/${cId}`)}
          />
        </div>
      )}

      {/* ── NOMINATIONS TAB ── */}
      {tab === 'nominations' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Artist Nominations</h2>
            <Button variant="primary" onClick={() => setShowNomForm((v) => !v)}>
              <Plus className="w-4 h-4" />Nominate
            </Button>
          </div>

          {/* Budget widget */}
          {budget && (
            <div className="bg-gradient-to-br from-purple-50 to-yellow-50 border border-purple-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-5 h-5 text-purple-500" />
                <h3 className="font-semibold text-gray-900 text-sm">Your Nomination Budget</h3>
                <span className="text-xs text-gray-400 ml-auto">Resets {formatDate(budget.period_end)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl p-3 shadow-sm">
                  <p className="text-xs text-gray-500 mb-1 font-medium">Young Buck Slots</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-yellow-400 h-2 rounded-full transition-all"
                        style={{ width: budget.young_buck_slots > 0 ? `${((budget.young_buck_slots - budget.young_buck_used) / budget.young_buck_slots) * 100}%` : '0%' }}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-900 flex-shrink-0">
                      {budget.young_buck_slots - budget.young_buck_used}/{budget.young_buck_slots}
                    </span>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-3 shadow-sm">
                  <p className="text-xs text-gray-500 mb-1 font-medium">Rising Star Slots</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-purple-400 h-2 rounded-full transition-all"
                        style={{ width: budget.rising_star_slots > 0 ? `${((budget.rising_star_slots - budget.rising_star_used) / budget.rising_star_slots) * 100}%` : '0%' }}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-900 flex-shrink-0">
                      {budget.rising_star_slots - budget.rising_star_used}/{budget.rising_star_slots}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Nomination form */}
          {showNomForm && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 space-y-3">
              <h3 className="font-semibold text-gray-900 text-sm">Submit a Nomination</h3>
              <Input
                label="Artist Name"
                type="text"
                id="nom-artist-name"
                value={nomArtistName}
                onChange={(e) => setNomArtistName(e.target.value)}
                placeholder="e.g. Zach Bryan"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nominate for tier</label>
                <div className="flex gap-2">
                  {(['young_buck', 'core'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNomTierTarget(t)}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${nomTierTarget === t ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'}`}
                    >
                      {t === 'young_buck' ? 'Young Buck' : 'Core Artist'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Pitch (optional)</label>
                <textarea
                  value={nomMessage}
                  onChange={(e) => setNomMessage(e.target.value)}
                  placeholder="Why should this artist join the circle?"
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-300"
                  rows={3}
                />
              </div>
              {nomError && <p className="text-sm text-red-600">{nomError}</p>}
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={() => setShowNomForm(false)}>Cancel</Button>
                <Button variant="primary" loading={submittingNom} onClick={handleSubmitNomination} disabled={!nomArtistName.trim()}>
                  Submit Nomination
                </Button>
              </div>
            </div>
          )}

          {nominationsLoading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-orange-500 animate-spin" /></div>}
          {nominationsError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-4">{nominationsError}</p>}

          {!nominationsLoading && nominations.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Star className="w-10 h-10 mx-auto mb-2" />
              <p className="font-medium">No nominations yet</p>
              <p className="text-sm mt-1">Nominate an artist to grow the circle</p>
            </div>
          )}

          <div className="space-y-3">
            {nominations.map((nom) => {
              const total = nom.votes_for + nom.votes_against
              const forPct = total > 0 ? Math.round((nom.votes_for / total) * 100) : 0
              const statusColors: Record<string, string> = {
                pending_vote: 'bg-yellow-100 text-yellow-700',
                passed: 'bg-green-100 text-green-700',
                board_review: 'bg-blue-100 text-blue-700',
                approved: 'bg-emerald-100 text-emerald-700',
                declined: 'bg-red-100 text-red-600',
                held: 'bg-gray-100 text-gray-600',
              }
              return (
                <div key={nom.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">{nom.artist_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Nominating for <span className="font-medium">{nom.tier_target === 'young_buck' ? 'Young Buck' : 'Core Artist'}</span>
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold flex-shrink-0 ${statusColors[nom.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {nom.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                  </div>
                  {nom.message && <p className="text-sm text-gray-600 italic mb-2">&#34;{nom.message}&#34;</p>}
                  {nom.status === 'pending_vote' && (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div className="bg-green-400 h-2 rounded-full" style={{ width: `${forPct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 flex-shrink-0">{nom.votes_for}↑ {nom.votes_against}↓</span>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-2">{formatDate(nom.created_at)}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── FEED TAB ── */}
      {tab === 'feed' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Activity Feed</h2>
            <button type="button" onClick={loadFeed} className="text-sm text-orange-600 hover:text-orange-700 font-medium">
              Refresh
            </button>
          </div>

          {feedLoading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-orange-500 animate-spin" /></div>}
          {feedError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-4">{feedError}</p>}

          {!feedLoading && feedEvents.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Flame className="w-10 h-10 mx-auto mb-2" />
              <p className="font-medium">No events yet</p>
              <p className="text-sm mt-1">Circle activity will appear here</p>
            </div>
          )}

          {!feedLoading && feedEvents.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm divide-y divide-gray-50 px-4">
              {feedEvents.map((event) => (
                <FeedEventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 truncate">{artist.artist_name}</p>
                      {artist.tier && TIER_STYLES[artist.tier] && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${TIER_STYLES[artist.tier].bg} ${TIER_STYLES[artist.tier].text}`}>
                          {TIER_STYLES[artist.tier].label}
                        </span>
                      )}
                      {artist.promotion_eligible && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-green-100 text-green-700 flex-shrink-0">
                          ↑ Eligible
                        </span>
                      )}
                    </div>
                    {artist.profiles && (
                      <p className="text-xs text-gray-400">Added by {artist.profiles.display_name}</p>
                    )}
                    {artist.rodeo_wins !== undefined && artist.rodeo_appearances !== undefined && artist.rodeo_appearances > 0 && (
                      <p className="text-xs text-gray-400">{artist.rodeo_wins}W · {artist.rodeo_appearances} rodeos</p>
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
