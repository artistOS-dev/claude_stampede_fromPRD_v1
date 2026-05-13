'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Trophy, Calendar, Users, ChevronDown, ChevronRight, Music2, Mic2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Circuit {
  id: string
  title: string
  description: string | null
  event_name: string | null
  event_date: string | null
  cover_image_url: string | null
  status: 'open' | 'active' | 'complete'
  max_artists: number
  current_round: number
  total_rounds: number
  participant_count: number
  i_am_participating: boolean
}

function StatusBadge({ status }: { status: Circuit['status'] }) {
  if (status === 'open')     return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-green-900/40 text-green-400 border border-green-800">Open</span>
  if (status === 'active')   return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-amber-900/40 text-amber-400 border border-amber-800">Live</span>
  if (status === 'complete') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-stone-800 text-stone-400 border border-stone-700">Complete</span>
  return null
}

function CircuitCard({ circuit, onClick }: { circuit: Circuit; onClick: () => void }) {
  const spotsLeft = circuit.max_artists - circuit.participant_count
  const isOpen    = circuit.status === 'open'
  const isActive  = circuit.status === 'active'

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-stone-900 border border-stone-700 rounded-2xl overflow-hidden hover:border-amber-700/60 transition-all group"
    >
      {/* Top accent bar */}
      <div className={`h-1 w-full ${isActive ? 'bg-gradient-to-r from-amber-500 to-teal-400' : isOpen ? 'bg-green-500' : 'bg-stone-600'}`} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={circuit.status} />
              {circuit.i_am_participating && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-teal-900/40 text-teal-400 border border-teal-800">Your artist</span>
              )}
            </div>
            <h3 className="font-bold text-white text-lg leading-tight group-hover:text-amber-300 transition-colors">
              {circuit.title}
            </h3>
            {circuit.event_name && (
              <p className="text-sm text-amber-400/80 mt-0.5">{circuit.event_name}</p>
            )}
          </div>
          <Trophy className={`w-8 h-8 shrink-0 ${isActive ? 'text-amber-500' : 'text-stone-600'}`} />
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500">
          {circuit.event_date && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(circuit.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {circuit.participant_count}/{circuit.max_artists} artists
          </span>
          <span className="flex items-center gap-1">
            <Mic2 className="w-3.5 h-3.5" />
            {circuit.total_rounds}-round bracket
          </span>
        </div>

        {isOpen && spotsLeft > 0 && (
          <p className="mt-3 text-xs text-green-400 font-medium">
            {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} remaining
          </p>
        )}
        {isActive && (
          <p className="mt-3 text-xs text-amber-400 font-medium">
            Round {circuit.current_round} of {circuit.total_rounds}
          </p>
        )}

        <div className="flex items-center justify-end mt-3">
          <span className="flex items-center gap-1 text-xs text-stone-500 group-hover:text-amber-400 transition-colors font-medium">
            View bracket <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </button>
  )
}

function CreateCircuitForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', event_name: '', event_date: '',
    max_artists: 8, voting_hours_per_round: 24,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.title.trim()) { setError('Title is required'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/circuits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          event_name: form.event_name.trim() || null,
          event_date: form.event_date || null,
          max_artists: form.max_artists,
          voting_hours_per_round: form.voting_hours_per_round,
        }),
      })
      const json: { error?: string } = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create')
      setSuccess(true)
      setForm({ title: '', description: '', event_name: '', event_date: '', max_artists: 8, voting_hours_per_round: 24 })
      setTimeout(() => { setSuccess(false); setOpen(false) }, 2000)
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create circuit')
    } finally { setSubmitting(false) }
  }, [form, onCreated])

  return (
    <div className="border border-stone-700 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-stone-950 text-left"
      >
        <span className="text-sm font-semibold text-amber-300">+ Create New Circuit</span>
        <ChevronDown className={`w-4 h-4 text-stone-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="p-4 space-y-4 bg-stone-900/50">
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Circuit Title *</p>
            <input type="text" required placeholder="e.g., Summer Stampede 2025" value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Festival Name</p>
              <input type="text" placeholder="Austin Country Fest" value={form.event_name}
                onChange={(e) => setForm((f) => ({ ...f, event_name: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Event Date</p>
              <input type="date" value={form.event_date}
                onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Description</p>
            <textarea placeholder="Describe the circuit and event…" value={form.description} rows={2}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-600 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Max Artists</p>
              <select value={form.max_artists} onChange={(e) => setForm((f) => ({ ...f, max_artists: Number(e.target.value) }))}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                <option value={4}>4 artists (2 rounds)</option>
                <option value={8}>8 artists (3 rounds)</option>
                <option value={16}>16 artists (4 rounds)</option>
                <option value={32}>32 artists (5 rounds)</option>
              </select>
            </div>
            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Voting Window</p>
              <select value={form.voting_hours_per_round} onChange={(e) => setForm((f) => ({ ...f, voting_hours_per_round: Number(e.target.value) }))}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                <option value={6}>6 hours</option>
                <option value={12}>12 hours</option>
                <option value={24}>24 hours</option>
                <option value={48}>48 hours</option>
                <option value={72}>72 hours</option>
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-red-400 bg-red-950/30 border border-red-800 rounded-lg px-3 py-2">{error}</p>}
          {success && <p className="text-sm text-green-400 bg-green-950/30 border border-green-800 rounded-lg px-3 py-2">Circuit created!</p>}

          <button type="submit" disabled={submitting || !form.title.trim()}
            className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
            {submitting ? 'Creating…' : 'Create Circuit'}
          </button>
        </form>
      )}
    </div>
  )
}

export default function CircuitsPage() {
  const router = useRouter()
  const [circuits, setCircuits]   = useState<Circuit[]>([])
  const [drafts, setDrafts]       = useState<Circuit[]>([])
  const [isLoading, setLoading]   = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [canCreate, setCanCreate] = useState(false)
  const [userRole, setUserRole]   = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/circuits')
      if (!res.ok) throw new Error('Failed to load')
      const json: { circuits: Circuit[]; drafts?: Circuit[] } = await res.json()
      setCircuits(json.circuits ?? [])
      setDrafts(json.drafts ?? [])
    } catch {
      setError('Could not load circuits. Please refresh.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const checkRole = async () => {
      const supabase = createClient()
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) return
      const { data: profile } = await supabase
        .from('profiles').select('role, is_super_admin').eq('id', auth.user.id).maybeSingle()
      setCanCreate(profile?.role === 'stampede_producer' || profile?.is_super_admin === true)
      setUserRole(profile?.role ?? null)
    }
    checkRole()
  }, [])

  const active   = circuits.filter((c) => c.status === 'active')
  const open     = circuits.filter((c) => c.status === 'open')
  const complete = circuits.filter((c) => c.status === 'complete')

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-amber-900 via-stone-800 to-teal-950 p-6 border border-amber-800/40 shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="w-8 h-8 text-amber-300" />
          <div>
            <h1 className="text-3xl font-extrabold font-display tracking-tight text-amber-100">Circuits</h1>
            <p className="text-amber-200/60 text-sm">Tournament brackets for live festivals · Vote for your favourite artist</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-amber-300/60">
          <Music2 className="w-3.5 h-3.5" />
          <span>March Madness style · Each song used max twice · Champion crowned at the final</span>
        </div>
      </div>

      {canCreate && <CreateCircuitForm onCreated={load} />}
      {!isLoading && !canCreate && userRole !== null && (
        <div className="bg-stone-900 border border-stone-700 rounded-xl px-4 py-3 text-xs text-stone-400">
          Circuits are created by <span className="text-amber-400 font-medium">Stampede Producers</span>.
          Contact a Stampede admin to get that role if you run festivals or events.
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
        </div>
      )}

      {error && !isLoading && (
        <div className="bg-red-950/30 border border-red-800 rounded-xl p-4 text-sm text-red-400">{error}</div>
      )}

      {!isLoading && !error && circuits.length === 0 && drafts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Trophy className="w-12 h-12 text-stone-700 mb-3" />
          <p className="text-stone-400 font-medium">No circuits yet</p>
          <p className="text-stone-600 text-sm mt-1">
            {canCreate ? 'Create a circuit above, then open it for registration.' : 'Check back soon for festival tournament brackets'}
          </p>
        </div>
      )}

      {drafts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold text-stone-500 uppercase tracking-widest">Drafts (Producer Only)</h2>
          {drafts.map((c) => <CircuitCard key={c.id} circuit={c} onClick={() => router.push(`/circuits/${c.id}`)} />)}
        </section>
      )}

      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold text-stone-500 uppercase tracking-widest">Live Now</h2>
          {active.map((c) => <CircuitCard key={c.id} circuit={c} onClick={() => router.push(`/circuits/${c.id}`)} />)}
        </section>
      )}

      {open.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold text-stone-500 uppercase tracking-widest">Open for Registration</h2>
          {open.map((c) => <CircuitCard key={c.id} circuit={c} onClick={() => router.push(`/circuits/${c.id}`)} />)}
        </section>
      )}

      {complete.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold text-stone-500 uppercase tracking-widest">Completed</h2>
          {complete.map((c) => <CircuitCard key={c.id} circuit={c} onClick={() => router.push(`/circuits/${c.id}`)} />)}
        </section>
      )}
    </div>
  )
}
