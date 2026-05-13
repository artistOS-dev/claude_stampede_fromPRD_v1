'use client'

import { useState, useCallback, useRef } from 'react'
import { Search, ChevronRight, ChevronLeft, Music, Check, X, Disc, AlertCircle, ChevronDown } from 'lucide-react'
import type { AppleMusicArtistResult, AppleMusicAlbumResult, AppleMusicTrackResult } from '@/lib/appleMusic'

interface BulkSong {
  title: string
  artist: string
  album: string
  cover_url: string | null
  apple_music_url: string | null
  preview_url?: string | null
  release_year?: number | null
}

interface Props {
  onImport: (songs: BulkSong[]) => Promise<{ inserted: number; skipped: number }>
  onClose: () => void
}

type Step = 'artist' | 'albums'

interface AlbumState {
  album: AppleMusicAlbumResult
  tracks: AppleMusicTrackResult[] | 'loading' | null
  expanded: boolean
  selectedIds: Set<string>
  allSelected: boolean
}

function releaseYear(date: string): number | null {
  const y = Number(date?.slice(0, 4))
  return isNaN(y) ? null : y
}

export default function SpotifyAlbumImport({ onImport, onClose }: Props) {
  // Step 1
  const [artistQuery, setArtistQuery]   = useState('')
  const [artists, setArtists]           = useState<AppleMusicArtistResult[]>([])
  const [artistSearching, setArtistSearching] = useState(false)
  const [appleMusicConfigured, setAppleMusicConfigured] = useState<boolean | null>(null)
  const [selectedArtist, setSelectedArtist]   = useState<AppleMusicArtistResult | null>(null)

  // Step 2
  const [albumStates, setAlbumStates]     = useState<AlbumState[]>([])
  const [albumsLoading, setAlbumsLoading] = useState(false)

  const [step, setStep] = useState<Step>('artist')

  // Import
  const [importing, setImporting]       = useState(false)
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number } | null>(null)
  const [error, setError]               = useState<string | null>(null)

  const artistDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Artist search ────────────────────────────────────────────────────────

  const searchArtists = useCallback((q: string) => {
    setArtistQuery(q)
    setArtists([])
    if (artistDebounce.current) clearTimeout(artistDebounce.current)
    if (!q.trim()) return
    artistDebounce.current = setTimeout(async () => {
      setArtistSearching(true)
      try {
        const res = await fetch(`/api/artists/spotify-search?q=${encodeURIComponent(q)}`)
        if (res.ok) {
          const json: { artists: AppleMusicArtistResult[]; error?: string } = await res.json()
          if (json.error === 'not_configured') {
            setAppleMusicConfigured(false)
            setArtists([])
          } else {
            setAppleMusicConfigured(true)
            setArtists(json.artists ?? [])
          }
        }
      } finally { setArtistSearching(false) }
    }, 350)
  }, [])

  const pickArtist = useCallback(async (artist: AppleMusicArtistResult) => {
    setSelectedArtist(artist)
    setStep('albums')
    setAlbumsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/songs/spotify-artist-albums?artist_id=${artist.id}`)
      if (!res.ok) throw new Error('Failed to load albums')
      const json: { albums: AppleMusicAlbumResult[] } = await res.json()
      setAlbumStates(json.albums.map((a) => ({
        album: a,
        tracks: null,
        expanded: false,
        selectedIds: new Set(),
        allSelected: false,
      })))
    } catch {
      setError('Could not load albums. Check Apple Music credentials.')
      setStep('artist')
    } finally { setAlbumsLoading(false) }
  }, [])

  // ── Album-level toggles ───────────────────────────────────────────────────

  const toggleAlbumAll = useCallback(async (albumId: string) => {
    setAlbumStates((prev) => {
      const idx = prev.findIndex((s) => s.album.id === albumId)
      if (idx === -1) return prev
      const state = prev[idx]
      const next = [...prev]

      if (state.allSelected) {
        next[idx] = { ...state, allSelected: false, selectedIds: new Set() }
        return next
      }

      if (Array.isArray(state.tracks)) {
        next[idx] = {
          ...state,
          allSelected: true,
          selectedIds: new Set(state.tracks.map((t) => t.id)),
        }
        return next
      }

      next[idx] = { ...state, allSelected: true, tracks: 'loading' }
      return next
    })

    setAlbumStates((prev) => {
      const state = prev.find((s) => s.album.id === albumId)
      if (!state || Array.isArray(state.tracks)) return prev
      fetch(`/api/songs/spotify-album?album_id=${albumId}`)
        .then((r) => r.json())
        .then((json: { album: { tracks: AppleMusicTrackResult[] } }) => {
          setAlbumStates((p) => p.map((s) => {
            if (s.album.id !== albumId) return s
            const tracks = json.album?.tracks ?? []
            return {
              ...s,
              tracks,
              selectedIds: s.allSelected ? new Set(tracks.map((t) => t.id)) : new Set(),
            }
          }))
        })
        .catch(() => {
          setAlbumStates((p) => p.map((s) =>
            s.album.id === albumId ? { ...s, tracks: null, allSelected: false } : s
          ))
        })
      return prev
    })
  }, [])

  const expandAlbum = useCallback(async (albumId: string) => {
    setAlbumStates((prev) => {
      const idx = prev.findIndex((s) => s.album.id === albumId)
      if (idx === -1) return prev
      const state = prev[idx]
      const next = [...prev]

      if (state.expanded) {
        next[idx] = { ...state, expanded: false }
        return next
      }

      if (state.tracks === null) {
        next[idx] = { ...state, expanded: true, tracks: 'loading' }
        fetch(`/api/songs/spotify-album?album_id=${albumId}`)
          .then((r) => r.json())
          .then((json: { album: { tracks: AppleMusicTrackResult[] } }) => {
            setAlbumStates((p) => p.map((s) => {
              if (s.album.id !== albumId) return s
              const tracks = json.album?.tracks ?? []
              return {
                ...s,
                tracks,
                selectedIds: s.allSelected ? new Set(tracks.map((t) => t.id)) : s.selectedIds,
              }
            }))
          })
          .catch(() => {
            setAlbumStates((p) => p.map((s) =>
              s.album.id === albumId ? { ...s, tracks: null, expanded: false } : s
            ))
          })
      } else {
        next[idx] = { ...state, expanded: true }
      }
      return next
    })
  }, [])

  const toggleTrack = useCallback((albumId: string, trackId: string) => {
    setAlbumStates((prev) => prev.map((s) => {
      if (s.album.id !== albumId) return s
      const next = new Set(s.selectedIds)
      if (next.has(trackId)) next.delete(trackId)
      else next.add(trackId)
      const tracks = Array.isArray(s.tracks) ? s.tracks : []
      return { ...s, selectedIds: next, allSelected: next.size === tracks.length && tracks.length > 0 }
    }))
  }, [])

  // ── Select / deselect all albums ─────────────────────────────────────────

  const allAlbumsSelected = albumStates.length > 0 && albumStates.every((s) => s.allSelected)

  const toggleSelectAll = useCallback(async () => {
    if (allAlbumsSelected) {
      setAlbumStates((prev) => prev.map((s) => ({ ...s, allSelected: false, selectedIds: new Set() })))
      return
    }
    const toLoad = albumStates.filter((s) => s.tracks === null).map((s) => s.album.id)
    setAlbumStates((prev) => prev.map((s) => ({
      ...s,
      allSelected: true,
      tracks: s.tracks === null ? 'loading' : s.tracks,
      selectedIds: Array.isArray(s.tracks) ? new Set(s.tracks.map((t) => t.id)) : s.selectedIds,
    })))

    await Promise.all(toLoad.map(async (albumId) => {
      try {
        const res = await fetch(`/api/songs/spotify-album?album_id=${albumId}`)
        const json: { album: { tracks: AppleMusicTrackResult[] } } = await res.json()
        const tracks = json.album?.tracks ?? []
        setAlbumStates((prev) => prev.map((s) =>
          s.album.id === albumId
            ? { ...s, tracks, selectedIds: new Set(tracks.map((t) => t.id)) }
            : s
        ))
      } catch {
        setAlbumStates((prev) => prev.map((s) =>
          s.album.id === albumId ? { ...s, tracks: null, allSelected: false } : s
        ))
      }
    }))
  }, [allAlbumsSelected, albumStates])

  // ── Total selected count ──────────────────────────────────────────────────

  const totalSelected = albumStates.reduce((sum, s) => {
    if (s.allSelected && !Array.isArray(s.tracks)) return sum + s.album.total_tracks
    return sum + s.selectedIds.size
  }, 0)

  // ── Import ────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    setImporting(true)
    setError(null)
    try {
      const songs: BulkSong[] = []
      for (const state of albumStates) {
        if (state.selectedIds.size === 0 && !state.allSelected) continue
        const tracks = Array.isArray(state.tracks) ? state.tracks : []
        const selectedTracks = tracks.filter((t) => state.selectedIds.has(t.id))
        for (const t of selectedTracks) {
          songs.push({
            title: t.title,
            artist: t.artist,
            album: state.album.name,
            cover_url: state.album.cover_url,
            apple_music_url: t.apple_music_url || null,
            preview_url: t.preview_url ?? null,
            release_year: releaseYear(state.album.release_date),
          })
        }
      }
      if (songs.length === 0) { setError('No tracks ready to import — wait for tracks to finish loading'); return }
      const result = await onImport(songs)
      setImportResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally { setImporting(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-2">
            {step === 'albums' && !importResult && (
              <button type="button" onClick={() => setStep('artist')} className="text-stone-500 hover:text-white transition-colors mr-1">
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <Disc className="w-4 h-4 text-pink-400" />
            <h3 className="font-bold text-white text-sm">
              {importResult ? 'Import Complete' : step === 'artist' ? 'Import from Apple Music' : selectedArtist?.name}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-stone-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Done */}
          {importResult && (
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-pink-950/40 border border-pink-700 flex items-center justify-center mx-auto">
                <Check className="w-6 h-6 text-pink-400" />
              </div>
              <p className="text-lg font-bold text-white">
                {importResult.inserted} song{importResult.inserted !== 1 ? 's' : ''} added
              </p>
              {importResult.skipped > 0 && (
                <p className="text-sm text-stone-500">{importResult.skipped} already existed and were skipped</p>
              )}
              <button type="button" onClick={onClose}
                className="mt-4 px-6 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors">
                Done
              </button>
            </div>
          )}

          {/* Step 1 — Artist search */}
          {!importResult && step === 'artist' && (
            <div className="p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                <input type="text" autoFocus placeholder="Search for an artist on Apple Music…"
                  value={artistQuery} onChange={(e) => searchArtists(e.target.value)}
                  className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-pink-500" />
                {artistSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              {appleMusicConfigured === false && (
                <div className="flex items-start gap-2 text-sm text-amber-400 bg-amber-950/30 border border-amber-800 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Apple Music is not configured. Add{' '}
                    <code className="mx-1 text-xs bg-stone-800 px-1 py-0.5 rounded">APPLE_MUSIC_TEAM_ID</code>,{' '}
                    <code className="mx-1 text-xs bg-stone-800 px-1 py-0.5 rounded">APPLE_MUSIC_KEY_ID</code>, and{' '}
                    <code className="mx-1 text-xs bg-stone-800 px-1 py-0.5 rounded">APPLE_MUSIC_PRIVATE_KEY</code>{' '}
                    to your environment.
                  </span>
                </div>
              )}
              {artists.length > 0 && (
                <ul className="space-y-1">
                  {artists.map((a) => (
                    <li key={a.id}>
                      <button type="button" onClick={() => pickArtist(a)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-800 transition-colors text-left group">
                        {a.image_url
                          ? <img src={a.image_url} alt={a.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                          : <div className="w-10 h-10 rounded-full bg-stone-700 flex items-center justify-center shrink-0"><Music className="w-4 h-4 text-stone-500" /></div>}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{a.name}</p>
                          {a.genres.length > 0 && <p className="text-xs text-stone-500 truncate capitalize">{a.genres.slice(0, 2).join(', ')}</p>}
                        </div>
                        <ChevronRight className="w-4 h-4 text-stone-600 group-hover:text-pink-400 transition-colors shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/30 border border-red-800 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />{error}
                </div>
              )}
            </div>
          )}

          {/* Step 2 — Album list with per-album track selection */}
          {!importResult && step === 'albums' && (
            <div className="p-4 space-y-2">
              {albumsLoading && (
                <div className="flex justify-center py-12">
                  <div className="w-6 h-6 rounded-full border-2 border-pink-500 border-t-transparent animate-spin" />
                </div>
              )}

              {!albumsLoading && albumStates.length > 0 && (
                <>
                  <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                    <button type="button" onClick={toggleSelectAll}
                      className="flex items-center gap-2 text-sm font-semibold text-stone-300 hover:text-white transition-colors">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        allAlbumsSelected ? 'bg-pink-500 border-pink-500' : 'border-stone-600'
                      }`}>
                        {allAlbumsSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      Select entire discography
                    </button>
                    <span className="text-xs text-stone-500">{albumStates.length} release{albumStates.length !== 1 ? 's' : ''}</span>
                  </div>

                  {albumStates.map((state) => {
                    const { album, tracks, expanded, selectedIds, allSelected } = state
                    const tracksLoaded   = Array.isArray(tracks)
                    const tracksLoading  = tracks === 'loading'
                    const trackCount     = tracksLoaded ? tracks.length : album.total_tracks
                    const selectedCount  = tracksLoaded ? selectedIds.size : (allSelected ? album.total_tracks : 0)

                    return (
                      <div key={album.id} className="border border-stone-800 rounded-xl overflow-hidden">
                        <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-stone-800/50 transition-colors">
                          <button type="button" onClick={() => toggleAlbumAll(album.id)}
                            className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              allSelected ? 'bg-pink-500 border-pink-500' :
                              selectedCount > 0 ? 'bg-pink-900 border-pink-600' : 'border-stone-600'
                            }`}>
                            {allSelected && <Check className="w-3 h-3 text-white" />}
                            {!allSelected && selectedCount > 0 && <div className="w-2 h-2 bg-pink-400 rounded-sm" />}
                          </button>

                          {album.cover_url
                            ? <img src={album.cover_url} alt={album.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                            : <div className="w-10 h-10 rounded-lg bg-stone-700 flex items-center justify-center shrink-0"><Disc className="w-4 h-4 text-stone-500" /></div>}

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{album.name}</p>
                            <p className="text-xs text-stone-500">
                              {releaseYear(album.release_date)}
                              {' · '}
                              {selectedCount > 0 && selectedCount < trackCount
                                ? <span className="text-pink-400">{selectedCount}/{trackCount}</span>
                                : selectedCount === trackCount && trackCount > 0
                                ? <span className="text-pink-400">all {trackCount}</span>
                                : <span>{trackCount}</span>} track{trackCount !== 1 ? 's' : ''}
                            </p>
                          </div>

                          <button type="button" onClick={() => expandAlbum(album.id)}
                            className="shrink-0 p-1 text-stone-500 hover:text-white transition-colors">
                            {tracksLoading
                              ? <div className="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                              : <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />}
                          </button>
                        </div>

                        {expanded && tracksLoaded && (
                          <ul className="border-t border-stone-800 divide-y divide-stone-800/50">
                            {tracks.map((track, i) => (
                              <li key={track.id}>
                                <button type="button" onClick={() => toggleTrack(album.id, track.id)}
                                  className={`w-full flex items-center gap-3 px-3 py-2 transition-colors text-left ${
                                    selectedIds.has(track.id) ? 'bg-pink-950/20 hover:bg-pink-950/30' : 'hover:bg-stone-800'
                                  }`}>
                                  <span className="text-xs text-stone-600 w-5 text-right tabular-nums shrink-0">{i + 1}</span>
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                    selectedIds.has(track.id) ? 'bg-pink-500 border-pink-500' : 'border-stone-600'
                                  }`}>
                                    {selectedIds.has(track.id) && <Check className="w-3 h-3 text-white" />}
                                  </div>
                                  <p className="text-sm text-white truncate flex-1">{track.title}</p>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </>
              )}

              {!albumsLoading && albumStates.length === 0 && (
                <p className="text-sm text-stone-600 text-center py-8">No releases found</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!importResult && step === 'albums' && !albumsLoading && (
          <div className="shrink-0 px-5 py-4 border-t border-stone-800 flex items-center justify-between gap-3">
            {error
              ? <p className="text-xs text-red-400 flex-1">{error}</p>
              : <p className="text-xs text-stone-500 flex-1">{totalSelected} song{totalSelected !== 1 ? 's' : ''} selected</p>}
            <button type="button" onClick={handleImport}
              disabled={importing || totalSelected === 0}
              className="shrink-0 px-5 py-2 rounded-xl bg-pink-700 hover:bg-pink-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
              {importing ? 'Importing…' : `Import ${totalSelected > 0 ? totalSelected : ''} song${totalSelected !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
