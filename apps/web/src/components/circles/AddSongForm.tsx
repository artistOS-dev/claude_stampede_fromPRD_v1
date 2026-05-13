'use client'

import { useState, useCallback, useRef } from 'react'
import { Search, Music, X, ExternalLink } from 'lucide-react'
import type { AppleMusicTrackResult as TrackResult } from '@/lib/appleMusic'
import type { MetadataResult } from '@/app/api/songs/metadata-search/route'

interface Props {
  circleId: string
  onAdded: () => void
  onClose: () => void
}

type SearchResult = {
  id: string
  title: string
  artist: string
  album: string
  cover_url: string | null
  apple_music_url: string | null
  source_url: string | null
  source_label: 'Apple Music' | 'iTunes'
}

function fromApple(t: TrackResult): SearchResult {
  return {
    id: t.id,
    title: t.title,
    artist: t.artist,
    album: t.album,
    cover_url: t.cover_url,
    apple_music_url: t.apple_music_url || null,
    source_url: t.apple_music_url || null,
    source_label: 'Apple Music',
  }
}

function fromItunes(r: MetadataResult): SearchResult {
  return {
    id: r.id,
    title: r.title,
    artist: r.artist,
    album: r.album ?? '',
    cover_url: r.cover_url,
    apple_music_url: r.source_url ?? null,
    source_url: r.source_url ?? null,
    source_label: 'iTunes',
  }
}

export default function AddSongForm({ circleId, onAdded, onClose }: Props) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [appleMusicAvailable, setAppleMusicAvailable] = useState<boolean | null>(null)

  const [title, setTitle]           = useState('')
  const [artist, setArtist]         = useState('')
  const [album, setAlbum]           = useState('')
  const [appleMusicUrl, setAppleUrl] = useState('')
  const [coverUrl, setCoverUrl]     = useState<string | null>(null)
  const [picked, setPicked]         = useState<SearchResult | null>(null)

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
        // Try Apple Music first
        const amRes = await fetch(`/api/songs/spotify-search?q=${encodeURIComponent(q)}&limit=20`)
        if (amRes.ok) {
          const json: { tracks: TrackResult[]; spotify_available: boolean } = await amRes.json()
          if (json.spotify_available) {
            setAppleMusicAvailable(true)
            setResults(json.tracks.map(fromApple))
            setDropdownOpen(true)
            return
          }
        }
        // Fall back to iTunes
        setAppleMusicAvailable(false)
        const itunesRes = await fetch(`/api/songs/metadata-search?q=${encodeURIComponent(q)}`)
        if (itunesRes.ok) {
          const json: { results: MetadataResult[] } = await itunesRes.json()
          setResults((json.results ?? []).map(fromItunes))
          setDropdownOpen(true)
        }
      } finally { setSearching(false) }
    }, 350)
  }, [])

  const pick = useCallback((r: SearchResult) => {
    setPicked(r)
    setTitle(r.title)
    setArtist(r.artist)
    setAlbum(r.album)
    setCoverUrl(r.cover_url)
    setAppleUrl(r.apple_music_url ?? '')
    setQuery('')
    setResults([])
    setDropdownOpen(false)
  }, [])

  const clear = useCallback(() => {
    setPicked(null)
    setTitle(''); setArtist(''); setAlbum('')
    setCoverUrl(null); setAppleUrl('')
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
          apple_music_url: appleMusicUrl.trim() || null,
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
  }, [title, artist, album, appleMusicUrl, coverUrl, circleId, onAdded, onClose])

  return (
    <div className="bg-amber-950/20 border border-amber-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white text-sm">Share a new song</h3>
          {appleMusicAvailable === true && (
            <p className="text-xs text-pink-400 mt-0.5">Searching Apple Music</p>
          )}
          {appleMusicAvailable === false && (
            <p className="text-xs text-stone-500 mt-0.5">Searching iTunes (Apple Music not configured)</p>
          )}
        </div>
        <button type="button" onClick={onClose} className="text-stone-500 hover:text-stone-300 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      {!picked && (
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
            <ul className="absolute z-50 w-full mt-1 bg-stone-800 border border-stone-700 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
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
                    <div className="min-w-0 flex-1">
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
      {picked && (
        <div className="flex items-center gap-3 px-3 py-2.5 bg-stone-800 border border-amber-700/50 rounded-xl">
          {picked.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={picked.cover_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-stone-700 flex items-center justify-center shrink-0">
              <Music className="w-5 h-5 text-stone-500" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{picked.title}</p>
            <p className="text-xs text-stone-400 truncate">{picked.artist}{picked.album ? ` · ${picked.album}` : ''}</p>
            {picked.source_url && (
              <a href={picked.source_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-pink-500 hover:text-pink-400 mt-0.5">
                <ExternalLink className="w-3 h-3" /> {picked.source_label}
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
            <input required type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Fast Car"
              className="w-full px-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1">Artist *</label>
            <input required type="text" value={artist} onChange={(e) => setArtist(e.target.value)}
              placeholder="e.g. Tracy Chapman"
              className="w-full px-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1">Album</label>
            <input type="text" value={album} onChange={(e) => setAlbum(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1">Apple Music link</label>
            <input type="url" value={appleMusicUrl} onChange={(e) => setAppleUrl(e.target.value)}
              placeholder="https://music.apple.com/…"
              className="w-full px-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/30 border border-red-800 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-2">
          <button type="submit" disabled={submitting || !title.trim() || !artist.trim()}
            className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
            {submitting ? 'Sharing…' : 'Share'}
          </button>
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-sm font-medium transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
