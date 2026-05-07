'use client'

import { useState, useCallback, useRef } from 'react'
import { Search, ChevronRight, ChevronLeft, Music, Check, X, Disc, AlertCircle } from 'lucide-react'
import type { SpotifyArtistResult, SpotifyAlbumResult, SpotifyAlbumWithTracks, SpotifyTrackResult } from '@/lib/spotify'

interface BulkSong {
  title: string
  artist: string
  album: string
  cover_url: string | null
  spotify_url: string | null
  release_year?: number | null
}

interface Props {
  // Call the appropriate bulk endpoint
  onImport: (songs: BulkSong[]) => Promise<{ inserted: number; skipped: number }>
  onClose: () => void
}

type Step = 'artist' | 'albums' | 'tracks'

function releaseYear(date: string): number | null {
  const y = Number(date?.slice(0, 4))
  return isNaN(y) ? null : y
}

export default function SpotifyAlbumImport({ onImport, onClose }: Props) {
  // Step 1: artist search
  const [artistQuery, setArtistQuery]     = useState('')
  const [artists, setArtists]             = useState<SpotifyArtistResult[]>([])
  const [artistSearching, setArtistSearching] = useState(false)
  const [selectedArtist, setSelectedArtist] = useState<SpotifyArtistResult | null>(null)

  // Step 2: album list
  const [albums, setAlbums]               = useState<SpotifyAlbumResult[]>([])
  const [albumsLoading, setAlbumsLoading] = useState(false)
  const [selectedAlbum, setSelectedAlbum] = useState<SpotifyAlbumWithTracks | null>(null)

  // Step 3: track selection
  const [tracksLoading, setTracksLoading] = useState(false)
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set())

  // Import
  const [importing, setImporting]   = useState(false)
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number } | null>(null)
  const [error, setError]           = useState<string | null>(null)

  const [step, setStep] = useState<Step>('artist')

  const artistDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Step 1: Search artists ─────────────────────────────────────────────────

  const searchArtists = useCallback((q: string) => {
    setArtistQuery(q)
    setArtists([])
    if (artistDebounce.current) clearTimeout(artistDebounce.current)
    if (!q.trim()) return
    artistDebounce.current = setTimeout(async () => {
      setArtistSearching(true)
      try {
        const res = await fetch(`/api/artists/spotify-search?q=${encodeURIComponent(q)}`)
        if (!res.ok) return
        const json: { artists: SpotifyArtistResult[] } = await res.json()
        setArtists(json.artists ?? [])
      } finally { setArtistSearching(false) }
    }, 350)
  }, [])

  const pickArtist = useCallback(async (artist: SpotifyArtistResult) => {
    setSelectedArtist(artist)
    setStep('albums')
    setAlbumsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/songs/spotify-artist-albums?artist_id=${artist.id}`)
      if (!res.ok) throw new Error('Failed to load albums')
      const json: { albums: SpotifyAlbumResult[] } = await res.json()
      setAlbums(json.albums ?? [])
    } catch {
      setError('Could not load albums. Check Spotify credentials.')
      setStep('artist')
    } finally { setAlbumsLoading(false) }
  }, [])

  // ── Step 2: Pick album ─────────────────────────────────────────────────────

  const pickAlbum = useCallback(async (album: SpotifyAlbumResult) => {
    setStep('tracks')
    setTracksLoading(true)
    setError(null)
    setSelectedTrackIds(new Set())
    try {
      const res = await fetch(`/api/songs/spotify-album?album_id=${album.id}`)
      if (!res.ok) throw new Error('Failed to load tracks')
      const json: { album: SpotifyAlbumWithTracks } = await res.json()
      setSelectedAlbum(json.album)
      // Select all tracks by default
      setSelectedTrackIds(new Set(json.album.tracks.map((t) => t.id)))
    } catch {
      setError('Could not load tracks.')
      setStep('albums')
    } finally { setTracksLoading(false) }
  }, [])

  // ── Step 3: Toggle tracks ──────────────────────────────────────────────────

  const toggleTrack = (id: string) => {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (!selectedAlbum) return
    if (selectedTrackIds.size === selectedAlbum.tracks.length) {
      setSelectedTrackIds(new Set())
    } else {
      setSelectedTrackIds(new Set(selectedAlbum.tracks.map((t) => t.id)))
    }
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!selectedAlbum || selectedTrackIds.size === 0) return
    setImporting(true)
    setError(null)
    try {
      const songs: BulkSong[] = selectedAlbum.tracks
        .filter((t) => selectedTrackIds.has(t.id))
        .map((t) => ({
          title: t.title,
          artist: t.artist,
          album: selectedAlbum.name,
          cover_url: selectedAlbum.cover_url,
          spotify_url: t.spotify_url,
          release_year: releaseYear(selectedAlbum.release_date),
        }))
      const result = await onImport(songs)
      setImportResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally { setImporting(false) }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-2">
            {step !== 'artist' && !importResult && (
              <button
                type="button"
                onClick={() => step === 'tracks' ? setStep('albums') : setStep('artist')}
                className="text-stone-500 hover:text-white transition-colors mr-1"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <Disc className="w-4 h-4 text-green-400" />
            <h3 className="font-bold text-white text-sm">
              {importResult ? 'Import Complete' :
               step === 'artist' ? 'Import from Spotify' :
               step === 'albums' ? selectedArtist?.name :
               selectedAlbum?.name}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-stone-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Done ── */}
          {importResult && (
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-green-950/40 border border-green-700 flex items-center justify-center mx-auto">
                <Check className="w-6 h-6 text-green-400" />
              </div>
              <p className="text-lg font-bold text-white">{importResult.inserted} song{importResult.inserted !== 1 ? 's' : ''} added</p>
              {importResult.skipped > 0 && (
                <p className="text-sm text-stone-500">{importResult.skipped} already existed and were skipped</p>
              )}
              <button type="button" onClick={onClose}
                className="mt-4 px-6 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors">
                Done
              </button>
            </div>
          )}

          {/* ── Artist search ── */}
          {!importResult && step === 'artist' && (
            <div className="p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search for an artist on Spotify…"
                  value={artistQuery}
                  onChange={(e) => searchArtists(e.target.value)}
                  className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                {artistSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                )}
              </div>

              {artists.length > 0 && (
                <ul className="space-y-1">
                  {artists.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => pickArtist(a)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-800 transition-colors text-left group"
                      >
                        {a.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.image_url} alt={a.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-stone-700 flex items-center justify-center shrink-0">
                            <Music className="w-4 h-4 text-stone-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{a.name}</p>
                          {a.genres.length > 0 && (
                            <p className="text-xs text-stone-500 truncate capitalize">{a.genres.slice(0, 2).join(', ')}</p>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-stone-600 group-hover:text-green-400 transition-colors shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/30 border border-red-800 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* ── Album list ── */}
          {!importResult && step === 'albums' && (
            <div className="p-4 space-y-1">
              {albumsLoading && (
                <div className="flex justify-center py-12">
                  <div className="w-6 h-6 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
                </div>
              )}
              {!albumsLoading && albums.map((album) => (
                <button
                  key={album.id}
                  type="button"
                  onClick={() => pickAlbum(album)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-800 transition-colors text-left group"
                >
                  {album.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={album.cover_url} alt={album.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-stone-700 flex items-center justify-center shrink-0">
                      <Disc className="w-5 h-5 text-stone-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{album.name}</p>
                    <p className="text-xs text-stone-500">
                      {releaseYear(album.release_date)} · {album.total_tracks} track{album.total_tracks !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-600 group-hover:text-green-400 transition-colors shrink-0" />
                </button>
              ))}
              {!albumsLoading && albums.length === 0 && (
                <p className="text-sm text-stone-600 text-center py-8">No albums found</p>
              )}
            </div>
          )}

          {/* ── Track selection ── */}
          {!importResult && step === 'tracks' && (
            <div className="p-4 space-y-2">
              {tracksLoading && (
                <div className="flex justify-center py-12">
                  <div className="w-6 h-6 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
                </div>
              )}
              {!tracksLoading && selectedAlbum && (
                <>
                  {/* Album header */}
                  <div className="flex items-center gap-3 pb-2 border-b border-stone-800">
                    {selectedAlbum.cover_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selectedAlbum.cover_url} alt={selectedAlbum.name} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-bold text-white">{selectedAlbum.name}</p>
                      <p className="text-xs text-stone-500">{selectedAlbum.artist} · {releaseYear(selectedAlbum.release_date)}</p>
                      <button type="button" onClick={toggleAll}
                        className="text-xs text-green-400 hover:text-green-300 transition-colors mt-0.5">
                        {selectedTrackIds.size === selectedAlbum.tracks.length ? 'Deselect all' : 'Select all'}
                      </button>
                    </div>
                  </div>

                  {/* Track list */}
                  <ul className="space-y-0.5">
                    {selectedAlbum.tracks.map((track, i) => (
                      <li key={track.id}>
                        <button
                          type="button"
                          onClick={() => toggleTrack(track.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                            selectedTrackIds.has(track.id) ? 'bg-green-950/20 hover:bg-green-950/30' : 'hover:bg-stone-800'
                          }`}
                        >
                          <span className="text-xs text-stone-600 w-5 shrink-0 text-right tabular-nums">{i + 1}</span>
                          <div className={`w-4 h-4 rounded shrink-0 border flex items-center justify-center transition-colors ${
                            selectedTrackIds.has(track.id)
                              ? 'bg-green-500 border-green-500'
                              : 'border-stone-600'
                          }`}>
                            {selectedTrackIds.has(track.id) && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{track.title}</p>
                            <p className="text-xs text-stone-500 truncate">{track.artist}</p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

        </div>

        {/* Footer — import button */}
        {!importResult && step === 'tracks' && selectedAlbum && !tracksLoading && (
          <div className="shrink-0 px-5 py-4 border-t border-stone-800 flex items-center justify-between gap-3">
            {error && <p className="text-xs text-red-400 flex-1">{error}</p>}
            {!error && (
              <p className="text-xs text-stone-500 flex-1">
                {selectedTrackIds.size} of {selectedAlbum.tracks.length} track{selectedAlbum.tracks.length !== 1 ? 's' : ''} selected
              </p>
            )}
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || selectedTrackIds.size === 0}
              className="shrink-0 px-5 py-2 rounded-xl bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
            >
              {importing ? 'Importing…' : `Import ${selectedTrackIds.size} song${selectedTrackIds.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
