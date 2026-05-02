'use client'

import { useState, useCallback, useRef } from 'react'
import { Search, User, X, ExternalLink } from 'lucide-react'
import type { SpotifyArtistResult } from '@/app/api/artists/spotify-search/route'

interface Props {
  circleId: string
  onAdded: () => void
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

export default function AddArtistForm({ circleId, onAdded }: Props) {
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState<SpotifyArtistResult[]>([])
  const [searching, setSearching]   = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notConfigured, setNotConfigured] = useState(false)

  const [picked, setPicked]         = useState<SpotifyArtistResult | null>(null)
  const [name, setName]             = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [success, setSuccess]       = useState(false)

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback((q: string) => {
    setQuery(q)
    setPicked(null)
    setName(q)
    if (debounce.current) clearTimeout(debounce.current)
    if (!q.trim()) { setResults([]); setDropdownOpen(false); return }
    debounce.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/artists/spotify-search?q=${encodeURIComponent(q)}`)
        if (!res.ok) return
        const json: { artists: SpotifyArtistResult[]; error?: string } = await res.json()
        if (json.error === 'not_configured') { setNotConfigured(true); return }
        setResults(json.artists ?? [])
        setDropdownOpen(true)
      } finally { setSearching(false) }
    }, 350)
  }, [])

  const pick = useCallback((r: SpotifyArtistResult) => {
    setPicked(r)
    setName(r.name)
    setQuery('')
    setResults([])
    setDropdownOpen(false)
  }, [])

  const clear = useCallback(() => {
    setPicked(null)
    setName('')
    setQuery('')
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/circles/${circleId}/artists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist_name: name.trim(),
          spotify_url: picked?.spotify_url ?? null,
          spotify_image_url: picked?.image_url ?? null,
        }),
      })
      const data: { success?: boolean; error?: string } = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to add artist')
      setName('')
      setPicked(null)
      setQuery('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2500)
      onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add artist')
    } finally { setSubmitting(false) }
  }, [name, picked, circleId, onAdded])

  return (
    <form onSubmit={handleSubmit} className="space-y-3">

      {/* Search / picked */}
      {!picked ? (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
          <input
            type="text"
            placeholder={notConfigured ? 'Type artist name…' : 'Search Spotify for an artist…'}
            value={query}
            onChange={(e) => search(e.target.value)}
            onFocus={() => results.length > 0 && setDropdownOpen(true)}
            onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
            className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          )}

          {dropdownOpen && results.length > 0 && (
            <ul className="absolute z-50 w-full mt-1 bg-stone-800 border border-stone-700 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onMouseDown={() => pick(r)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-amber-950/30 transition-colors text-left"
                  >
                    {r.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.image_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-stone-700 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-stone-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{r.name}</p>
                      <p className="text-xs text-stone-500 truncate">
                        {r.followers > 0 && `${formatFollowers(r.followers)} followers`}
                        {r.genres.length > 0 && r.followers > 0 && ' · '}
                        {r.genres.slice(0, 2).join(', ')}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!searching && query.trim() && results.length === 0 && dropdownOpen && (
            <div className="absolute z-50 w-full mt-1 bg-stone-800 border border-stone-700 rounded-xl px-4 py-3 text-sm text-stone-500">
              No results found on Spotify.
            </div>
          )}
        </div>
      ) : (
        /* Picked artist preview */
        <div className="flex items-center gap-3 px-3 py-2.5 bg-stone-800 border border-amber-700/50 rounded-xl">
          {picked.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={picked.image_url} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-stone-700 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-stone-500" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{picked.name}</p>
            {picked.genres.length > 0 && (
              <p className="text-xs text-stone-400 truncate">{picked.genres.slice(0, 3).join(', ')}</p>
            )}
            <a
              href={picked.spotify_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-green-400 hover:text-green-300 mt-0.5"
            >
              <ExternalLink className="w-3 h-3" /> Open on Spotify
            </a>
          </div>
          <button type="button" onClick={clear} className="shrink-0 text-stone-500 hover:text-stone-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Name field (visible when not picked via Spotify, or when manually editing) */}
      {!picked && (
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Artist name *"
          className="w-full px-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      )}

      {error && (
        <p className="text-sm text-red-400 bg-red-950/30 border border-red-800 rounded-lg px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-400 bg-green-950/30 border border-green-800 rounded-lg px-3 py-2">Artist added!</p>
      )}

      <button
        type="submit"
        disabled={submitting || !name.trim()}
        className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
      >
        {submitting ? 'Adding…' : 'Add Artist'}
      </button>
    </form>
  )
}
