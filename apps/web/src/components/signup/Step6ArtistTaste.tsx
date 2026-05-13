'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { CheckCircle2, Music, Loader2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import type { AppleMusicArtistResult } from '@/lib/appleMusic'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FavoriteArtist {
  name: string
  apple_music_id: string
  image_url: string | null
  apple_music_url: string
}

// Alias so internal usage of SpotifyArtistResult still compiles
type SpotifyArtistResult = AppleMusicArtistResult

interface Step6Props {
  personalityTypes: string[]
  onSuccess: (genres: string[], artists: FavoriteArtist[]) => void
  onSkip: () => void
}

// ---------------------------------------------------------------------------
// Genre definitions
// ---------------------------------------------------------------------------

const COUNTRY_GENRES = [
  { id: 'traditional',    label: 'Traditional Country', emoji: '🤠' },
  { id: 'country-pop',    label: 'Country Pop',         emoji: '✨' },
  { id: 'outlaw',         label: 'Outlaw Country',      emoji: '🎸' },
  { id: 'bluegrass',      label: 'Bluegrass',           emoji: '🪕' },
  { id: 'americana',      label: 'Americana',           emoji: '🌄' },
  { id: 'red-dirt',       label: 'Red Dirt',            emoji: '🌵' },
  { id: 'country-rock',   label: 'Country Rock',        emoji: '⚡' },
  { id: 'texas-country',  label: 'Texas Country',       emoji: '⭐' },
  { id: 'contemporary',   label: 'Contemporary',        emoji: '🎤' },
  { id: 'folk-country',   label: 'Folk Country',        emoji: '🌿' },
  { id: 'alt-country',    label: 'Alt-Country',         emoji: '🔮' },
  { id: 'bro-country',    label: 'Bro Country',         emoji: '🎉' },
]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function GenrePill({
  genre,
  selected,
  onToggle,
}: {
  genre: typeof COUNTRY_GENRES[0]
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all active:scale-95 ${
        selected
          ? 'border-amber-500 bg-amber-950/40 text-amber-300'
          : 'border-stone-700 bg-stone-800 text-stone-400 hover:border-amber-700 hover:text-stone-200'
      }`}
      aria-pressed={selected}
    >
      <span aria-hidden="true">{genre.emoji}</span>
      {genre.label}
    </button>
  )
}

function ArtistCard({
  artist,
  selected,
  onToggle,
}: {
  artist: SpotifyArtistResult
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform"
      aria-pressed={selected}
      aria-label={`${artist.name}${selected ? ', selected' : ''}`}
    >
      {/* Photo ring */}
      <div
        className={`relative w-16 h-16 rounded-full overflow-hidden border-2 transition-all ${
          selected
            ? 'border-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.25)]'
            : 'border-stone-700 group-hover:border-amber-700'
        }`}
      >
        {artist.image_url ? (
          <Image
            src={artist.image_url}
            alt={artist.name}
            fill
            sizes="64px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full bg-stone-700 flex items-center justify-center">
            <Music className="w-5 h-5 text-stone-500" />
          </div>
        )}

        {/* Amber tint + check when selected */}
        {selected && (
          <div className="absolute inset-0 bg-amber-900/40 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-amber-400" />
          </div>
        )}
      </div>

      <span
        className={`text-xs text-center leading-tight line-clamp-2 max-w-[4.5rem] transition-colors ${
          selected ? 'text-amber-300 font-medium' : 'text-stone-400 group-hover:text-stone-200'
        }`}
      >
        {artist.name}
      </span>
    </button>
  )
}

function ArtistGrid({
  title,
  emoji,
  artists,
  selectedIds,
  onToggle,
}: {
  title: string
  emoji: string
  artists: SpotifyArtistResult[]
  selectedIds: Set<string>
  onToggle: (artist: SpotifyArtistResult) => void
}) {
  if (artists.length === 0) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-stone-500 mb-3">
        <span aria-hidden="true">{emoji} </span>{title}
      </p>
      <div className="grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-5">
        {artists.map((a) => (
          <ArtistCard
            key={a.id}
            artist={a}
            selected={selectedIds.has(a.id)}
            onToggle={() => onToggle(a)}
          />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Step6ArtistTaste({ personalityTypes, onSuccess, onSkip }: Step6Props) {
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [selectedArtistMap, setSelectedArtistMap] = useState<Map<string, FavoriteArtist>>(new Map())

  const [trending, setTrending] = useState<SpotifyArtistResult[]>([])
  const [classics, setClassics] = useState<SpotifyArtistResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Derived
  const selectedIds = new Set(selectedArtistMap.keys())
  const totalSelected = selectedGenres.length + selectedArtistMap.size

  // Load featured artists on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const res = await fetch('/api/artists/featured-country')
        if (!res.ok) throw new Error('Failed to load')
        const data: { trending: SpotifyArtistResult[]; classics: SpotifyArtistResult[]; configured: boolean } =
          await res.json()
        if (cancelled) return
        setTrending(data.trending ?? [])
        setClassics(data.classics ?? [])
      } catch {
        // Artists failed to load — genres still work, user can proceed
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const toggleGenre = (id: string) => {
    setSelectedGenres((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    )
  }

  const toggleArtist = (artist: SpotifyArtistResult) => {
    setSelectedArtistMap((prev) => {
      const next = new Map(prev)
      if (next.has(artist.id)) {
        next.delete(artist.id)
      } else {
        next.set(artist.id, {
          name: artist.name,
          apple_music_id: artist.id,
          image_url: artist.image_url,
          apple_music_url: artist.apple_music_url,
        })
      }
      return next
    })
  }

  const handleContinue = async () => {
    setIsSaving(true)
    const artists = Array.from(selectedArtistMap.values())
    try {
      await fetch('/api/profile/save-taste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          favorite_genres:       selectedGenres,
          favorite_artist_ids:   artists.map((a) => a.apple_music_id),
          favorite_artist_names: artists.map((a) => a.name),
          personality_types:     personalityTypes,
        }),
      })
    } catch {
      // Save failed — proceed anyway so user isn't blocked
    } finally {
      setIsSaving(false)
    }
    onSuccess(selectedGenres, artists)
  }

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-6">
        <div
          className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-900/30 mb-4"
          aria-hidden="true"
        >
          <span className="text-2xl">🎵</span>
        </div>
        <h2 className="text-2xl font-bold text-white mb-1">What&apos;s Your Sound?</h2>
        <p className="text-stone-400 text-sm">
          Tap the genres and artists you vibe with — we&apos;ll find your people.
        </p>
      </div>

      {/* Genres */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-stone-500 mb-3">
          🎼 Genres
        </p>
        <div className="flex flex-wrap gap-2">
          {COUNTRY_GENRES.map((g) => (
            <GenrePill
              key={g.id}
              genre={g}
              selected={selectedGenres.includes(g.id)}
              onToggle={() => toggleGenre(g.id)}
            />
          ))}
        </div>
      </div>

      {/* Artist sections */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-stone-600">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          <span className="text-sm">Loading artists…</span>
        </div>
      ) : (
        <div className="space-y-6 mb-6">
          <ArtistGrid
            title="Classic Icons"
            emoji="🏆"
            artists={classics}
            selectedIds={selectedIds}
            onToggle={toggleArtist}
          />
          <ArtistGrid
            title="Trending Now"
            emoji="🔥"
            artists={trending}
            selectedIds={selectedIds}
            onToggle={toggleArtist}
          />
        </div>
      )}

      {/* Selection count hint */}
      <p className="text-center text-xs text-stone-600 mb-4" aria-live="polite" aria-atomic="true">
        {totalSelected === 0
          ? 'Tap anything that matches your taste'
          : `${totalSelected} selection${totalSelected !== 1 ? 's' : ''} — nice taste 🤙`}
      </p>

      {/* Actions */}
      <Button
        variant="primary"
        className="w-full"
        onClick={handleContinue}
        disabled={isSaving}
      >
        {isSaving ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Saving…
          </span>
        ) : totalSelected > 0 ? (
          `Continue with ${totalSelected} pick${totalSelected !== 1 ? 's' : ''}`
        ) : (
          'Continue'
        )}
      </Button>

      <button
        type="button"
        onClick={onSkip}
        className="w-full mt-3 text-sm text-stone-500 hover:text-stone-200 font-medium transition-colors py-2"
      >
        Skip for now
      </button>
    </div>
  )
}
