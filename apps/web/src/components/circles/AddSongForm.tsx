'use client'

import { useState, useCallback, useRef } from 'react'
import { Search, Music, X, ExternalLink } from 'lucide-react'
import type { MetadataResult } from '@/app/api/songs/metadata-search/route'

interface Props {
  circleId: string
  onAdded: () => void
  onClose: () => void
}

export default function AddSongForm({ circleId, onAdded, onClose }: Props) {
  // Search state
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<MetadataResult[]>([])
  const [searching, setSearching] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // Form state (pre-filled from search or typed manually)
  const [title, setTitle]         = useState('')
  const [artist, setArtist]       = useState('')
  const [album, setAlbum]         = useState('')
  const [spotifyUrl, setSpotify]  = useState('')
  const [coverUrl, setCoverUrl]   = useState<string | null>(null)
  const [pickedResult, setPicked] = useState<MetadataResult | null>(null)

  // Submit state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback((q: string) => {
    setQuery(q)
    setPicked(null)
    if (debounce.current) clearTimeout(debounce.current)
    if (!q.trim()) { setResults([]); setDropdownOpen(false); return }
    debounce.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/songs/metadata-search?q=${encodeURIComponent(q)}`)
        if (!res.ok) return
        const json: { results: MetadataResult[] } = await res.json()
        setResults(json.results ?? [])
        setDropdownOpen(true)
      } finally { setSearching(false) }
    }, 350)
  }, [])

  const pick = useCallback((r: MetadataResult) => {
    setPicked(r)
    setTitle(r.title)
    setArtist(r.artist)
    setAlbum(r.album ?? '')
    setCoverUrl(r.cover_url)
    setQuery('')
    setResults([])
    setDropdownOpen(false)
  }, [])

  const clear = useCallback(() => {
    setPicked(null)
    setTitle(''); setArtist(''); setAlbum('')
    setCoverUrl(null); setSpotify('')
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !artist.trim()) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/circles/${circleId}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          artist: artist.trim(),
          album: album.trim() || null,
          spotify_url: spotifyUrl.trim() || null,
          cover_url: coverUrl || null,
        }),
      })
      const data: { success?: boolean; error?: string } = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to add song')
      onAdded()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add song')
    } finally { setSubmitting(false) }
  }, [title, artist, album, spotifyUrl, coverUrl, circleId, onAdded, onClose])

  return (
    <div className="bg-amber-950/20 border border-amber-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white text-sm">Share a new song</h3>
        <button type="button" onClick={onClose} className="text-stone-500 hover:text-stone-300 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      {!pickedResult && (
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
            <input
              type="text"
              placeholder="Search song or artist…"
              value={query}
              onChange={(e) => search(e.target.value)}
              onFocus={() => results.length > 0 && setDropdownOpen(true)}
              onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
              className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {dropdownOpen && results.length > 0 && (
            <ul className="absolute z-50 w-full mt-1 bg-stone-800 border border-stone-700 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onMouseDown={() => pick(r)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-amber-950/30 transition-colors text-left"
                  >
                    {r.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.cover_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-stone-700 flex items-center justify-center shrink-0">
                        <Music className="w-4 h-4 text-stone-500" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{r.title}</p>
                      <p className="text-xs text-stone-500 truncate">{r.artist}{r.album ? ` · ${r.album}` : ''}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!searching && query.trim() && results.length === 0 && dropdownOpen && (
            <div className="absolute z-50 w-full mt-1 bg-stone-800 border border-stone-700 rounded-xl px-4 py-3 text-sm text-stone-500">
              No results — fill in the fields below manually.
            </div>
          )}
        </div>
      )}

      {/* Picked result preview */}
      {pickedResult && (
        <div className="flex items-center gap-3 px-3 py-2.5 bg-stone-800 border border-amber-700/50 rounded-xl">
          {pickedResult.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pickedResult.cover_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-stone-700 flex items-center justify-center shrink-0">
              <Music className="w-5 h-5 text-stone-500" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{pickedResult.title}</p>
            <p className="text-xs text-stone-400 truncate">{pickedResult.artist}{pickedResult.album ? ` · ${pickedResult.album}` : ''}</p>
            {pickedResult.source_url && (
              <a href={pickedResult.source_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 mt-0.5">
                <ExternalLink className="w-3 h-3" /> Apple Music
              </a>
            )}
          </div>
          <button type="button" onClick={clear} className="shrink-0 text-stone-500 hover:text-stone-300 transition-colors" title="Clear">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Editable fields */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1">Title *</label>
            <input
              required
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Fast Car"
              className="w-full px-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1">Artist *</label>
            <input
              required
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="e.g. Tracy Chapman"
              className="w-full px-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1">Album</label>
            <input
              type="text"
              value={album}
              onChange={(e) => setAlbum(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1">Spotify link</label>
            <input
              type="url"
              value={spotifyUrl}
              onChange={(e) => setSpotify(e.target.value)}
              placeholder="https://open.spotify.com/…"
              className="w-full px-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/30 border border-red-800 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting || !title.trim() || !artist.trim()}
            className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
          >
            {submitting ? 'Sharing…' : 'Share'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
