import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSpotifyToken, mapSpotifyAlbum, type SpotifyAlbumResult } from '@/lib/spotify'

// GET /api/songs/spotify-artist-albums?artist_id=<id>
// Lists albums (and singles) for a Spotify artist — used by the bulk import picker.

export type { SpotifyAlbumResult }

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const artistId = request.nextUrl.searchParams.get('artist_id')?.trim()
  if (!artistId) return NextResponse.json({ error: 'artist_id is required' }, { status: 400 })

  const tokenResult = await getSpotifyToken()
  if (!tokenResult.ok) {
    const msg = tokenResult.error === 'not_configured'
      ? 'Spotify not configured — add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET'
      : `Spotify auth failed: ${tokenResult.details ?? tokenResult.error}`
    return NextResponse.json({ error: msg }, { status: 503 })
  }
  const token = tokenResult.token

  const url = `https://api.spotify.com/v1/artists/${artistId}/albums?${new URLSearchParams({
    include_groups: 'album,single',
    limit: '50',
    market: 'US',
  })}`

  let raw: Response
  try {
    raw = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 3600 } })
  } catch {
    return NextResponse.json({ error: 'Spotify unavailable' }, { status: 502 })
  }

  if (!raw.ok) return NextResponse.json({ error: 'Artist not found' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await raw.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const albums: SpotifyAlbumResult[] = ((json.items ?? []) as any[]).map((a) => mapSpotifyAlbum(a))
  return NextResponse.json({ albums })
}
