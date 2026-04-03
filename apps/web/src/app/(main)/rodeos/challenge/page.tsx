'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, Search, Users, Music, Star, CheckCircle2,
  Coins, Trophy, Loader2, AlertCircle, Lock, ChevronRight, Crown,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────

interface MyCircle {
  id: string
  name: string
  role: string
  member_count: number
  personality_tags: string[]
}

interface BrowseCircle {
  id: string
  name: string
  description: string
  member_count: number
  avg_rating: number
  personality_types: string[]
  core_artists: string[]
}

interface CircleSong {
  id: string
  title: string
  artist: string
  album: string | null
  avg_rating: number | null
}

// ── Wizard state ──────────────────────────────────────────────

interface WizardState {
  challengerCircleId: string
  challengerCircleName: string
  targetCircleId: string
  targetCircleName: string
  title: string
  storyline: string
  selectedSongIds: string[]
  songLabels: Record<string, 'studio' | 'live'>
  confidenceConfirmed: boolean
  creditBuyIn: number
  endDate: string
}

const INITIAL: WizardState = {
  challengerCircleId: '',
  challengerCircleName: '',
  targetCircleId: '',
  targetCircleName: '',
  title: '',
  storyline: '',
  selectedSongIds: [],
  songLabels: {},
  confidenceConfirmed: false,
  creditBuyIn: 500,
  endDate: '',
}

const STEPS = [
  'Target Circle',
  'Why This Matchup',
  'Song Selection',
  'Confidence Check',
  'Credit Pool',
  'Submit for Approval',
]

const MAX_SONGS = 5

// ── Default distribution preview ─────────────────────────────

const DIST_PREVIEW = [
  { label: 'Artist + Songwriter + Band', pct: 45, color: 'bg-orange-400' },
  { label: 'Core Artists + Young Bucks', pct: 45, color: 'bg-purple-400' },
  { label: 'Participating Voters',        pct: 10, color: 'bg-blue-400' },
]

// ── Helpers ───────────────────────────────────────────────────

function formatCredits(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(0)
}

// ── Main page ─────────────────────────────────────────────────

