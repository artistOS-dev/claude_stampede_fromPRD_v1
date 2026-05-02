import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/artists/spotify-search?q=<query>
// Searches Spotify for artists using the Client Credentials flow.
// Requires SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET in env.

export interface SpotifyArtistResult {
  id: string
  name: string
  image_url: string | null
  spotify_url: string
  genres: string[]
  followers: number
}

// Module-level token cache — survives across requests in the same server instance
let tokenCache: { token: string; expiresAt: number } | null = null

async function getToken(): Promise<string | null> {
  const clientId     = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.token

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  })
  if (!res.ok) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await res.json()
  tokenCache = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 }
  return tokenCache.token
}

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (!q) return NextResponse.json({ artists: [] })

  const token = await getToken()
  if (!token) {
    return NextResponse.json({ artists: [], error: 'not_configured' })
  }

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

  const artists: SpotifyArtistResult[] = items.map((a) => ({
    id: a.id,
    name: a.name,
    image_url: (a.images?.[0]?.url as string) ?? null,
    spotify_url: a.external_urls?.spotify ?? `https://open.spotify.com/artist/${a.id}`,
    genres: (a.genres as string[]) ?? [],
    followers: a.followers?.total ?? 0,
  }))

  return NextResponse.json({ artists })
}
