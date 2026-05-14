import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSpotifyToken, mapSpotifyTrack, type SpotifyTrackResult } from '@/lib/spotify'

// GET /api/songs/spotify-search?q=<query>&limit=<n>
// Searches Spotify for tracks. Requires SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET.
// Returns { tracks, spotify_available } — if unconfigured, returns empty tracks + flag so
// the client can fall back to iTunes metadata-search.

export type { SpotifyTrackResult }

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? 20), 50)

  const tokenResult = await getSpotifyToken()
  if (!tokenResult.ok) {
    return NextResponse.json({ tracks: [], spotify_available: false, error: tokenResult.error })
  }
  const token = tokenResult.token

  if (!q) return NextResponse.json({ tracks: [], spotify_available: true })

  const url = `https://api.spotify.com/v1/search?${new URLSearchParams({
    q,
    type: 'track',
    limit: String(limit),
  })}`

  let raw: Response
  try {
    raw = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 30 } })
  } catch {
    return NextResponse.json({ error: 'Spotify unavailable' }, { status: 502 })
  }

  if (!raw.ok) return NextResponse.json({ error: 'Spotify search failed' }, { status: 502 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await raw.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = json.tracks?.items ?? []

  const tracks: SpotifyTrackResult[] = items.map((t) => mapSpotifyTrack(t))
  return NextResponse.json({ tracks, spotify_available: true })
}
