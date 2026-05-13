import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAppleMusicToken, mapAppleAlbum, AM_BASE, type AppleMusicAlbumResult } from '@/lib/appleMusic'

// GET /api/songs/spotify-artist-albums?artist_id=<id>
// Now backed by Apple Music. Lists albums (and singles) for an Apple Music artist.

export type { AppleMusicAlbumResult as SpotifyAlbumResult }

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const artistId = request.nextUrl.searchParams.get('artist_id')?.trim()
  if (!artistId) return NextResponse.json({ error: 'artist_id is required' }, { status: 400 })

  const token = getAppleMusicToken()
  if (!token) return NextResponse.json({ error: 'Apple Music not configured' }, { status: 503 })

  const url = `${AM_BASE}/artists/${artistId}/albums?${new URLSearchParams({ limit: '100' })}`

  let raw: Response
  try {
    raw = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600 },
    })
  } catch {
    return NextResponse.json({ error: 'Apple Music unavailable' }, { status: 502 })
  }

  if (!raw.ok) return NextResponse.json({ error: 'Artist not found' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await raw.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const albums: AppleMusicAlbumResult[] = ((json.data ?? []) as any[]).map((a) => mapAppleAlbum(a))
  return NextResponse.json({ albums })
}
