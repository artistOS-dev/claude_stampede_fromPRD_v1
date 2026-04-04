'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Search } from 'lucide-react'
import CircleCard, { type CircleData } from '@/components/signup/CircleCard'

export default function CirclesPage() {
  const [circles, setCircles] = useState<CircleData[]>([])
  const [joinedCircles, setJoinedCircles] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Browse Circles</h1>
        <p className="text-gray-500 mt-1">
          Find communities of fans who share your taste in country music
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Search circles or artists…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          aria-label="Search circles"
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" aria-label="Loading" />
        </div>
      )}

      {error && !isLoading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="w-12 h-12 text-gray-300 mb-3" aria-hidden="true" />
          <p className="text-gray-500 font-medium">No circles found</p>
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="mt-2 text-sm text-orange-600 hover:text-orange-700"
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
