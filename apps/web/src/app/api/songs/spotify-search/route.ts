import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAppleMusicToken, mapAppleTrack, AM_BASE, type AppleMusicTrackResult } from '@/lib/appleMusic'

// GET /api/songs/spotify-search?q=<query>&limit=<n>
// Now backed by Apple Music Catalog search.
// Kept at this path for backwards compatibility with existing component imports.
// Returns { tracks, spotify_available } — flag kept for client compat (renamed internally to apple_music_available).

export type { AppleMusicTrackResult as SpotifyTrackResult }

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q     = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? 20), 50)

  const token = getAppleMusicToken()
  if (!token) {
    return NextResponse.json({ tracks: [], spotify_available: false })
  }

  if (!q) return NextResponse.json({ tracks: [], spotify_available: true })

  const url = `${AM_BASE}/search?${new URLSearchParams({ types: 'songs', term: q, limit: String(limit) })}`

  let raw: Response
  try {
    raw = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 30 },
    })
  } catch {
    return NextResponse.json({ error: 'Apple Music unavailable' }, { status: 502 })
  }

  if (!raw.ok) return NextResponse.json({ error: 'Search failed' }, { status: 502 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await raw.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = json.results?.songs?.data ?? []

  const tracks: AppleMusicTrackResult[] = items.map((t) => mapAppleTrack(t))
  return NextResponse.json({ tracks, spotify_available: true })
}
