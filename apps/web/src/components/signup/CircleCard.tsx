'use client'

import { useState } from 'react'
import { Users, Star, Music2, CheckCircle2 } from 'lucide-react'
import Button from '@/components/ui/Button'

export interface CircleData {
  id: string
  name: string
  description: string
  core_artists: string[]
  member_count: number
  avg_rating: number
  personality_types: string[]
  cover_image_url: string | null
  slug: string
  inviterName?: string
  isHighlighted?: boolean
}

interface CircleCardProps {
  circle: CircleData
  onJoin: (circleId: string) => Promise<void>
  joined: boolean
}

function formatMemberCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`
  }
  return count.toString()
}

export default function CircleCard({ circle, onJoin, joined }: CircleCardProps) {
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleJoin = async () => {
    if (joined || isJoining) return
    setIsJoining(true)
    setError(null)

    try {
      await onJoin(circle.id)
    } catch {
      setError('Failed to join. Please try again.')
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <div
      className={`bg-white rounded-xl border shadow-sm p-5 transition-all ${
        circle.isHighlighted
          ? 'border-orange-400 ring-2 ring-orange-100'
          : 'border-gray-200 hover:border-orange-200'
      }`}
      aria-label={`Circle: ${circle.name}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-gray-900 text-base leading-tight">{circle.name}</h3>
            {circle.isHighlighted && circle.inviterName && (
              <span className="text-xs bg-orange-100 text-orange-700 font-semibold px-2 py-0.5 rounded-full">
                Invited by {circle.inviterName}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{circle.description}</p>
        </div>

        {/* Decorative icon */}
        <div
          className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0"
          aria-hidden="true"
        >
          <Music2 className="w-5 h-5 text-orange-500" />
        </div>
      </div>

      {/* Core artists */}
      {circle.core_artists && circle.core_artists.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {circle.core_artists.slice(0, 3).map((artist) => (
            <span
              key={artist}
              className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
            >
              {artist}
            </span>
          ))}
          {circle.core_artists.length > 3 && (
            <span className="text-xs text-gray-400">+{circle.core_artists.length - 3} more</span>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5" aria-hidden="true" />
          <span aria-label={`${circle.member_count} members`}>
            {formatMemberCount(circle.member_count)} members
          </span>
        </span>
        <span className="flex items-center gap-1">
          <Star className="w-3.5 h-3.5 text-yellow-400" aria-hidden="true" />
          <span aria-label={`Rating: ${circle.avg_rating} out of 5`}>
            {circle.avg_rating.toFixed(1)}
          </span>
        </span>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-600 mb-3 flex items-center gap-1" role="alert">
          <svg
            className="w-3.5 h-3.5"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </p>
      )}

      {/* Join button */}
      {joined ? (
        <div
          className="flex items-center gap-2 py-2 px-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-semibold"
          role="status"
          aria-label={`You have joined ${circle.name}`}
        >
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          Joined!
        </div>
      ) : (
        <Button
          variant="primary"
          className="w-full"
          loading={isJoining}
          onClick={handleJoin}
          aria-label={`Join ${circle.name}`}
        >
          Join this circle
        </Button>
      )}
    </div>
  )
}
