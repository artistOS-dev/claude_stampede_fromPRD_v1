'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Search } from 'lucide-react'
import CircleCard, { type CircleData } from '@/components/signup/CircleCard'
import { createClient } from '@/lib/supabase/client'

export default function CirclesPage() {
  const [circles, setCircles] = useState<CircleData[]>([])
  const [joinedCircles, setJoinedCircles] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [canCreateCircle, setCanCreateCircle] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    coreArtists: '',
    maxMembers: '',
    isPaid: false,
    requiredTier: 'free',
    personalityTags: '',
    imageUrl: '',
  })

  const loadCircles = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [circlesRes, membershipsRes] = await Promise.all([
        fetch('/api/circles'),
        fetch('/api/circles/memberships'),
      ])

      if (!circlesRes.ok) throw new Error('Failed to load circles')

      const circlesData: { circles: CircleData[] } = await circlesRes.json()
      setCircles(circlesData.circles ?? [])

      if (membershipsRes.ok) {
        const membershipsData: { circle_ids: string[] } = await membershipsRes.json()
        setJoinedCircles(new Set(membershipsData.circle_ids ?? []))
      }
    } catch {
      setError('Could not load circles. Please refresh the page.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCircles()
  }, [loadCircles])

  useEffect(() => {
    const loadRole = async () => {
      const supabase = createClient()
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', auth.user.id)
        .maybeSingle()
      setCanCreateCircle(profile?.role === 'producer')
    }
    loadRole()
  }, [])

  const handleJoin = useCallback(async (circleId: string) => {
    const res = await fetch('/api/circles/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ circle_id: circleId }),
    })
    if (!res.ok) {
      const data: { error?: string } = await res.json()
      throw new Error(data.error ?? 'Failed to join circle')
    }
    setJoinedCircles((prev) => new Set(prev).add(circleId))
    setCircles((prev) =>
      prev.map((circle) =>
        circle.id === circleId
          ? { ...circle, member_count: (circle.member_count ?? 0) + 1 }
          : circle
      )
    )
  }, [])

  const handleLeave = useCallback(async (circleId: string) => {
    const res = await fetch('/api/circles/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ circle_id: circleId }),
    })
    if (!res.ok) {
      const data: { error?: string } = await res.json()
      throw new Error(data.error ?? 'Failed to leave circle')
    }
    setJoinedCircles((prev) => {
      const next = new Set(prev)
      next.delete(circleId)
      return next
    })
    setCircles((prev) =>
      prev.map((circle) =>
        circle.id === circleId
          ? { ...circle, member_count: Math.max((circle.member_count ?? 1) - 1, 0) }
          : circle
      )
    )
  }, [])

  const filtered = search.trim()
    ? circles.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.description.toLowerCase().includes(search.toLowerCase()) ||
          c.core_artists.some((a) => a.toLowerCase().includes(search.toLowerCase()))
      )
    : circles

  const handleCreateCircle = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)
    setCreating(true)

    const coreArtists = form.coreArtists
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)

    const personalityTags = form.personalityTags
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      core_artists: coreArtists,
      max_members: form.maxMembers ? Number(form.maxMembers) : null,
      is_paid: form.isPaid,
      required_tier: form.isPaid ? form.requiredTier : null,
      personality_tags: personalityTags,
      image_url: form.imageUrl.trim() || null,
    }

    try {
      const res = await fetch('/api/circles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json: { error?: string; circle?: CircleData } = await res.json()
      if (!res.ok || !json.circle) throw new Error(json.error ?? 'Could not create circle')

      setCircles((prev) => [json.circle!, ...prev])
      setJoinedCircles((prev) => new Set(prev).add(json.circle!.id))
      setForm({
        name: '',
        description: '',
        coreArtists: '',
        maxMembers: '',
        isPaid: false,
        requiredTier: 'free',
        personalityTags: '',
        imageUrl: '',
      })
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create circle')
    } finally {
      setCreating(false)
    }
  }, [form])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-pink-500 via-pink-500 to-yellow-500 p-6 text-white shadow-lg">
        <h1 className="text-3xl font-extrabold tracking-tight">Browse Circles</h1>
        <p className="text-pink-100 mt-1">
          Find communities of fans who share your taste in country music
        </p>
      </div>

      {canCreateCircle && (
        <div className="bg-gradient-to-br from-pink-950/20 via-zinc-900 to-zinc-900 rounded-2xl border-2 border-pink-800 p-5 space-y-4 shadow-sm">
          <h2 className="text-lg font-bold text-pink-200">🎸 Create Circle (Producer)</h2>
          <form onSubmit={handleCreateCircle} className="space-y-3">
            <input
              type="text"
              required
              placeholder="Circle name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-pink-800 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <textarea
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-pink-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-500"
              rows={3}
            />
            <input
              type="text"
              placeholder="Core artists (comma separated)"
              value={form.coreArtists}
              onChange={(e) => setForm((prev) => ({ ...prev, coreArtists: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-pink-800 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <input
              type="text"
              placeholder="Personality tags (comma separated)"
              value={form.personalityTags}
              onChange={(e) => setForm((prev) => ({ ...prev, personalityTags: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-pink-800 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="number"
                min={1}
                placeholder="Max members (optional)"
                value={form.maxMembers}
                onChange={(e) => setForm((prev) => ({ ...prev, maxMembers: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-pink-800 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
              <input
                type="url"
                placeholder="Image URL (optional)"
                value={form.imageUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, imageUrl: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-pink-800 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={form.isPaid}
                onChange={(e) => setForm((prev) => ({ ...prev, isPaid: e.target.checked }))}
              />
              Paid circle
            </label>
            {form.isPaid && (
              <select
                value={form.requiredTier}
                onChange={(e) => setForm((prev) => ({ ...prev, requiredTier: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-pink-800 text-sm bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
              >
                <option value="free">free</option>
                <option value="fan">fan</option>
                <option value="superfan">superfan</option>
                <option value="artist">artist</option>
                <option value="producer">producer</option>
              </select>
            )}
            {createError && (
              <div className="bg-red-950/30 border border-red-800 rounded-xl p-3 text-sm text-red-400">
                {createError}
              </div>
            )}
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 disabled:opacity-50 text-white text-sm font-semibold shadow"
            >
              {creating ? 'Creating…' : 'Create Circle'}
            </button>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Search circles or artists…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border-2 border-pink-800 bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          aria-label="Search circles"
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500" aria-label="Loading" />
        </div>
      )}

      {error && !isLoading && (
        <div className="bg-red-950/30 border border-red-800 rounded-xl p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="w-12 h-12 text-zinc-700 mb-3" aria-hidden="true" />
          <p className="text-zinc-500 font-medium">No circles found</p>
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="mt-2 text-sm text-pink-400 hover:text-pink-300"
            >
              Clear search
            </button>
          )}
        </div>
      )}

      {!isLoading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((circle) => (
            <CircleCard
              key={circle.id}
              circle={circle}
              onJoin={handleJoin}
              onLeave={handleLeave}
              joined={joinedCircles.has(circle.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
