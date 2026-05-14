import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSpotifyToken, mapSpotifyArtist, type SpotifyArtistResult } from '@/lib/spotify'

// Re-export so existing importers of SpotifyArtistResult from this path keep working
export type { SpotifyArtistResult }

// GET /api/artists/spotify-search?q=<query>
// Searches Spotify for artists using the Client Credentials flow.
// Requires SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET in env.

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (!q) return NextResponse.json({ artists: [] })

  const tokenResult = await getSpotifyToken()
  if (!tokenResult.ok) {
    return NextResponse.json({ artists: [], error: tokenResult.error, details: tokenResult.details })
  }
  const token = tokenResult.token

  const url = `https://api.spotify.com/v1/search?${new URLSearchParams({
    q,
    type: 'artist',
    limit: '8',
  })}`

  let raw: Response
  try {
    raw = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 60 },
    })
  } catch {
    return NextResponse.json({ error: 'Search service unavailable' }, { status: 502 })
  }

  if (!raw.ok) return NextResponse.json({ error: 'Search failed' }, { status: 502 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await raw.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = json.artists?.items ?? []

  const artists: SpotifyArtistResult[] = items.map((a) => mapSpotifyArtist(a))

  return NextResponse.json({ artists })
}
