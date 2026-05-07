import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

type Params = { params: { slug: string } }

// GET /api/stables/[slug]/songs — list songs (used for circuit song picker)
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()

  const { data: stable } = await svc
    .from('stables')
    .select('id, is_published, manager_id')
    .eq('slug', params.slug)
    .maybeSingle()

  if (!stable) return NextResponse.json({ error: 'Stable not found' }, { status: 404 })
  if (!stable.is_published && stable.manager_id !== user.id) {
    return NextResponse.json({ error: 'Stable not found' }, { status: 404 })
  }

  const { data: songs, error } = await svc
    .from('stable_songs')
    .select('*, stable_song_ratings(rating, rater_id)')
    .eq('stable_id', stable.id)
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const enriched = (songs ?? []).map((song) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ratings = (song.stable_song_ratings as any[]) ?? []
    const total = ratings.length
    const avg = total > 0
      ? Math.round((ratings.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / total) * 10) / 10
      : null
    const myRating = ratings.find((r: { rater_id: string }) => r.rater_id === user.id)?.rating ?? null
    return { ...song, stable_song_ratings: undefined, avg_rating: avg, rating_count: total, my_rating: myRating }
  })

  return NextResponse.json({ songs: enriched })
}

// POST /api/stables/[slug]/songs — add a song to the catalog
export async function POST(request: NextRequest, { params }: Params) {
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

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const artist = typeof body.artist === 'string' ? body.artist.trim() : ''
  if (!title || !artist) {
    return NextResponse.json({ error: 'title and artist are required' }, { status: 400 })
  }

  const { data: song, error } = await svc
    .from('stable_songs')
    .insert({
      stable_id: stable.id,
      title,
      artist,
      album: typeof body.album === 'string' ? body.album.trim() || null : null,
      release_year: typeof body.release_year === 'number' ? body.release_year : null,
      cover_url: typeof body.cover_url === 'string' ? body.cover_url || null : null,
      audio_preview_url: typeof body.audio_preview_url === 'string' ? body.audio_preview_url || null : null,
      spotify_url: typeof body.spotify_url === 'string' ? body.spotify_url || null : null,
      apple_music_url: typeof body.apple_music_url === 'string' ? body.apple_music_url || null : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ song }, { status: 201 })
}
