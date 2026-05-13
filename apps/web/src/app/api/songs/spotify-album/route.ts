import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAppleMusicToken, mapAppleAlbumFull, AM_BASE, type AppleMusicAlbumWithTracks } from '@/lib/appleMusic'

// GET /api/songs/spotify-album?album_id=<id>
// Now backed by Apple Music. Fetches a full album including all tracks + cover art.

export type { AppleMusicAlbumWithTracks as SpotifyAlbumWithTracks }

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const albumId = request.nextUrl.searchParams.get('album_id')?.trim()
  if (!albumId) return NextResponse.json({ error: 'album_id is required' }, { status: 400 })

  const token = getAppleMusicToken()
  if (!token) return NextResponse.json({ error: 'Apple Music not configured' }, { status: 503 })

  // include=tracks fetches the relationship inline (up to 100 tracks per album)
  const url = `${AM_BASE}/albums/${albumId}?include=tracks`

  let raw: Response
  try {
    raw = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600 },
    })
  } catch {
    return NextResponse.json({ error: 'Apple Music unavailable' }, { status: 502 })
  }

  if (!raw.ok) return NextResponse.json({ error: 'Album not found' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await raw.json()
  const albumData = json.data?.[0]
  if (!albumData) return NextResponse.json({ error: 'Album not found' }, { status: 404 })

  const album: AppleMusicAlbumWithTracks = mapAppleAlbumFull(albumData)
  return NextResponse.json({ album })
}
