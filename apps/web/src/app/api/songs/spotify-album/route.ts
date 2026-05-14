import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSpotifyToken, mapSpotifyAlbumFull, type SpotifyAlbumWithTracks } from '@/lib/spotify'

// GET /api/songs/spotify-album?album_id=<id>
// Fetches a full Spotify album including all tracks + cover art.
// Used by the bulk import UI.

export type { SpotifyAlbumWithTracks }

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const albumId = request.nextUrl.searchParams.get('album_id')?.trim()
  if (!albumId) return NextResponse.json({ error: 'album_id is required' }, { status: 400 })

  const tokenResult = await getSpotifyToken()
  if (!tokenResult.ok) {
    const msg = tokenResult.error === 'not_configured'
      ? 'Spotify not configured — add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET'
      : `Spotify auth failed: ${tokenResult.details ?? tokenResult.error}`
    return NextResponse.json({ error: msg }, { status: 503 })
  }
  const token = tokenResult.token

  let raw: Response
  try {
    raw = await fetch(`https://api.spotify.com/v1/albums/${albumId}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600 },
    })
  } catch {
    return NextResponse.json({ error: 'Spotify unavailable' }, { status: 502 })
  }

  if (!raw.ok) return NextResponse.json({ error: 'Album not found' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await raw.json()
  const album: SpotifyAlbumWithTracks = mapSpotifyAlbumFull(json)
  return NextResponse.json({ album })
}
