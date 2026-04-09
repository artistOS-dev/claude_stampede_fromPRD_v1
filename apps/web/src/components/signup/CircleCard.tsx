'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Star, Music2, CheckCircle2, LogOut } from 'lucide-react'
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
  onLeave?: (circleId: string) => Promise<void>
  joined: boolean
}

function formatMemberCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`
  }
  return count.toString()
}

export default function CircleCard({ circle, onJoin, onLeave, joined }: CircleCardProps) {
  const router = useRouter()
  const [isJoining, setIsJoining] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
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

  const handleLeave = async () => {
    if (!onLeave || !joined || isLeaving) return
    setIsLeaving(true)
    setError(null)
    try {
      await onLeave(circle.id)
    } catch {
      setError('Failed to leave. Please try again.')
    } finally {
      setIsLeaving(false)
    }
  }

  return (
    <div
      className={`bg-zinc-900 rounded-xl border shadow-sm p-5 transition-all ${
        circle.isHighlighted
          ? 'border-pink-600 ring-2 ring-pink-500/20'
          : 'border-zinc-700 hover:border-pink-800'
      }`}
      aria-label={`Circle: ${circle.name}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {joined ? (
              <button
                type="button"
                onClick={() => router.push(`/circles/${circle.id}`)}
                className="font-bold text-white text-base leading-tight hover:text-pink-400 transition-colors text-left"
              >
                {circle.name}
              </button>
            ) : (
              <h3 className="font-bold text-white text-base leading-tight">{circle.name}</h3>
            )}
            {circle.isHighlighted && circle.inviterName && (
              <span className="text-xs bg-pink-900/30 text-pink-300 font-semibold px-2 py-0.5 rounded-full">
                Invited by {circle.inviterName}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{circle.description}</p>
        </div>

        {/* Decorative icon */}
        <div
          className="w-10 h-10 rounded-full bg-pink-900/30 flex items-center justify-center flex-shrink-0"
          aria-hidden="true"
        >
          <Music2 className="w-5 h-5 text-pink-400" />
        </div>
      </div>

      {/* Core artists */}
      {circle.core_artists && circle.core_artists.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {circle.core_artists.slice(0, 3).map((artist) => (
            <span
              key={artist}
              className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full"
            >
              {artist}
            </span>
          ))}
          {circle.core_artists.length > 3 && (
            <span className="text-xs text-zinc-600">+{circle.core_artists.length - 3} more</span>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 mb-4 text-xs text-zinc-500">
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
        <p className="text-xs text-red-400 mb-3 flex items-center gap-1" role="alert">
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

      {/* Join / Leave button */}
      {joined ? (
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-2 py-2 px-4 rounded-xl bg-green-950/30 border border-green-800 text-green-400 text-sm font-semibold flex-1"
            role="status"
            aria-label={`You have joined ${circle.name}`}
          >
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            Joined
          </div>
          {onLeave && (
            <Button
              variant="secondary"
              className="flex-shrink-0 !px-3"
              loading={isLeaving}
              onClick={handleLeave}
              aria-label={`Leave ${circle.name}`}
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
            </Button>
          )}
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
