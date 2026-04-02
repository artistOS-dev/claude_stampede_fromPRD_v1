'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Music2, Users, Star, Plus, Trash2, ExternalLink, ArrowLeft, Loader2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

interface Song {
  id: string
  title: string
  artist: string
  album: string | null
  spotify_url: string | null
  cover_url: string | null
  avg_rating: number
  rating_count: number
  my_rating: number | null
  created_at: string
  profiles: { display_name: string; avatar_url: string | null } | null
}

interface Artist {
  id: string
  artist_name: string
  created_at: string
  added_by: string
  profiles: { display_name: string } | null
}

function StarRating({
  value,
  interactive,
  onRate,
}: {
  value: number
  interactive?: boolean
  onRate?: (rating: number) => void
}) {
  const [hovered, setHovered] = useState(0)
  const display = hovered || value

  return (
    <div className="flex items-center gap-0.5" aria-label={`Rating: ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => onRate?.(star)}
          onMouseEnter={() => interactive && setHovered(star)}
          onMouseLeave={() => interactive && setHovered(0)}
          className={`focus:outline-none ${interactive ? 'cursor-pointer' : 'cursor-default'}`}
          aria-label={interactive ? `Rate ${star} stars` : undefined}
        >
          <Star
            className={`w-4 h-4 transition-colors ${
              star <= display
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-200 fill-gray-200'
            }`}
          />
        </button>
      ))}
    </div>
  )
}

export default function CircleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [tab, setTab] = useState<'songs' | 'artists'>('songs')

  // Songs state
  const [songs, setSongs] = useState<Song[]>([])
  const [songsLoading, setSongsLoading] = useState(true)
  const [songsError, setSongsError] = useState<string | null>(null)
  const [showAddSong, setShowAddSong] = useState(false)
  const [songTitle, setSongTitle] = useState('')
  const [songArtist, setSongArtist] = useState('')
  const [songAlbum, setSongAlbum] = useState('')
  const [songSpotify, setSongSpotify] = useState('')
  const [addingSong, setAddingSong] = useState(false)
  const [addSongError, setAddSongError] = useState<string | null>(null)

  // Artists state
  const [artists, setArtists] = useState<Artist[]>([])
  const [artistsLoading, setArtistsLoading] = useState(true)
  const [artistsError, setArtistsError] = useState<string | null>(null)
  const [artistName, setArtistName] = useState('')
  const [addingArtist, setAddingArtist] = useState(false)
  const [addArtistError, setAddArtistError] = useState<string | null>(null)

  const loadSongs = useCallback(async () => {
    setSongsLoading(true)
    setSongsError(null)
    try {
      const res = await fetch(`/api/circles/${id}/songs`)
      if (!res.ok) throw new Error('Failed to load songs')
      const data: { songs: Song[] } = await res.json()
      setSongs(data.songs ?? [])
    } catch {
      setSongsError('Could not load songs.')
    } finally {
      setSongsLoading(false)
    }
  }, [id])

  const loadArtists = useCallback(async () => {
    setArtistsLoading(true)
    setArtistsError(null)
    try {
      const res = await fetch(`/api/circles/${id}/artists`)
      if (!res.ok) throw new Error('Failed to load artists')
      const data: { artists: Artist[] } = await res.json()
      setArtists(data.artists ?? [])
    } catch {
      setArtistsError('Could not load artists.')
    } finally {
      setArtistsLoading(false)
    }
  }, [id])

  useEffect(() => { loadSongs() }, [loadSongs])
  useEffect(() => { loadArtists() }, [loadArtists])

  const handleAddSong = async () => {
    if (!songTitle.trim() || !songArtist.trim()) return
    setAddingSong(true)
    setAddSongError(null)
    try {
      const res = await fetch(`/api/circles/${id}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: songTitle.trim(),
          artist: songArtist.trim(),
          album: songAlbum.trim() || null,
          spotify_url: songSpotify.trim() || null,
        }),
      })
      const data: { success?: boolean; error?: string } = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to add song')
      setSongTitle('')
      setSongArtist('')
      setSongAlbum('')
      setSongSpotify('')
      setShowAddSong(false)
      loadSongs()
    } catch (err) {
      setAddSongError(err instanceof Error ? err.message : 'Failed to add song')
    } finally {
      setAddingSong(false)
    }
  }

  const handleRate = async (songId: string, rating: number) => {
    // Optimistic update
    setSongs((prev) =>
      prev.map((s) => (s.id === songId ? { ...s, my_rating: rating } : s))
    )
    try {
      await fetch(`/api/circles/${id}/songs/${songId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      })
      // Refresh to get updated avg
      loadSongs()
    } catch {
      // Revert on failure
      loadSongs()
    }
  }

  const handleAddArtist = async () => {
    if (!artistName.trim()) return
    setAddingArtist(true)
    setAddArtistError(null)
    try {
      const res = await fetch(`/api/circles/${id}/artists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist_name: artistName.trim() }),
      })
      const data: { success?: boolean; error?: string } = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to add artist')
      setArtistName('')
      loadArtists()
    } catch (err) {
      setAddArtistError(err instanceof Error ? err.message : 'Failed to add artist')
    } finally {
      setAddingArtist(false)
    }
  }

  const handleRemoveArtist = async (artistId: string) => {
    try {
      await fetch(`/api/circles/${id}/artists?artist_id=${artistId}`, { method: 'DELETE' })
      setArtists((prev) => prev.filter((a) => a.id !== artistId))
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-orange-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to circles
      </button>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(['songs', 'artists'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t
                ? 'bg-white text-orange-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'songs' ? (
              <span className="flex items-center gap-1.5"><Music2 className="w-4 h-4" />Songs</span>
            ) : (
              <span className="flex items-center gap-1.5"><Users className="w-4 h-4" />Artists</span>
            )}
          </button>
        ))}
      </div>

      {/* ── SONGS TAB ── */}
      {tab === 'songs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">
              Shared Songs <span className="text-gray-400 font-normal text-base">({songs.length})</span>
            </h2>
            <Button variant="primary" onClick={() => setShowAddSong((v) => !v)}>
              <Plus className="w-4 h-4" />
              Share a song
            </Button>
          </div>

          {/* Add song form */}
          {showAddSong && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 space-y-3">
              <h3 className="font-semibold text-gray-900 text-sm">Share a new song</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Song title *"
                  type="text"
                  id="song-title"
                  value={songTitle}
                  onChange={(e) => setSongTitle(e.target.value)}
                  placeholder="e.g. Fast Car"
                />
                <Input
                  label="Artist *"
                  type="text"
                  id="song-artist"
                  value={songArtist}
                  onChange={(e) => setSongArtist(e.target.value)}
                  placeholder="e.g. Tracy Chapman"
                />
                <Input
                  label="Album"
                  type="text"
                  id="song-album"
                  value={songAlbum}
                  onChange={(e) => setSongAlbum(e.target.value)}
                  placeholder="Optional"
                />
                <Input
                  label="Spotify link"
                  type="url"
                  id="song-spotify"
                  value={songSpotify}
                  onChange={(e) => setSongSpotify(e.target.value)}
                  placeholder="https://open.spotify.com/…"
                />
              </div>
              {addSongError && (
                <p className="text-sm text-red-600">{addSongError}</p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  loading={addingSong}
                  disabled={!songTitle.trim() || !songArtist.trim()}
                  onClick={handleAddSong}
                >
                  Share
                </Button>
                <Button variant="secondary" onClick={() => setShowAddSong(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {songsLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
            </div>
          )}

          {songsError && !songsLoading && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-4">{songsError}</p>
          )}

          {!songsLoading && !songsError && songs.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Music2 className="w-10 h-10 mx-auto mb-2" />
              <p className="font-medium">No songs yet</p>
              <p className="text-sm mt-1">Be the first to share a song with this circle</p>
            </div>
          )}

          {!songsLoading && songs.map((song) => (
            <div
              key={song.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-start gap-4"
            >
              {/* Cover placeholder */}
              <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Music2 className="w-6 h-6 text-orange-500" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{song.title}</p>
                    <p className="text-sm text-gray-500 truncate">{song.artist}{song.album ? ` · ${song.album}` : ''}</p>
                  </div>
                  {song.spotify_url && (
                    <a
                      href={song.spotify_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-green-600 hover:text-green-700"
                      aria-label="Open in Spotify"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>

                <div className="mt-2 flex items-center gap-4 flex-wrap">
                  {/* Community avg */}
                  <div className="flex items-center gap-1.5">
                    <StarRating value={Math.round(song.avg_rating)} />
                    <span className="text-xs text-gray-400">
                      {song.avg_rating > 0 ? song.avg_rating.toFixed(1) : '—'}
                      {song.rating_count > 0 && ` (${song.rating_count})`}
                    </span>
                  </div>

                  {/* My rating */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">My rating:</span>
                    <StarRating
                      value={song.my_rating ?? 0}
                      interactive
                      onRate={(r) => handleRate(song.id, r)}
                    />
                  </div>
                </div>

                {song.profiles && (
                  <p className="text-xs text-gray-400 mt-1.5">
                    Shared by {song.profiles.display_name}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ARTISTS TAB ── */}
      {tab === 'artists' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">
              Favourite Artists <span className="text-gray-400 font-normal text-base">({artists.length})</span>
            </h2>
          </div>

          {/* Add artist form */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                label=""
                type="text"
                id="artist-name"
                value={artistName}
                onChange={(e) => { setArtistName(e.target.value); setAddArtistError(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddArtist() }}
                placeholder="Artist name…"
              />
            </div>
            <div className="pt-0.5">
              <Button
                variant="primary"
                loading={addingArtist}
                disabled={!artistName.trim()}
                onClick={handleAddArtist}
                className="mt-0.5"
              >
                <Plus className="w-4 h-4" />
                Add
              </Button>
            </div>
          </div>
          {addArtistError && (
            <p className="text-sm text-red-600">{addArtistError}</p>
          )}

          {artistsLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
            </div>
          )}

          {artistsError && !artistsLoading && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-4">{artistsError}</p>
          )}

          {!artistsLoading && !artistsError && artists.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-2" />
              <p className="font-medium">No favourite artists yet</p>
              <p className="text-sm mt-1">Add artists this circle loves</p>
            </div>
          )}

          {!artistsLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {artists.map((artist) => (
                <div
                  key={artist.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <Music2 className="w-5 h-5 text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{artist.artist_name}</p>
                    {artist.profiles && (
                      <p className="text-xs text-gray-400">Added by {artist.profiles.display_name}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveArtist(artist.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                    aria-label={`Remove ${artist.artist_name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
