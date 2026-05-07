import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/songs/search?q=<query>&limit=<n>&source=circle|stable|all
// Any authenticated user can search songs (used when creating showdowns/circuits).
// source=stable searches the caller's stable catalog (for artist managers).

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? 10), 30)
  const source = request.nextUrl.searchParams.get('source') ?? 'circle'

  const svc = createServiceClient()

  // circle_songs results
  let circleSongs: { id: string; title: string; artist: string; album: string | null; circles: { name: string } | null; source: string }[] = []
  if (source === 'circle' || source === 'all') {
    const circleQuery = svc
      .from('circle_songs')
      .select('id, title, artist, album, circles(name)')
      .limit(limit)

    const { data } = q
      ? await circleQuery.or(`title.ilike.%${q}%,artist.ilike.%${q}%`)
      : await circleQuery.order('created_at', { ascending: false })

    circleSongs = (data ?? []).map((s) => ({ ...s, circles: Array.isArray(s.circles) ? s.circles[0] ?? null : s.circles, source: 'circle' }))
  }

  // stable_songs results (manager's own catalog, or all if source=all)
  let stableSongs: { id: string; title: string; artist: string; album: string | null; circles: null; source: string }[] = []
  if (source === 'stable' || source === 'all') {
    const stableQuery = svc
      .from('stable_songs')
      .select('id, title, artist, album, stable_id, stables!inner(manager_id)')
      .limit(limit)

    const filteredQuery = source === 'stable'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (stableQuery as any).eq('stables.manager_id', user.id)
      : stableQuery

    const { data } = q
      ? await filteredQuery.or(`title.ilike.%${q}%,artist.ilike.%${q}%`)
      : await filteredQuery.order('created_at', { ascending: false })

    stableSongs = (data ?? []).map((s: { id: string; title: string; artist: string; album: string | null }) => ({
      id: s.id, title: s.title, artist: s.artist, album: s.album,
      circles: null,
      source: 'stable',
    }))
  }

  const songs = source === 'circle' ? circleSongs
    : source === 'stable' ? stableSongs
    : [...circleSongs, ...stableSongs].slice(0, limit)

  return NextResponse.json({ songs })
}
