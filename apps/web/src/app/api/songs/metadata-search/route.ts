import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/songs/metadata-search?q=<query>
// Searches the iTunes Search API (no credentials required) and returns
// normalised song metadata: title, artist, album, cover_url, source_url.

export interface MetadataResult {
  id: string
  title: string
  artist: string
  album: string | null
  cover_url: string | null
  source_url: string | null  // Apple Music track URL
}

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (!q) return NextResponse.json({ results: [] })

  const url = `https://itunes.apple.com/search?${new URLSearchParams({
    term: q,
    entity: 'song',
    limit: '10',
    media: 'music',
  })}`

  let raw: Response
  try {
    raw = await fetch(url, { next: { revalidate: 60 } })
  } catch {
    return NextResponse.json({ error: 'Search service unavailable' }, { status: 502 })
  }

  if (!raw.ok) return NextResponse.json({ error: 'Search failed' }, { status: 502 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: { results: any[] } = await raw.json()

  const results: MetadataResult[] = (json.results ?? []).map((r) => ({
    id: String(r.trackId ?? Math.random()),
    title: r.trackName ?? '',
    artist: r.artistName ?? '',
    album: r.collectionName ?? null,
    // Upgrade artwork from 100px → 600px thumbnail
    cover_url: r.artworkUrl100
      ? (r.artworkUrl100 as string).replace('100x100bb', '600x600bb')
      : null,
    source_url: r.trackViewUrl ?? null,
  }))

  return NextResponse.json({ results })
}
