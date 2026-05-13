import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAppleMusicToken, mapAppleArtist, AM_BASE, type AppleMusicArtistResult } from '@/lib/appleMusic'

// GET /api/artists/featured-country
// Returns two curated lists for the onboarding taste step:
//   trending  — country artists from Apple Music catalog search
//   classics  — iconic legends searched individually to guarantee their presence

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

async function searchOne(token: string, name: string): Promise<AppleMusicArtistResult | null> {
  try {
    const url = `${AM_BASE}/search?${new URLSearchParams({ types: 'artists', term: name, limit: '1' })}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json()
    const item = json.results?.artists?.data?.[0]
    if (!item) return null
    return mapAppleArtist(item)
  } catch {
    return null
  }
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = getAppleMusicToken()
  if (!token) {
    return NextResponse.json({ trending: [], classics: [], configured: false })
  }

  // Trending country + individual classics in parallel
  const [trendingRes, ...classicResults] = await Promise.all([
    fetch(
      `${AM_BASE}/search?${new URLSearchParams({ types: 'artists', term: 'country music', limit: '20' })}`,
      { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 3600 } },
    ),
    ...CLASSIC_NAMES.map((name) => searchOne(token, name)),
  ])

  let trending: AppleMusicArtistResult[] = []
  if (trendingRes.ok) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await trendingRes.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    trending = ((json.results?.artists?.data ?? []) as any[]).map((a) => mapAppleArtist(a))
    trending = trending.slice(0, 16)
  }

  const classics: AppleMusicArtistResult[] = (classicResults as (AppleMusicArtistResult | null)[])
    .filter((r): r is AppleMusicArtistResult => r !== null)

  const trendingIds = new Set(trending.map((a) => a.id))
  const dedupedClassics = classics.filter((c) => !trendingIds.has(c.id))

  return NextResponse.json({ trending, classics: dedupedClassics, configured: true })
}
