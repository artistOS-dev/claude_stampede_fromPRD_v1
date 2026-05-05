import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSpotifyToken, mapSpotifyArtist, type SpotifyArtistResult } from '@/lib/spotify'

// GET /api/artists/featured-country
// Returns two curated lists for the onboarding taste step:
//   trending  — current popular country artists from Spotify
//   classics  — iconic legends (searched individually to guarantee their presence)

const CLASSIC_NAMES = [
  'Johnny Cash',
  'Dolly Parton',
  'Garth Brooks',
  'Willie Nelson',
  'Kenny Rogers',
  'Shania Twain',
  'George Strait',
  'Hank Williams',
  'Reba McEntire',
  'Alan Jackson',
]

async function searchOne(token: string, name: string): Promise<SpotifyArtistResult | null> {
  try {
    const url = `https://api.spotify.com/v1/search?${new URLSearchParams({
      q: name,
      type: 'artist',
      limit: '1',
      market: 'US',
    })}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json()
    const item = json.artists?.items?.[0]
    if (!item) return null
    return mapSpotifyArtist(item)
  } catch {
    return null
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = await getSpotifyToken()
  if (!token) {
    return NextResponse.json({ trending: [], classics: [], configured: false })
  }

  // Fetch trending + classics in parallel
  const [trendingRes, ...classicResults] = await Promise.all([
    fetch(
      `https://api.spotify.com/v1/search?${new URLSearchParams({
        q: 'genre:country',
        type: 'artist',
        limit: '20',
        market: 'US',
      })}`,
      { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 3600 } }
    ),
    ...CLASSIC_NAMES.map((name) => searchOne(token, name)),
  ])

  let trending: SpotifyArtistResult[] = []
  if (trendingRes.ok) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await trendingRes.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    trending = (json.artists?.items ?? []).map((a: any) => mapSpotifyArtist(a))
    // Sort by popularity descending
    trending.sort((a, b) => b.popularity - a.popularity)
    trending = trending.slice(0, 16)
  }

  const classics: SpotifyArtistResult[] = (classicResults as (SpotifyArtistResult | null)[])
    .filter((r): r is SpotifyArtistResult => r !== null)

  // Deduplicate: remove classics that already appear in trending
  const trendingIds = new Set(trending.map((a) => a.id))
  const dedupedClassics = classics.filter((c) => !trendingIds.has(c.id))

  return NextResponse.json({ trending, classics: dedupedClassics, configured: true })
}
