import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAppleMusicToken, mapAppleArtist, AM_BASE, type AppleMusicArtistResult } from '@/lib/appleMusic'

// GET /api/artists/spotify-search?q=<query>
// Now backed by Apple Music Catalog search.
// Kept at this path for backwards compatibility with existing component imports.

export type { AppleMusicArtistResult as SpotifyArtistResult }

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (!q) return NextResponse.json({ artists: [] })

  const token = getAppleMusicToken()
  if (!token) {
    return NextResponse.json({ artists: [], error: 'not_configured' })
  }

  const url = `${AM_BASE}/search?${new URLSearchParams({ types: 'artists', term: q, limit: '8' })}`

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
  const items: any[] = json.results?.artists?.data ?? []

  const artists: AppleMusicArtistResult[] = items.map((a) => mapAppleArtist(a))
  return NextResponse.json({ artists })
}
