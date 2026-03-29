'use client'

import { useState, useEffect, useCallback } from 'react'
import { AlertCircle, PartyPopper } from 'lucide-react'
import CircleCard, { type CircleData } from './CircleCard'
import Button from '@/components/ui/Button'

interface Step6Props {
  personalityTypes: string[]
  preselectedCircleId?: string
  inviterName?: string
  onSuccess: (joinedCircles: string[]) => void
  onSkip: () => void
}

export default function Step6Circles({
  personalityTypes,
  preselectedCircleId,
  inviterName,
  onSuccess,
  onSkip,
}: Step6Props) {
  const [circles, setCircles] = useState<CircleData[]>([])
  const [joinedCircles, setJoinedCircles] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isDone, setIsDone] = useState(false)

  const loadCircles = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const params = new URLSearchParams()
      if (personalityTypes.length > 0) {
        params.set('personality_types', personalityTypes.join(','))
      }

      const res = await fetch(`/api/circles?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load circles')

      const data: { circles: CircleData[] } = await res.json()
      let circleList = data.circles ?? []

      // If we have a preselected circle, move it to the front and mark it
      if (preselectedCircleId) {
        const idx = circleList.findIndex((c) => c.id === preselectedCircleId)
        if (idx > -1) {
          const preselected = {
            ...circleList[idx],
            isHighlighted: true,
            inviterName,
          }
          circleList = [preselected, ...circleList.filter((_, i) => i !== idx)]
        }
      }

      setCircles(circleList.slice(0, 5))
    } catch {
      setLoadError('Failed to load circles. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [personalityTypes, preselectedCircleId, inviterName])

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

    setJoinedCircles((prev) => [...prev, circleId])
  }, [])

  const handleDone = useCallback(() => {
    if (joinedCircles.length > 0) {
      setIsDone(true)
      // Small celebration then proceed
      setTimeout(() => onSuccess(joinedCircles), 1500)
    } else {
      onSuccess([])
    }
  }, [joinedCircles, onSuccess])

  if (isDone) {
    return (
      <div className="text-center py-8">
        <div
          className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-orange-100 mb-6"
          aria-hidden="true"
        >
          <PartyPopper className="w-10 h-10 text-orange-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re in!</h2>
        <p className="text-gray-600">
          You joined {joinedCircles.length} circle{joinedCircles.length !== 1 ? 's' : ''}.
          Welcome to your community!
        </p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Find your circles</h2>
      <p className="text-gray-600 mb-6">
        Join communities of fans who share your taste in country music.
      </p>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-36 bg-gray-100 rounded-xl animate-pulse"
              aria-hidden="true"
            />
          ))}
          <p className="sr-only" aria-live="polite">Loading circles…</p>
        </div>
      )}

      {/* Error */}
      {loadError && !isLoading && (
        <div
          className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm text-red-600">{loadError}</p>
            <button
              type="button"
              onClick={loadCircles}
              className="text-sm text-red-700 underline mt-1"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Circles list */}
      {!isLoading && !loadError && (
        <div className="space-y-3 mb-6" aria-label="Available circles to join">
          {circles.map((circle) => (
            <CircleCard
              key={circle.id}
              circle={circle}
              onJoin={handleJoin}
              joined={joinedCircles.includes(circle.id)}
            />
          ))}

          {circles.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No circles found for your preferences.</p>
              <a
                href="/circles"
                className="text-sm text-orange-600 hover:text-orange-700 font-medium mt-2 inline-block"
              >
                Browse all circles
              </a>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {!isLoading && (
        <>
          <a
            href="/circles"
            className="block text-center text-sm text-orange-600 hover:text-orange-700 font-medium transition-colors mb-4"
          >
            Browse all circles
          </a>

          {joinedCircles.length > 0 ? (
            <Button variant="primary" className="w-full" onClick={handleDone}>
              Done — I joined {joinedCircles.length} circle{joinedCircles.length !== 1 ? 's' : ''}!
            </Button>
          ) : (
            <Button variant="secondary" className="w-full" onClick={handleDone}>
              Continue without joining
            </Button>
          )}

          <button
            type="button"
            onClick={onSkip}
            className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors py-2"
          >
            Skip for now
          </button>
        </>
      )}
    </div>
  )
}