export default function ChallengePage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [state, setState] = useState<WizardState>(INITIAL)

  const [myCircles, setMyCircles] = useState<MyCircle[]>([])
  const [myCirclesLoading, setMyCirclesLoading] = useState(true)

  const [browseCircles, setBrowseCircles] = useState<BrowseCircle[]>([])
  const [browseSearch, setBrowseSearch] = useState('')
  const [browseLoading, setBrowseLoading] = useState(false)

  const [songs, setSongs] = useState<CircleSong[]>([])
  const [songsLoading, setSongsLoading] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [proposalId, setProposalId] = useState<string | null>(null)

  // Load user's board/founder circles on mount
  useEffect(() => {
    fetch('/api/circles/mine')
      .then((r) => r.json())
      .then((d) => {
        setMyCircles(d.circles ?? [])
        if (d.circles?.length === 1) {
          setState((s) => ({ ...s, challengerCircleId: d.circles[0].id, challengerCircleName: d.circles[0].name }))
        }
      })
      .finally(() => setMyCirclesLoading(false))
  }, [])

  // Browse circles for target selection
  const loadCircles = useCallback(async (q: string) => {
    setBrowseLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('search', q)
    const res = await fetch(`/api/circles?${params}`)
    const d = await res.json()
    // Exclude challenger's own circle
    setBrowseCircles((d.circles ?? []).filter((c: BrowseCircle) => c.id !== state.challengerCircleId))
    setBrowseLoading(false)
  }, [state.challengerCircleId])

  useEffect(() => {
    if (step === 1) loadCircles(browseSearch)
  }, [step, browseSearch, loadCircles])

  // Load songs when on step 3
  useEffect(() => {
    if (step !== 3 || !state.challengerCircleId) return
    setSongsLoading(true)
    fetch(`/api/circles/${state.challengerCircleId}/songs`)
      .then((r) => r.json())
      .then((d) => setSongs(d.songs ?? []))
      .finally(() => setSongsLoading(false))
  }, [step, state.challengerCircleId])

  // Auto-title
  useEffect(() => {
    if (state.challengerCircleName && state.targetCircleName && !state.title) {
      setState((s) => ({ ...s, title: `${s.challengerCircleName} vs ${s.targetCircleName}` }))
    }
  }, [state.challengerCircleName, state.targetCircleName, state.title])

  const update = (patch: Partial<WizardState>) => setState((s) => ({ ...s, ...patch }))

  const canAdvance = () => {
    switch (step) {
      case 1: return !!state.challengerCircleId && !!state.targetCircleId
      case 2: return !!state.title.trim() && !!state.storyline.trim()
      case 3: return state.selectedSongIds.length >= 1
      case 4: return state.confidenceConfirmed
      case 5: return state.creditBuyIn > 0
      default: return false
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(`/api/circles/${state.challengerCircleId}/challenge-proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_circle_id: state.targetCircleId,
          title: state.title.trim(),
          description: state.storyline.trim(),
          credit_buy_in: state.creditBuyIn,
          song_ids: state.selectedSongIds,
          song_labels: state.songLabels,
          end_date: state.endDate || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Submission failed')
      setProposalId(json.proposal_id)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Guard: no board circles ──────────────────────────────────

  if (!myCirclesLoading && myCircles.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <BackBtn onClick={() => router.push('/rodeos')} />
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center space-y-3">
          <Crown className="w-10 h-10 text-amber-500 mx-auto" />
          <p className="font-semibold text-amber-900">Board access required</p>
          <p className="text-sm text-amber-700">
            Only board members or founders of a Circle can initiate a challenge.
          </p>
        </div>
      </div>
    )
  }

  // ── Success state ────────────────────────────────────────────

  if (proposalId) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
          <div>
            <p className="font-bold text-green-900 text-lg">Submitted for Board Approval</p>
            <p className="text-sm text-green-700 mt-2">
              Your board members have been notified. A majority must vote{' '}
              <strong>Approve</strong> before the challenge is sent to{' '}
              <strong>{state.targetCircleName}</strong>.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              type="button"
              onClick={() => router.push(`/circles/${state.challengerCircleId}`)}
              className="px-5 py-2.5 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-colors"
            >
              View Board Inbox
            </button>
            <button
              type="button"
              onClick={() => router.push('/rodeos')}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
            >
              Back to Rodeo Feed
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Back */}
      <BackBtn onClick={() => step === 1 ? router.push('/rodeos') : setStep((s) => s - 1)} />

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="font-semibold text-orange-600">Step {step} of {STEPS.length}</span>
          <span>{STEPS[step - 1]}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-all duration-500"
            style={{ width: `${(step / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* From Circle selector (shown when user has multiple) */}
      {myCircles.length > 1 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <label className="block text-xs font-semibold text-orange-700 mb-2 uppercase tracking-wide">
            Challenging on behalf of
          </label>
          <div className="flex flex-wrap gap-2">
            {myCircles.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => update({ challengerCircleId: c.id, challengerCircleName: c.name })}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  state.challengerCircleId === c.id
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-700 hover:border-orange-300'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── STEP 1: Target Selection ── */}
      {step === 1 && (
        <StepCard title="Choose Your Opponent" icon={<Users className="w-5 h-5 text-orange-500" />}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="search"
              placeholder="Search circles by name, sound, or artist…"
              value={browseSearch}
              onChange={(e) => setBrowseSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          {browseLoading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-orange-500" /></div>}

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {browseCircles.map((c) => {
              const selected = state.targetCircleId === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => update({ targetCircleId: c.id, targetCircleName: c.name })}
                  className={`w-full text-left rounded-xl border p-4 transition-all ${
                    selected
                      ? 'border-orange-400 bg-orange-50 ring-1 ring-orange-300'
                      : 'border-gray-200 bg-white hover:border-orange-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 truncate">{c.name}</span>
                        {selected && <CheckCircle2 className="w-4 h-4 text-orange-500 shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{c.description}</p>
                      {c.core_artists?.length > 0 && (
                        <p className="text-xs text-gray-400 mt-1 truncate">
                          {c.core_artists.slice(0, 3).join(' · ')}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-medium text-gray-700">{(c.member_count ?? 0).toLocaleString()}</div>
                      <div className="text-xs text-gray-400">members</div>
                    </div>
                  </div>
                  {c.personality_types?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {c.personality_types.slice(0, 3).map((t) => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{t}</span>
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </StepCard>
      )}

      {/* ── STEP 2: Why This Matchup ── */}
      {step === 2 && (
        <StepCard title="Why This Matchup?" icon={<Trophy className="w-5 h-5 text-orange-500" />}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Rodeo title</label>
              <input
                type="text"
                value={state.title}
                onChange={(e) => update({ title: e.target.value })}
                placeholder="e.g. Morgan Wallen Nation vs New Country Discoveries"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                maxLength={120}
              />
              <p className="text-xs text-gray-400 mt-1">{state.title.length}/120</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Storyline justification</label>
              <textarea
                value={state.storyline}
                onChange={(e) => update({ storyline: e.target.value })}
                placeholder="Explain the narrative. Why is this matchup compelling? What's the musical storyline? The board needs this to approve."
                rows={5}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                maxLength={600}
              />
              <p className="text-xs text-gray-400 mt-1">{state.storyline.length}/600</p>
            </div>
          </div>
        </StepCard>
      )}

      {/* ── STEP 3: Song Selection ── */}
      {step === 3 && (
        <StepCard title="Pick Your Songs" icon={<Music className="w-5 h-5 text-orange-500" />}>
          <p className="text-sm text-gray-500">
            Select 1–{MAX_SONGS} songs from <strong>{state.challengerCircleName}</strong>'s roster.
            Label each as studio or live. Songs lock once the board approves.
          </p>

          {songsLoading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-orange-500" /></div>}

          {!songsLoading && songs.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              <Music className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">No songs in this circle yet. Add some first.</p>
            </div>
          )}

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {songs.map((song) => {
              const selected = state.selectedSongIds.includes(song.id)
              const label = state.songLabels[song.id] ?? 'studio'
              const disabled = !selected && state.selectedSongIds.length >= MAX_SONGS

              return (
                <div
                  key={song.id}
                  className={`rounded-xl border p-3 transition-all ${
                    selected
                      ? 'border-orange-400 bg-orange-50'
                      : disabled
                      ? 'border-gray-100 bg-gray-50 opacity-50'
                      : 'border-gray-200 bg-white hover:border-orange-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        const ids = selected
                          ? state.selectedSongIds.filter((id) => id !== song.id)
                          : [...state.selectedSongIds, song.id]
                        update({ selectedSongIds: ids })
                      }}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                        selected ? 'bg-orange-500 border-orange-500' : 'border-gray-300'
                      }`}
                      aria-label={selected ? 'Deselect' : 'Select'}
                    >
                      {selected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{song.title}</p>
                      <p className="text-xs text-gray-400 truncate">{song.artist}{song.album ? ` · ${song.album}` : ''}</p>
                    </div>

                    {selected && (
                      <div className="flex gap-1 shrink-0">
                        {(['studio', 'live'] as const).map((l) => (
                          <button
                            key={l}
                            type="button"
                            onClick={() => update({ songLabels: { ...state.songLabels, [song.id]: l } })}
                            className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${
                              label === l
                                ? l === 'live' ? 'bg-red-500 text-white' : 'bg-gray-700 text-white'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            {l === 'live' ? 'Live' : 'Studio'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-xs text-gray-400 text-right">
            {state.selectedSongIds.length} / {MAX_SONGS} selected
          </p>
        </StepCard>
      )}

      {/* ── STEP 4: Confidence Check ── */}
      {step === 4 && (
        <StepCard title="Internal Confidence Check" icon={<Star className="w-5 h-5 text-orange-500" />}>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2">
            <p className="font-semibold text-orange-900 text-sm">
              "{state.challengerCircleName} stands behind these songs."
            </p>
            <p className="text-xs text-orange-700">
              Once the board approves and the challenge is sent, these songs are locked. No substitutions.
            </p>
          </div>

          <div className="space-y-2">
            {state.selectedSongIds.map((id) => {
              const song = songs.find((s) => s.id === id)
              if (!song) return null
              const label = state.songLabels[id] ?? 'studio'
              return (
                <div key={id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
                  <Music className="w-4 h-4 text-orange-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{song.title}</p>
                    <p className="text-xs text-gray-400">{song.artist}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${label === 'live' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                    {label === 'live' ? 'Live' : 'Studio'}
                  </span>
                </div>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => update({ confidenceConfirmed: !state.confidenceConfirmed })}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              state.confidenceConfirmed
                ? 'border-green-400 bg-green-50'
                : 'border-dashed border-gray-300 hover:border-orange-400'
            }`}
          >
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
              state.confidenceConfirmed ? 'bg-green-500 border-green-500' : 'border-gray-300'
            }`}>
              {state.confidenceConfirmed && <CheckCircle2 className="w-4 h-4 text-white" />}
            </div>
            <span className={`text-sm font-semibold ${state.confidenceConfirmed ? 'text-green-800' : 'text-gray-600'}`}>
              {state.confidenceConfirmed
                ? 'Standing behind these songs — ready for board review'
                : 'I stand behind these songs and would back them with credits'}
            </span>
          </button>
        </StepCard>
      )}

      {/* ── STEP 5: Credit Pool ── */}
      {step === 5 && (
        <StepCard title="Credit Pool" icon={<Coins className="w-5 h-5 text-yellow-500" />}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Credits per Circle (equal buy-in enforced)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={100000}
                value={state.creditBuyIn}
                onChange={(e) => update({ creditBuyIn: Math.max(1, parseInt(e.target.value) || 0) })}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <span className="text-sm text-gray-500 shrink-0">credits</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Each Circle contributes exactly this amount. Total pool = {formatCredits(state.creditBuyIn * 2)} before platform fee.
            </p>
          </div>

          {/* Pool preview */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Your contribution</span>
              <span className="font-semibold">{formatCredits(state.creditBuyIn)} credits</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Opponent contribution (equal)</span>
              <span className="font-semibold">{formatCredits(state.creditBuyIn)} credits</span>
            </div>
            <div className="border-t border-gray-200 pt-3 flex justify-between text-sm">
              <span className="font-semibold text-gray-800">Total pool</span>
              <span className="font-bold text-orange-600">{formatCredits(state.creditBuyIn * 2)} credits</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Platform fee (10%)</span>
              <span>−{formatCredits(state.creditBuyIn * 2 * 0.1)}</span>
            </div>
            <div className="flex justify-between text-xs font-medium text-gray-600">
              <span>Net prize pool</span>
              <span>{formatCredits(state.creditBuyIn * 2 * 0.9)}</span>
            </div>
          </div>

          {/* Distribution preview */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Default distribution</p>
            <div className="h-2 rounded-full overflow-hidden flex gap-0.5 mb-3">
              {DIST_PREVIEW.map((d) => (
                <div key={d.label} className={`${d.color}`} style={{ width: `${d.pct}%` }} />
              ))}
            </div>
            <div className="space-y-1.5">
              {DIST_PREVIEW.map((d) => (
                <div key={d.label} className="flex items-center gap-2 text-xs">
                  <div className={`w-2 h-2 rounded-sm ${d.color} shrink-0`} />
                  <span className="text-gray-600 flex-1">{d.label}</span>
                  <span className="font-medium text-gray-700">{d.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Optional end date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Voting end date <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="datetime-local"
              value={state.endDate}
              onChange={(e) => update({ endDate: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
        </StepCard>
      )}

      {/* ── STEP 6: Confirm & Submit ── */}
      {step === 6 && (
        <StepCard title="Submit for Board Approval" icon={<Lock className="w-5 h-5 text-orange-500" />}>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-1">
            <p className="font-semibold">This challenge goes to your board first.</p>
            <p className="text-amber-700">
              A majority of board members must vote <strong>Approve</strong> before
              it's sent to <strong>{state.targetCircleName}</strong>.
            </p>
          </div>

          {/* Summary */}
          <div className="space-y-3">
            <SummaryRow label="Challenging circle" value={state.challengerCircleName} />
            <SummaryRow label="Target circle" value={state.targetCircleName} />
            <SummaryRow label="Title" value={state.title} />
            <SummaryRow label="Songs" value={`${state.selectedSongIds.length} song${state.selectedSongIds.length !== 1 ? 's' : ''}`} />
            <SummaryRow label="Buy-in per circle" value={`${formatCredits(state.creditBuyIn)} credits`} />
          </div>

          {submitError && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {submitError}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold transition-colors"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
            {submitting ? 'Submitting…' : 'Submit for Board Approval'}
          </button>
        </StepCard>
      )}

      {/* Navigation */}
      {step < 6 && (
        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <button
            type="button"
            disabled={!canAdvance()}
            onClick={() => setStep((s) => s + 1)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 text-sm text-gray-500 hover:text-orange-600 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" /> Back
    </button>
  )
}

function StepCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5 shadow-sm">
      <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
        {icon} {title}
      </h2>
      {children}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm py-2 border-b border-gray-100 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 text-right max-w-[60%] truncate">{value}</span>
    </div>
  )
}
