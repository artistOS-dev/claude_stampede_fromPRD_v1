import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

type Params = { params: { slug: string } }

// GET /api/stables/[slug] — full stable detail
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()

  const { data: stable } = await svc
    .from('stables')
    .select('*')
    .eq('slug', params.slug)
    .maybeSingle()

  if (!stable) return NextResponse.json({ error: 'Stable not found' }, { status: 404 })

  const isManager = stable.manager_id === user.id
  if (!stable.is_published && !isManager) {
    return NextResponse.json({ error: 'Stable not found' }, { status: 404 })
  }

  const [
    { count: followerCount },
    { data: myFollow },
    { data: songs },
    { data: posts },
    { data: merch },
    { data: circuitHistory },
  ] = await Promise.all([
    svc.from('stable_followers').select('*', { count: 'exact', head: true }).eq('stable_id', stable.id),
    svc.from('stable_followers').select('followed_at').eq('stable_id', stable.id).eq('follower_id', user.id).maybeSingle(),
    svc.from('stable_songs')
      .select('*, stable_song_ratings(rating, rater_id)')
      .eq('stable_id', stable.id)
      .eq('is_published', true)
      .order('created_at', { ascending: false }),
    svc.from('stable_posts')
      .select('*')
      .eq('stable_id', stable.id)
      .order('created_at', { ascending: false })
      .limit(20),
    svc.from('stable_merchandise')
      .select('*')
      .eq('stable_id', stable.id)
      .order('created_at', { ascending: false }),
    svc.from('circuit_participants')
      .select('id, song_uses, circuits(id, name, status, created_at)')
      .eq('manager_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const enrichedSongs = (songs ?? []).map((song) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ratings = (song.stable_song_ratings as any[]) ?? []
    const total = ratings.length
    const avg = total > 0 ? Math.round((ratings.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / total) * 10) / 10 : null
    const myRating = ratings.find((r: { rater_id: string }) => r.rater_id === user.id)?.rating ?? null
    return { ...song, stable_song_ratings: undefined, avg_rating: avg, rating_count: total, my_rating: myRating }
  })

  return NextResponse.json({
    stable,
    is_manager: isManager,
    follower_count: followerCount ?? 0,
    is_following: !!myFollow,
    songs: enrichedSongs,
    posts: posts ?? [],
    merch: merch ?? [],
    circuit_history: (circuitHistory ?? []).map((cp) => ({
      participant_id: cp.id,
      song_uses: cp.song_uses,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      circuit: (cp as any).circuits,
    })),
  })
}

// PATCH /api/stables/[slug] — update stable (manager only)
export async function PATCH(request: NextRequest, { params }: Params) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()

  const { data: stable } = await svc
    .from('stables')
    .select('id, manager_id')
    .eq('slug', params.slug)
    .maybeSingle()

  if (!stable) return NextResponse.json({ error: 'Stable not found' }, { status: 404 })
  if (stable.manager_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const allowed = [
    'bio', 'avatar_url', 'banner_url', 'genres', 'location',
    'instagram_url', 'twitter_url', 'tiktok_url', 'spotify_url',
    'apple_music_url', 'youtube_url', 'website_url',
    'next_concert_at', 'concert_stream_url', 'is_published',
    'artist_name',
  ]
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }

  const { data: updated, error } = await svc
    .from('stables')
    .update(patch)
    .eq('id', stable.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ stable: updated })
}
