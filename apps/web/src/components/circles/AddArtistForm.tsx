'use client'

import { useState, useCallback, useRef } from 'react'
import { Search, User, X, ExternalLink } from 'lucide-react'
import type { AppleMusicArtistResult as ArtistResult } from '@/lib/appleMusic'

interface Props {
  circleId: string
  onAdded: () => void
}

export default function AddArtistForm({ circleId, onAdded }: Props) {
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState<ArtistResult[]>([])
  const [searching, setSearching]   = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const [picked, setPicked]         = useState<ArtistResult | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [success, setSuccess]       = useState(false)

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback((q: string) => {
    setQuery(q)
    setPicked(null)
    if (debounce.current) clearTimeout(debounce.current)
    if (!q.trim()) { setResults([]); setDropdownOpen(false); return }
    debounce.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/artists/spotify-search?q=${encodeURIComponent(q)}`)
        if (!res.ok) return
        const json: { artists: ArtistResult[]; error?: string } = await res.json()
        if (json.error === 'not_configured') return // no credentials — let user type name
        setResults(json.artists ?? [])
        setDropdownOpen(true)
      } finally { setSearching(false) }
    }, 350)
  }, [])

  const pick = useCallback((r: ArtistResult) => {
    setPicked(r)
    setQuery('')
    setResults([])
    setDropdownOpen(false)
  }, [])

  const clear = useCallback(() => {
    setPicked(null)
    setQuery('')
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const artistName = picked?.name ?? query.trim()
    if (!artistName) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/circles/${circleId}/artists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist_name: artistName,
        }),
      })
      const data: { success?: boolean; error?: string } = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to add artist')
      setQuery('')
      setPicked(null)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2500)
      onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add artist')
    } finally { setSubmitting(false) }
  }, [picked, query, circleId, onAdded])

  const canSubmit = !!(picked?.name ?? query.trim())

  return (
    <form onSubmit={handleSubmit} className="space-y-3">

      {/* Search box */}
      {!picked && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
          <input
            type="text"
            placeholder="Search Apple Music or type name…"
            value={query}
            onChange={(e) => search(e.target.value)}
            onFocus={() => results.length > 0 && setDropdownOpen(true)}
            onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
            className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
          )}

          {dropdownOpen && results.length > 0 && (
            <ul className="absolute z-50 w-full mt-1 bg-stone-800 border border-stone-700 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onMouseDown={() => pick(r)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-pink-950/30 transition-colors text-left"
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
                      {r.genres.length > 0 && (
                        <p className="text-xs text-stone-500 truncate capitalize">{r.genres.slice(0, 2).join(', ')}</p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!searching && query.trim() && results.length === 0 && dropdownOpen && (
            <div className="absolute z-50 w-full mt-1 bg-stone-800 border border-stone-700 rounded-xl px-4 py-3 text-sm text-stone-500">
              No results — artist will be added by name only.
            </div>
          )}
        </div>
      )}

      {/* Picked artist preview */}
      {picked && (
        <div className="flex items-center gap-3 px-3 py-2.5 bg-stone-800 border border-pink-700/50 rounded-xl">
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
              <p className="text-xs text-stone-400 truncate capitalize">{picked.genres.slice(0, 3).join(', ')}</p>
            )}
            <a
              href={picked.apple_music_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-pink-400 hover:text-pink-300 mt-0.5"
            >
              <ExternalLink className="w-3 h-3" /> Open on Apple Music
            </a>
          </div>
          <button type="button" onClick={clear} className="shrink-0 text-stone-500 hover:text-stone-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400 bg-red-950/30 border border-red-800 rounded-lg px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-400 bg-green-950/30 border border-green-800 rounded-lg px-3 py-2">Artist added!</p>
      )}

      <button
        type="submit"
        disabled={submitting || !canSubmit}
        className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
      >
        {submitting ? 'Adding…' : 'Add Artist'}
      </button>
    </form>
  )
}
